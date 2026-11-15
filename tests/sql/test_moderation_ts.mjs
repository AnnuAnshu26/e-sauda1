// Parity check: runs the SAME cases the Postgres scanner is tested with through the TS mirror.
// Usage: npx esbuild src/lib/moderation.ts --format=esm --outfile=/tmp/moderation.mjs && node tests/sql/test_moderation_ts.mjs
import { scanMessage } from '/tmp/moderation.mjs'
import fs from 'node:fs'
const cases = JSON.parse(fs.readFileSync(new URL('./cases.json', import.meta.url)))
let fails = 0
for (const [body, level, must] of cases) {
  const r = scanMessage(body)
  const ok = r.level === level && must.every((m) => r.reasons.includes(m))
  if (!ok) fails++
  console.log(ok ? 'PASS' : 'FAIL', `[${r.level}]`, r.reasons.join(','), '<-', body)
}
console.log(`\n${cases.length - fails}/${cases.length} passed`)
process.exit(fails ? 1 : 0)
