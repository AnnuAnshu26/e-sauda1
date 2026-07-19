// Deploy: supabase functions deploy create-razorpay-order
// Secrets needed (set once): supabase secrets set RAZORPAY_KEY_ID=... RAZORPAY_KEY_SECRET=...
//
// Called right when the buyer clicks "Buy with Vault". Creates a real Razorpay Order
// (test mode, if you're using test keys) so the browser has something to open the
// Razorpay Checkout modal against.
//
// The price is read from the database here, server-side -- never taken from the
// request body. If the client could send its own amount, "buy with Vault" would let
// anyone pay 1 rupee for anything by editing the request in devtools.

import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

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

    // Identifies who's calling using their own JWT (not the service role) -- this is
    // the "who are you" check, separate from the service-role client below which is
    // the "let me read the real price regardless of RLS" check.
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

    const { listingId } = await req.json()
    if (!listingId) {
      return new Response(JSON.stringify({ error: 'listingId is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )
    const { data: listing, error: listingError } = await adminClient
      .from('listings')
      .select('id, price, status, owner_id, title')
      .eq('id', listingId)
      .single()

    if (listingError || !listing) {
      return new Response(JSON.stringify({ error: 'Listing not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    if (listing.status !== 'active') {
      return new Response(JSON.stringify({ error: 'This listing is no longer available' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    if (listing.owner_id === user.id) {
      return new Response(JSON.stringify({ error: 'You cannot buy your own listing' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const keyId = Deno.env.get('RAZORPAY_KEY_ID')!
    const keySecret = Deno.env.get('RAZORPAY_KEY_SECRET')!
    // Razorpay amounts are in the smallest currency unit -- paise for INR, not rupees.
    const amountPaise = Math.round(listing.price * 100)

    const razorpayRes = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Basic ' + btoa(`${keyId}:${keySecret}`),
      },
      body: JSON.stringify({
        amount: amountPaise,
        currency: 'INR',
        // Razorpay caps receipt at 40 chars. A bare UUID is already 36, so keep the
        // prefix to 2 chars -- "listing_" (44 total) was over the limit, which is
        // exactly what broke this the first time.
        receipt: `l_${listing.id}`,
        notes: { listing_id: listing.id, buyer_id: user.id },
      }),
    })

    const razorpayOrder = await razorpayRes.json()
    if (!razorpayRes.ok) {
      console.error('Razorpay order creation failed:', razorpayOrder)
      return new Response(JSON.stringify({ error: 'Could not create payment order' }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(
      JSON.stringify({
        orderId: razorpayOrder.id,
        amount: razorpayOrder.amount,
        currency: razorpayOrder.currency,
        keyId, // Razorpay's key_id is the publishable half of the pair -- safe for the browser to see, same as a Stripe publishable key.
        listingTitle: listing.title,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    console.error('create-razorpay-order error:', err)
    return new Response(JSON.stringify({ error: 'Unexpected server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
