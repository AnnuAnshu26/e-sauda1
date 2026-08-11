// Deploy: supabase functions deploy create-listing-fee-order
// Reuses the RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET secrets already set for the Vault
// payment functions -- no new secrets needed.
//
// Mirrors create-razorpay-order's core principle: the fee tier is computed here,
// server-side, from the seller's real active-listing count in this category -- never
// trusted from the client. A client claiming "this is my first listing in Books"
// when it's actually their third would otherwise pay ₹1 instead of ₹25.

import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

// Must exactly match the tiers in src/pages/Sell.tsx's nextListingFee -- if that ever
// changes, this needs to change with it, or the displayed price and the actual charge
// will disagree.
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

    const { category } = await req.json()
    if (!category) {
      return new Response(JSON.stringify({ error: 'category is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )
    const { count, error: countError } = await adminClient
      .from('listings')
      .select('id', { count: 'exact', head: true })
      .eq('owner_id', user.id)
      .eq('category', category)
      .eq('status', 'active')

    if (countError) {
      console.error('Failed to count active listings:', countError)
      return new Response(JSON.stringify({ error: 'Could not compute your listing fee' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const fee = feeForCount(count ?? 0)
    const amountPaise = fee * 100

    const keyId = Deno.env.get('RAZORPAY_KEY_ID')!
    const keySecret = Deno.env.get('RAZORPAY_KEY_SECRET')!

    const razorpayRes = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Basic ' + btoa(`${keyId}:${keySecret}`),
      },
      body: JSON.stringify({
        amount: amountPaise,
        currency: 'INR',
        receipt: `fee_${user.id.slice(0, 8)}_${Date.now()}`,
        notes: { seller_id: user.id, category, purpose: 'listing_fee' },
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
        keyId,
        fee,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    console.error('create-listing-fee-order error:', err)
    return new Response(JSON.stringify({ error: 'Unexpected server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
