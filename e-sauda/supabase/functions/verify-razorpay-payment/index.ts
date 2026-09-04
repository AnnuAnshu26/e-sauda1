// Deploy: supabase functions deploy verify-razorpay-payment
//
// Called right after Razorpay Checkout's success handler fires in the browser. The
// browser hands back razorpay_payment_id/razorpay_order_id/razorpay_signature, but a
// browser can't be trusted to say "trust me, it succeeded" -- that data could be typed
// in directly via devtools. The signature is an HMAC computed with the secret key,
// which only this server-side function (never the browser) ever holds -- recomputing
// it here and comparing is what actually proves the payment happened.

import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

// Manual constant-time compare -- a plain `===` on the hex strings would still be
// "secure enough" here in practice, but timing-safe comparison is the standard
// practice for anything checking a cryptographic signature, so no reason not to.
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let mismatch = 0
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return mismatch === 0
}

async function hmacSha256Hex(message: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message))
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    )
    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser()
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Not authenticated' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { listingId, razorpayOrderId, razorpayPaymentId, razorpaySignature } = await req.json()
    if (!listingId || !razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const keySecret = Deno.env.get('RAZORPAY_KEY_SECRET')!
    const expectedSignature = await hmacSha256Hex(`${razorpayOrderId}|${razorpayPaymentId}`, keySecret)

    if (!timingSafeEqual(expectedSignature, razorpaySignature)) {
      return new Response(JSON.stringify({ error: 'Payment signature verification failed' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // Re-read the price ourselves rather than trusting anything from the client --
    // same reasoning as create-razorpay-order. This is also what create_vault_order
    // will later re-check against, so a stale price can't sneak through either path.
    const { data: listing, error: listingError } = await adminClient
      .from('listings')
      .select('id, price')
      .eq('id', listingId)
      .single()
    if (listingError || !listing) {
      return new Response(JSON.stringify({ error: 'Listing not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Same accepted-offer lookup as create-razorpay-order — independently
    // re-derived here rather than trusting whatever amount the Razorpay order
    // notes claim, so the amount actually recorded always matches a real,
    // still-valid accepted offer (or the plain listing price if there isn't one).
    const { data: offer } = await adminClient
      .from('chat_offers')
      .select('id, amount')
      .eq('listing_id', listingId)
      .eq('buyer_id', user.id)
      .eq('status', 'accepted')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const amount = offer ? Number(offer.amount) : Number(listing.price)

    // Insert with the service-role key -- this is the only way a row can ever land in
    // razorpay_payments (see razorpay_schema.sql: no insert policy exists for the
    // authenticated/anon roles), which is what makes a row in that table trustworthy
    // proof that this specific verification actually happened.
    const { error: insertError } = await adminClient.from('razorpay_payments').insert({
      razorpay_order_id: razorpayOrderId,
      razorpay_payment_id: razorpayPaymentId,
      listing_id: listingId,
      buyer_id: user.id,
      amount,
      offer_id: offer?.id ?? null,
    })

    if (insertError) {
      // Unique violation on razorpay_order_id means this exact payment was already
      // verified before (e.g. the browser retried the request) -- not a real error,
      // the row we'd have inserted already exists and create_vault_order can use it.
      if (insertError.code === '23505') {
        return new Response(JSON.stringify({ success: true, alreadyVerified: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      console.error('Failed to record verified payment:', insertError)
      return new Response(JSON.stringify({ error: 'Could not record payment' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Mark the offer used so it can never fund a second, separate vault order --
    // same "consume on successful verification" pattern as razorpay_payments'
    // own consumed_at, just one step earlier in the chain.
    if (offer) {
      await adminClient.from('chat_offers').update({ status: 'consumed' }).eq('id', offer.id)
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('verify-razorpay-payment error:', err)
    return new Response(JSON.stringify({ error: 'Unexpected server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
