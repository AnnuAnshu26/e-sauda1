// Deploy: supabase functions deploy verify-listing-fee-payment
//
// Same signature-verification approach as verify-razorpay-payment -- see that
// function's comments for the full reasoning. This one records into
// listing_fee_payments instead of razorpay_payments, since a listing fee payment
// happens *before* the listing exists (there's no listing_id to attach it to yet).

import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

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

function feeForCount(activeCount: number): number {
  if (activeCount === 0) return 1
  if (activeCount === 1) return 10
  return 25
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

    const { category, razorpayOrderId, razorpayPaymentId, razorpaySignature } = await req.json()
    if (!category || !razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
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

    // Recompute the fee ourselves rather than trusting anything from the client --
    // same reasoning as create-listing-fee-order. This is also what
    // create_listing_with_fee will implicitly rely on via this recorded amount.
    const { count } = await adminClient
      .from('listings')
      .select('id', { count: 'exact', head: true })
      .eq('owner_id', user.id)
      .eq('category', category)
      .eq('status', 'active')
    const amount = feeForCount(count ?? 0)

    const { error: insertError } = await adminClient.from('listing_fee_payments').insert({
      razorpay_order_id: razorpayOrderId,
      razorpay_payment_id: razorpayPaymentId,
      seller_id: user.id,
      category,
      amount,
    })

    if (insertError) {
      if (insertError.code === '23505') {
        // Already verified before (e.g. a retried request) -- not an error.
        return new Response(JSON.stringify({ success: true, alreadyVerified: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      console.error('Failed to record verified listing fee payment:', insertError)
      return new Response(JSON.stringify({ error: 'Could not record payment' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('verify-listing-fee-payment error:', err)
    return new Response(JSON.stringify({ error: 'Unexpected server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
