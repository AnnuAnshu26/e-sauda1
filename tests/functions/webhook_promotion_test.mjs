// Runs supabase/functions/cashfree-webhook/index.ts under Node with a stubbed Deno runtime, a fake
// Supabase client and a fake Cashfree API, to check the promotion branch's verification logic.
// Usage: node tests/functions/webhook_promotion_test.mjs   (needs esbuild, already a vite dependency)
import { build } from 'esbuild'
import crypto from 'node:crypto'
import fs from 'node:fs'

const SECRET = 'test-secret'
const stub = { name: 'stub', setup(b) {
  b.onResolve({ filter: /^npm:@supabase\/supabase-js/ }, () => ({ path: 'supa', namespace: 'stub' }))
  b.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({ contents: 'export const createClient = (...a) => globalThis.__makeClient(...a)', loader: 'js' }))
}}
const out = '/tmp/webhook_bundle.mjs'
await build({ entryPoints: ['supabase/functions/cashfree-webhook/index.ts'], bundle: true, format: 'esm', platform: 'node', outfile: out, plugins: [stub], logLevel: 'error' })

let handler
globalThis.Deno = { serve: (h) => { handler = h }, env: { get: (k) => ({ CASHFREE_SECRET_KEY: SECRET, CASHFREE_APP_ID: 'app', SUPABASE_URL: 'http://x', SUPABASE_SERVICE_ROLE_KEY: 'svc' })[k] } }

const state = { promo: null, rpcs: [], gatewayOrder: null }
globalThis.__makeClient = () => ({
  from: (t) => { const q = { select: () => q, eq: () => q, maybeSingle: async () => ({ data: t === 'promotions' ? state.promo : null, error: null }) }; return q },
  rpc: async (name, args) => { state.rpcs.push([name, args]); return { error: null } },
})
globalThis.fetch = async () => ({ ok: !!state.gatewayOrder, status: state.gatewayOrder ? 200 : 404, json: async () => state.gatewayOrder ?? {} })
await import(out)

const PROMO = { id: 'p1', seller_id: 's1', listing_id: 'l1', plan_code: 'listing_basic', amount_paise: 100, status: 'pending_payment' }
const ORDER = { order_amount: 1, order_currency: 'INR', order_status: 'PAID', order_tags: { purpose: 'promotion', promotion_id: 'p1', seller_id: 's1', listing_id: 'l1' } }
async function send(event, { sign = true, secret = SECRET } = {}) {
  const raw = JSON.stringify(event), ts = String(Date.now())
  const sig = sign ? crypto.createHmac('sha256', secret).update(ts + raw).digest('base64') : 'forged'
  const res = await handler(new Request('http://x', { method: 'POST', headers: { 'x-webhook-signature': sig, 'x-webhook-timestamp': ts }, body: raw }))
  return res.status
}
const ev = (status = 'SUCCESS') => ({ data: { order: { order_id: 'promo_abc' }, payment: { payment_status: status, cf_payment_id: 123 } } })
let ok = true
const check = (n, c) => { ok &&= !!c; console.log(c ? 'PASS' : 'FAIL', n) }
const reset = () => { state.rpcs = []; state.promo = { ...PROMO }; state.gatewayOrder = JSON.parse(JSON.stringify(ORDER)) }

reset(); check('forged signature -> 401, nothing activated', (await send(ev(), { sign: false })) === 401 && state.rpcs.length === 0)
reset(); check('signature made with the wrong secret -> 401', (await send(ev(), { secret: 'attacker' })) === 401 && state.rpcs.length === 0)
reset(); check('valid + PAID -> activate_promotion called with server-side amount', (await send(ev())) === 200 && state.rpcs[0]?.[0] === 'activate_promotion' && state.rpcs[0][1].p_amount_paise === 100 && state.rpcs[0][1].p_payment_id === '123')
reset(); state.gatewayOrder.order_amount = 0.5; check('amount tampered at gateway -> 400, nothing activated', (await send(ev())) === 400 && state.rpcs.length === 0)
reset(); state.gatewayOrder.order_tags.seller_id = 'someone-else'; check('order tags for another seller -> 400', (await send(ev())) === 400 && state.rpcs.length === 0)
reset(); state.gatewayOrder.order_status = 'ACTIVE'; check('webhook says SUCCESS but Cashfree says order not PAID -> not activated', (await send(ev())) === 200 && state.rpcs.length === 0)
reset(); check('FAILED payment -> fail_promotion', (await send(ev('FAILED'))) === 200 && state.rpcs[0]?.[0] === 'fail_promotion')
reset(); state.promo = null; check('unknown promo order -> ignored, 200, nothing called', (await send(ev())) === 200 && state.rpcs.length === 0)
reset(); state.gatewayOrder = null; check('Cashfree lookup fails -> 502 so Cashfree retries', (await send(ev())) === 502 && state.rpcs.length === 0)
reset(); await send(ev()); await send(ev()); check('duplicate delivery calls the idempotent SQL fn each time (safe)', state.rpcs.filter((r) => r[0] === 'activate_promotion').length === 2)
process.exit(ok ? 0 : 1)
