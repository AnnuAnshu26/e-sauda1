// Runs supabase/functions/verify-promotion-payment under Node with stubbed Deno/Supabase/Cashfree.
import { build } from 'esbuild'
const stub = { name: 'stub', setup(b) {
  b.onResolve({ filter: /^npm:@supabase\/supabase-js/ }, () => ({ path: 'supa', namespace: 'stub' }))
  b.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({ contents: 'export const createClient = (...a) => globalThis.__makeClient(...a)', loader: 'js' }))
}}
const out = '/tmp/verify_bundle.mjs'
await build({ entryPoints: ['supabase/functions/verify-promotion-payment/index.ts'], bundle: true, format: 'esm', platform: 'node', outfile: out, plugins: [stub], logLevel: 'error' })
let handler
globalThis.Deno = { serve: (h) => { handler = h }, env: { get: (k) => ({ CASHFREE_APP_ID: 'a', CASHFREE_SECRET_KEY: 's', SUPABASE_URL: 'http://x', SUPABASE_ANON_KEY: 'k', SUPABASE_SERVICE_ROLE_KEY: 'svc' })[k] } }
const PID = '11111111-1111-1111-1111-111111111111', USER = 'user-1'
const st = { rpcs: [], promo: null, order: null, payments: null, user: { id: USER } }
globalThis.__makeClient = (url, key, opts) => ({
  auth: { getUser: async () => ({ data: { user: st.user }, error: st.user ? null : {} }) },
  from: () => { const q = { _eq: {}, select: () => q, eq: (k, v) => { q._eq[k] = v; return q },
    maybeSingle: async () => ({ data: st.promo && (!q._eq.seller_id || q._eq.seller_id === st.promo.seller_id) ? st.promo : null, error: null }),
    single: async () => ({ data: { status: st.rpcs.length ? 'active' : st.promo.status, expires_at: '2026-12-01' } }) }; return q },
  rpc: async (n, a) => { st.rpcs.push([n, a]); return { error: null } },
})
globalThis.fetch = async (url) => {
  if (String(url).endsWith('/payments')) return { ok: true, status: 200, json: async () => st.payments }
  return { ok: !!st.order, status: st.order ? 200 : 404, json: async () => st.order ?? {} }
}
await import(out)
const base = () => { st.rpcs = []; st.user = { id: USER }
  st.promo = { id: PID, seller_id: USER, listing_id: 'l1', amount_paise: 100, status: 'pending_payment', cashfree_order_id: 'promo_x', expires_at: null }
  st.order = { order_amount: 1, order_currency: 'INR', order_status: 'PAID', order_tags: { purpose: 'promotion', promotion_id: PID, seller_id: USER, listing_id: 'l1' } }
  st.payments = [{ payment_status: 'FAILED', cf_payment_id: 1 }, { payment_status: 'SUCCESS', cf_payment_id: 2 }] }
const call = async (body = { promotionId: PID }, auth = 'Bearer t') => { const r = await handler(new Request('http://x', { method: 'POST', headers: auth ? { Authorization: auth } : {}, body: JSON.stringify(body) })); return [r.status, await r.json()] }
let ok = true; const check = (n, c) => { ok &&= !!c; console.log(c ? 'PASS' : 'FAIL', n) }

base(); let [s, b] = await call()
check('paid order -> activates with the SUCCESS payment id and the amount from Cashfree', s === 200 && b.status === 'active' && st.rpcs[0][0] === 'activate_promotion' && st.rpcs[0][1].p_payment_id === '2' && st.rpcs[0][1].p_amount_paise === 100)
base(); st.order.order_status = 'ACTIVE'; [s, b] = await call()
check('unpaid order -> stays pending, nothing activated', s === 200 && b.status === 'pending_payment' && st.rpcs.length === 0)
base(); st.promo.status = 'active'; st.promo.expires_at = '2026-12-01'; [s, b] = await call()
check('already active -> just reports, no Cashfree call/activation', b.status === 'active' && st.rpcs.length === 0)
base(); st.promo.seller_id = 'someone-else'; [s, b] = await call()
check("another seller's promotion -> 404", s === 404 && st.rpcs.length === 0)
base(); st.order.order_amount = 0.5; [s, b] = await call()
check('amount tampered -> 400, not activated', s === 400 && st.rpcs.length === 0)
base(); st.order.order_tags.listing_id = 'other'; [s, b] = await call()
check('order belongs to a different listing -> 400', s === 400 && st.rpcs.length === 0)
base(); st.user = null; [s] = await call()
check('not logged in -> 401', s === 401)
base(); [s] = await call({ promotionId: 'nope' })
check('bad id -> 400', s === 400)
base(); st.order = null; [s, b] = await call()
check('Cashfree unreachable -> stays pending, no crash', s === 200 && b.status === 'pending_payment' && st.rpcs.length === 0)
base(); st.promo.status = 'payment_failed'; [s, b] = await call()
check('previously failed attempt that later got paid -> activates', b.status === 'active' && st.rpcs.length === 1)
process.exit(ok ? 0 : 1)
