import { createClient } from 'npm:@supabase/supabase-js@2'

const API_VERSION = Deno.env.get('CASHFREE_API_VERSION') || '2025-01-01'
const CASHFREE_BASE_URL = 'https://api.cashfree.com/pg'

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function toBase64(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

async function verifySignature(rawBody: string, timestamp: string, signature: string, secret: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signed = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(timestamp + rawBody),
  )
  const expected = toBase64(new Uint8Array(signed))
  if (expected.length !== signature.length) return false
  let mismatch = 0
  for (let i = 0; i < expected.length; i++) mismatch |= expected.charCodeAt(i) ^ signature.charCodeAt(i)
  return mismatch === 0
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  try {
    const secret = Deno.env.get('CASHFREE_WEBHOOK_SECRET') || Deno.env.get('CASHFREE_SECRET_KEY')
    const appId = Deno.env.get('CASHFREE_APP_ID')
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!secret || !appId || !supabaseUrl || !serviceKey) {
      console.error('Cashfree webhook configuration is incomplete.')
      return json({ error: 'Webhook is not configured.' }, 500)
    }

    const signature = req.headers.get('x-webhook-signature') || ''
    const timestamp = req.headers.get('x-webhook-timestamp') || ''
    const rawBody = await req.text()
    if (!signature || !timestamp || !(await verifySignature(rawBody, timestamp, signature, secret))) {
      return json({ error: 'Invalid webhook signature.' }, 401)
    }

    const event = JSON.parse(rawBody)
    const orderId = event?.data?.order?.order_id
    const payment = event?.data?.payment
    if (typeof orderId !== 'string' || !payment) {
      // A valid but unrelated event is acknowledged without mutating any payment.
      return json({ received: true, ignored: true })
    }

    const admin = createClient(supabaseUrl, serviceKey)

    // Promotion payments (order ids are prefixed `promo_`) are handled separately; the listing-fee
    // flow below is untouched. The signature above is already verified for both.
    if (orderId.startsWith('promo_')) {
      return await handlePromotionEvent(admin, orderId, payment, appId)
    }

    const { data: localPayment, error: lookupError } = await admin
      .from('cashfree_listing_fee_payments')
      .select('cashfree_order_id,listing_id,seller_id,category,amount,currency,status')
      .eq('cashfree_order_id', orderId)
      .maybeSingle()
    if (lookupError) throw lookupError
    if (!localPayment) return json({ received: true, ignored: true })

    // Fetch the order directly from Cashfree as a second authoritative check.
    const gatewayResponse = await fetch(
      `${CASHFREE_BASE_URL}/orders/${encodeURIComponent(orderId)}`,
      {
        headers: {
          Accept: 'application/json',
          'x-api-version': API_VERSION,
          'x-client-id': appId,
          'x-client-secret': secret,
        },
      },
    )
    const gatewayOrder = await gatewayResponse.json().catch(() => ({}))
    if (!gatewayResponse.ok) {
      console.error('Cashfree webhook order lookup failed:', gatewayResponse.status)
      return json({ error: 'Could not verify order with Cashfree.' }, 502)
    }

    const validMetadata =
      Number(gatewayOrder.order_amount) === Number(localPayment.amount) &&
      gatewayOrder.order_currency === localPayment.currency &&
      gatewayOrder.order_tags?.seller_id === localPayment.seller_id &&
      gatewayOrder.order_tags?.listing_id === localPayment.listing_id &&
      gatewayOrder.order_tags?.category === localPayment.category

    if (!validMetadata) {
      console.error('Cashfree webhook metadata mismatch:', orderId)
      return json({ error: 'Order metadata mismatch.' }, 400)
    }

    if (gatewayOrder.order_status === 'PAID' && payment.payment_status === 'SUCCESS') {
      const { error: updateError } = await admin
        .from('cashfree_listing_fee_payments')
        .update({
          status: 'PAID',
          cashfree_payment_id: String(payment.cf_payment_id || ''),
          paid_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('cashfree_order_id', orderId)
        .eq('seller_id', localPayment.seller_id)
      if (updateError) throw updateError
    }

    // Updating the same order to PAID repeatedly is intentionally idempotent.
    return json({ received: true })
  } catch (error) {
    console.error('cashfree-webhook error:', error)
    return json({ error: 'Webhook processing failed.' }, 500)
  }
})

// Verifies a promotion payment against Cashfree itself (never trusts the webhook body alone) and then
// calls the service-role-only SQL functions. activate_promotion is idempotent, so retries are safe.
async function handlePromotionEvent(
  admin: ReturnType<typeof createClient>,
  orderId: string,
  payment: { payment_status?: string; cf_payment_id?: string | number },
  appId: string,
) {
  const apiSecret = Deno.env.get('CASHFREE_SECRET_KEY')
  if (!apiSecret) return json({ error: 'Webhook is not configured.' }, 500)

  const { data: promo, error } = await admin
    .from('promotions')
    .select('id,seller_id,listing_id,plan_code,amount_paise,status')
    .eq('cashfree_order_id', orderId)
    .maybeSingle()
  if (error) throw error
  if (!promo) return json({ received: true, ignored: true })

  const res = await fetch(`${CASHFREE_BASE_URL}/orders/${encodeURIComponent(orderId)}`, {
    headers: { Accept: 'application/json', 'x-api-version': API_VERSION, 'x-client-id': appId, 'x-client-secret': apiSecret },
  })
  const order = await res.json().catch(() => ({}))
  if (!res.ok) {
    console.error('Cashfree promotion order lookup failed:', res.status)
    return json({ error: 'Could not verify order with Cashfree.' }, 502) // non-2xx => Cashfree retries
  }

  const amountPaise = Math.round(Number(order.order_amount) * 100)
  const tags = order.order_tags ?? {}
  const consistent =
    amountPaise === promo.amount_paise &&
    order.order_currency === 'INR' &&
    tags.purpose === 'promotion' &&
    tags.promotion_id === promo.id &&
    tags.seller_id === promo.seller_id &&
    tags.listing_id === promo.listing_id
  if (!consistent) {
    console.error('Promotion webhook metadata mismatch:', orderId)
    return json({ error: 'Order metadata mismatch.' }, 400)
  }

  if (order.order_status === 'PAID' && payment.payment_status === 'SUCCESS') {
    const { error: rpcError } = await admin.rpc('activate_promotion', {
      p_order_id: orderId,
      p_payment_id: String(payment.cf_payment_id ?? ''),
      p_amount_paise: amountPaise,
    })
    if (rpcError) throw rpcError
  } else if (payment.payment_status === 'FAILED' || payment.payment_status === 'USER_DROPPED') {
    await admin.rpc('fail_promotion', { p_order_id: orderId })
  }
  return json({ received: true })
}
