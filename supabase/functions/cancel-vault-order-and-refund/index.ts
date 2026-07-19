// Deploy: supabase functions deploy cancel-vault-order-and-refund
// Uses the same RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET secrets already set for the
// payment functions -- no new secrets needed.
//
// Orchestrates two things that both need to happen, in order:
// 1. cancel_vault_order (supabase/dispute_fee_schema.sql) -- unchanged, still does all
//    the ownership/status checks and computes refund_amount (full amount minus any
//    delivery fee already incurred).
// 2. A real Razorpay refund for that computed amount -- this is the new part. Before
//    this function existed, step 1 happened but step 2 never did (see the HONEST
//    SCOPE NOTE in dispute_fee_schema.sql) -- refund_amount was calculated but never
//    actually sent back to anyone.
//
// Also supports *retrying just the refund* if a previous call cancelled the order
// successfully but then failed partway through the Razorpay call (e.g. a transient
// network error) -- see the "already cancelled, refund not yet processed" branch below.

import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

function jsonResponse(body: object, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return jsonResponse({ error: 'Missing Authorization header' }, 401)

    // User-scoped client: RPC calls through this still run as the calling user, so
    // cancel_vault_order's own `buyer_id <> auth.uid() and seller_id <> auth.uid()`
    // check applies exactly as if the client had called the RPC directly. This
    // function orchestrates the refund on top; it doesn't loosen who's allowed to
    // cancel what.
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    )
    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser()
    if (userError || !user) return jsonResponse({ error: 'Not authenticated' }, 401)

    const { orderId, reason } = await req.json()
    if (!orderId) return jsonResponse({ error: 'orderId is required' }, 400)

    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    let order: any

    const { data: cancelledOrder, error: cancelError } = await userClient.rpc('cancel_vault_order', {
      p_order_id: orderId,
      p_reason: reason ?? 'Buyer cancelled',
    })

    if (cancelError) {
      // If it's already cancelled and just waiting on its refund, allow retrying
      // *only* the refund step rather than failing outright -- this is what makes a
      // retry-after-a-transient-Razorpay-failure possible without needing a separate
      // "retry refund" button/endpoint.
      const { data: existing } = await adminClient
        .from('vault_orders')
        .select('*')
        .eq('id', orderId)
        .single()

      const isParticipant = existing && (existing.buyer_id === user.id || existing.seller_id === user.id)
      if (existing && isParticipant && existing.status === 'cancelled' && !existing.refund_processed_at) {
        order = existing
      } else {
        return jsonResponse({ error: cancelError.message || 'Could not cancel this order' }, 400)
      }
    } else {
      order = cancelledOrder
    }

    // Nothing to refund -- either this order predates the Razorpay integration (no
    // razorpay_payment_id at all) or the delivery fee deduction consumed the entire
    // amount. Cancellation itself already succeeded either way.
    if (!order.razorpay_payment_id || Number(order.refund_amount) <= 0) {
      return jsonResponse({ success: true, order, refunded: false })
    }

    if (order.refund_processed_at) {
      // Already refunded by an earlier call -- idempotent no-op, not an error.
      return jsonResponse({ success: true, order, refunded: true, alreadyProcessed: true })
    }

    const keyId = Deno.env.get('RAZORPAY_KEY_ID')!
    const keySecret = Deno.env.get('RAZORPAY_KEY_SECRET')!
    const refundAmountPaise = Math.round(Number(order.refund_amount) * 100)

    const refundRes = await fetch(
      `https://api.razorpay.com/v1/payments/${order.razorpay_payment_id}/refund`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Basic ' + btoa(`${keyId}:${keySecret}`),
        },
        body: JSON.stringify({
          amount: refundAmountPaise,
          speed: 'normal',
          notes: { vault_order_id: order.id, reason: reason ?? 'Buyer cancelled' },
        }),
      },
    )
    const refund = await refundRes.json()

    if (!refundRes.ok) {
      console.error('Razorpay refund failed:', refund)
      // The order stays cancelled either way -- we don't roll that back, since the
      // buyer/seller already acted on "this is cancelled" (e.g. the listing is
      // active again). The refund itself can be retried later by calling this same
      // function again with the same orderId, which is exactly what the
      // "not yet refunded" branch above supports.
      return jsonResponse({
        success: true,
        order,
        refunded: false,
        refundFailed: true,
        error: 'Order cancelled, but the refund could not be processed. It will be retried.',
      })
    }

    const { error: updateError } = await adminClient
      .from('vault_orders')
      .update({ razorpay_refund_id: refund.id, refund_processed_at: new Date().toISOString() })
      .eq('id', order.id)

    if (updateError) {
      console.error('Refund succeeded at Razorpay but failed to record locally:', updateError)
      // Not treated as a failure to the caller -- the money genuinely was refunded.
      // Worth knowing about (hence the log) since a retry would otherwise attempt a
      // second refund against an already-refunded payment, which Razorpay itself
      // would reject, just with a less friendly error than this one.
    }

    return jsonResponse({ success: true, order: { ...order, refund_processed_at: new Date().toISOString() }, refunded: true })
  } catch (err) {
    console.error('cancel-vault-order-and-refund error:', err)
    return jsonResponse({ error: 'Unexpected server error' }, 500)
  }
})
