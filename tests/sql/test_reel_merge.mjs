// Unit test for mergeSponsoredReels (Explore ordering). Run: npx esbuild src/lib/promotions.ts --bundle --format=esm --platform=node --external:./supabase --outfile=/tmp/promo.mjs ...
import { build } from 'esbuild'
await build({ stdin: { contents: `export { mergeSponsoredReels } from './src/lib/promotions.ts'`, resolveDir: process.cwd(), loader: 'ts' }, bundle: true, format: 'esm', platform: 'node', outfile: '/tmp/promo_merge.mjs', logLevel: 'error',
  plugins: [{ name: 'stub', setup(b) { b.onResolve({ filter: /supabase|edgeFunctions|listingFee|listings$/ }, (a) => ({ path: a.path, namespace: 'stub' })); b.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({ contents: 'export const supabase={}; export const invokeFunction=()=>{}; export const loadCashfreeSdk=()=>{}; export const normalizeIndianMobile=()=>{}; export const mapRow=()=>{}', loader: 'js' })) } }] })
const { mergeSponsoredReels: m } = await import('/tmp/promo_merge.mjs')
const L = (...ids) => ids.map((id) => ({ id }))
const ids = (a) => a.map((x) => x.id).join(',')
let ok = true; const check = (n, c) => { ok &&= c; console.log(c ? 'PASS' : 'FAIL', n) }
check('sponsored reel is FIRST', ids(m(L('a','b','c','d','e','f'), L('S1'))) === 'S1,a,b,c,d,e,f')
check('works with ZERO organic reels (old logic showed nothing for <4)', ids(m(L(), L('S1','S2'))) === 'S1,S2')
check('works with 2 organic reels (old logic dropped the paid reel)', ids(m(L('a','b'), L('S1'))) === 'S1,a,b')
check('2nd sponsored reel after every 4 organic', ids(m(L('a','b','c','d','e'), L('S1','S2'))) === 'S1,a,b,c,d,S2,e')
check('never shows a reel twice (sponsored removed from organic)', ids(m(L('a','S1','b'), L('S1'))) === 'S1,a,b')
check('no sponsored -> organic unchanged', ids(m(L('a','b'), L())) === 'a,b')
process.exit(ok ? 0 : 1)
