// Asks CASHFREE (not the browser) whether a promotion's order was paid, and activates the promotion if so.
// This is the same authoritative check the webhook does, run on demand, so a promotion no longer depends
// on the webhook arriving: the seller's browser calls this right after checkout and the dashboard can
// call it for any promotion still showing "pending payment". activate_promotion() is idempotent, so
// calling this many times (or racing the webhook) is safe.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

const API_VERSION = Deno.env.get('CASHFREE_API_VERSION') || '2025-01-01'
const CASHFREE_BASE_URL = 'https://api.cashfree.com/pg'
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  try {
    const appId = Deno.env.get('CASHFREE_APP_ID')
    const secretKey = Deno.env.get('CASHFREE_SECRET_KEY')
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!appId || !secretKey || !supabaseUrl || !anonKey || !serviceKey) return json({ error: 'Payment configuration is incomplete.' }, 500)

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Authentication required.' }, 401)
    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } })
    const { data: { user }, error: authError } = await userClient.auth.getUser()
    if (authError || !user) return json({ error: 'Not authenticated.' }, 401)

    const body = await req.json().catch(() => ({}))
    const promotionId = body?.promotionId
    if (typeof promotionId !== 'string' || !UUID_RE.test(promotionId)) return json({ error: 'A valid promotion is required.' }, 400)

    const admin = createClient(supabaseUrl, serviceKey)
    // Only the seller who owns it can trigger a check.
    const { data: promo, error } = await admin
      .from('promotions')
      .select('id,seller_id,listing_id,amount_paise,status,cashfree_order_id,paid_at,expires_at')
      .eq('id', promotionId).eq('seller_id', user.id).maybeSingle()
    if (error) throw error
    if (!promo) return json({ error: 'Promotion not found.' }, 404)

    // Already processed -> just report.
    if (promo.status !== 'pending_payment' && promo.status !== 'payment_failed') {
      return json({ status: promo.status, expiresAt: promo.expires_at })
    }

    const headers = { Accept: 'application/json', 'x-api-version': API_VERSION, 'x-client-id': appId, 'x-client-secret': secretKey }
    const orderRes = await fetch(`${CASHFREE_BASE_URL}/orders/${encodeURIComponent(promo.cashfree_order_id)}`, { headers })
    const order = await orderRes.json().catch(() => ({}))
    if (!orderRes.ok) {
      console.error('verify-promotion-payment: order lookup failed', orderRes.status, JSON.stringify(order)?.slice(0, 300))
      return json({ status: promo.status, note: 'Could not reach the payment provider. Try again shortly.' })
    }

    const amountPaise = Math.round(Number(order.order_amount) * 100)
    const tags = order.order_tags ?? {}
    const consistent =
      amountPaise === promo.amount_paise && order.order_currency === 'INR' && tags.purpose === 'promotion' &&
      tags.promotion_id === promo.id && tags.seller_id === promo.seller_id && tags.listing_id === promo.listing_id
    if (!consistent) {
      console.error('verify-promotion-payment: order metadata mismatch', promo.cashfree_order_id)
      return json({ error: 'Order does not match this promotion.' }, 400)
    }

    if (order.order_status !== 'PAID') return json({ status: promo.status, orderStatus: order.order_status })

    // PAID: find the successful payment's id for the record.
    const payRes = await fetch(`${CASHFREE_BASE_URL}/orders/${encodeURIComponent(promo.cashfree_order_id)}/payments`, { headers })
    const payments = await payRes.json().catch(() => [])
    const success = Array.isArray(payments) ? payments.find((p: any) => p.payment_status === 'SUCCESS') : null

    const { error: rpcError } = await admin.rpc('activate_promotion', {
      p_order_id: promo.cashfree_order_id,
      p_payment_id: String(success?.cf_payment_id ?? ''),
      p_amount_paise: amountPaise,
    })
    if (rpcError) throw rpcError

    const { data: after } = await admin.from('promotions').select('status,expires_at').eq('id', promo.id).single()
    return json({ status: after?.status ?? 'active', expiresAt: after?.expires_at ?? null })
  } catch (e) {
    console.error('verify-promotion-payment error:', e)
    return json({ error: 'Could not verify the payment right now.' }, 500)
  }
})
