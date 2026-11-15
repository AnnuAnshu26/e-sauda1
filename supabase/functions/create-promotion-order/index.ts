// Creates a Cashfree order for promoting a listing. The PRICE, DURATION and PLAN come from the
// promotion_plans table -- never from the client. Activation happens only in cashfree-webhook after the
// payment is verified; nothing here (or in the browser) can mark a promotion as paid.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

const API_VERSION = Deno.env.get('CASHFREE_API_VERSION') || '2025-01-01'
const CASHFREE_BASE_URL = 'https://api.cashfree.com/pg'
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const PENDING_REUSE_MS = 25 * 60_000 // reuse an unpaid checkout session for up to 25 minutes

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
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
    if (!appId || !secretKey || !supabaseUrl || !anonKey || !serviceKey) {
      return json({ error: 'Payment configuration is incomplete.' }, 500)
    }

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Authentication required.' }, 401)
    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } })
    const { data: { user }, error: authError } = await userClient.auth.getUser()
    if (authError || !user) return json({ error: 'Not authenticated.' }, 401)

    const body = await req.json().catch(() => ({}))
    const listingId = body?.listingId
    const planCode = body?.planCode
    if (typeof listingId !== 'string' || !UUID_RE.test(listingId)) return json({ error: 'A valid listing is required.' }, 400)
    if (typeof planCode !== 'string' || !/^[a-z0-9_]{1,40}$/.test(planCode)) return json({ error: 'A valid plan is required.' }, 400)
    let phone = String(body?.customerPhone ?? '').replace(/\D/g, '')
    if (phone.length === 12 && phone.startsWith('91')) phone = phone.slice(2)
    else if (phone.length === 11 && phone.startsWith('0')) phone = phone.slice(1)
    if (!/^[6-9]\d{9}$/.test(phone)) return json({ error: 'A valid 10-digit Indian mobile number is required.' }, 400)

    const admin = createClient(supabaseUrl, serviceKey)
    await admin.rpc('expire_promotions') // free the "one live promotion per listing" slot if one just lapsed

    // Ownership + eligibility: must be the seller's own, still-active listing.
    const { data: listing, error: listingError } = await admin
      .from('listings').select('id,owner_id,title,status').eq('id', listingId).maybeSingle()
    if (listingError) throw listingError
    if (!listing || listing.owner_id !== user.id) return json({ error: 'You can only promote your own listings.' }, 403)
    if (listing.status !== 'active') return json({ error: 'Only active listings can be promoted.' }, 409)

    const { data: plan, error: planError } = await admin
      .from('promotion_plans').select('*').eq('code', planCode).eq('is_active', true).maybeSingle()
    if (planError) throw planError
    if (!plan) return json({ error: 'That promotion plan is not available.' }, 404)

    // What is already in flight for this listing?
    const { data: live, error: liveError } = await admin
      .from('promotions')
      .select('id,status,plan_code,cashfree_order_id,payment_session_id,amount_paise,expires_at,created_at')
      .eq('listing_id', listingId)
      .in('status', ['pending_payment', 'active', 'paused'])
      .limit(1).maybeSingle()
    if (liveError) throw liveError

    if (live && live.status !== 'pending_payment') {
      return json({ error: live.status === 'paused'
        ? 'This listing\'s promotion is paused by our team.'
        : `This listing is already promoted until ${new Date(live.expires_at).toLocaleDateString('en-IN')}.` }, 409)
    }
    if (live?.status === 'pending_payment') {
      const fresh = Date.now() - new Date(live.created_at).getTime() < PENDING_REUSE_MS
      if (fresh && live.plan_code === planCode && live.payment_session_id) {
        // Idempotent: same listing + plan + still-fresh checkout session -> hand back the same order.
        return json({ promotionId: live.id, orderId: live.cashfree_order_id, paymentSessionId: live.payment_session_id, amountPaise: live.amount_paise, reused: true })
      }
      // Different plan or stale session: retire it (a late payment on it is held for human review).
      await admin.from('promotions').update({ status: 'cancelled', updated_at: new Date().toISOString() }).eq('id', live.id)
    }

    const orderId = `promo_${crypto.randomUUID().replaceAll('-', '')}`
    const { data: row, error: insertError } = await admin.from('promotions').insert({
      listing_id: listingId,
      seller_id: user.id,
      plan_code: plan.code,
      amount_paise: plan.price_paise,
      duration_days: plan.duration_days,
      includes_reel: plan.includes_reel,
      status: 'pending_payment',
      cashfree_order_id: orderId,
    }).select('id').single()
    if (insertError) {
      if (insertError.code === '23505') return json({ error: 'A promotion for this listing is already being set up. Retry in a moment.' }, 409)
      throw insertError
    }

    const appUrl = Deno.env.get('APP_URL') || req.headers.get('origin')
    if (!appUrl) throw new Error('APP_URL is not configured.')
    const gatewayResponse = await fetch(`${CASHFREE_BASE_URL}/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json', Accept: 'application/json',
        'x-api-version': API_VERSION, 'x-client-id': appId, 'x-client-secret': secretKey,
        'x-idempotency-key': orderId,
      },
      body: JSON.stringify({
        order_id: orderId,
        order_amount: plan.price_paise / 100,
        order_currency: 'INR',
        customer_details: {
          customer_id: user.id,
          customer_name: String(user.user_metadata?.display_name || 'e-Sauda seller').slice(0, 100),
          customer_email: String(user.email || '').slice(0, 100),
          customer_phone: phone,
        },
        order_meta: {
          return_url: `${appUrl.replace(/\/$/, '')}/my-listings?promo_return=1`,
          notify_url: `${supabaseUrl}/functions/v1/cashfree-webhook`,
        },
        order_note: `e-Sauda promotion: ${plan.name}`.slice(0, 200),
        order_tags: { purpose: 'promotion', promotion_id: row.id, listing_id: listingId, seller_id: user.id, plan_code: plan.code },
      }),
    })
    const gatewayData = await gatewayResponse.json().catch(() => ({}))
    if (!gatewayResponse.ok || !gatewayData.payment_session_id) {
      console.error('Cashfree create promotion order failed:', gatewayResponse.status, gatewayData)
      await admin.from('promotions').update({ status: 'payment_failed', updated_at: new Date().toISOString() }).eq('id', row.id)
      return json({ error: 'The payment provider could not start the payment. Please try again.' }, 502)
    }
    await admin.from('promotions')
      .update({ payment_session_id: gatewayData.payment_session_id, updated_at: new Date().toISOString() })
      .eq('id', row.id)

    return json({ promotionId: row.id, orderId, paymentSessionId: gatewayData.payment_session_id, amountPaise: plan.price_paise })
  } catch (error) {
    console.error('create-promotion-order error:', error)
    return json({ error: 'Unexpected server error while creating the promotion order.' }, 500)
  }
})
