import sys, json, os
sys.path.insert(0, os.path.dirname(__file__))
import pg
srv = pg.boot_with_base(['chat_risk_scan_schema.sql'])
cases = json.load(open(os.path.join(os.path.dirname(__file__), 'cases.json')))
fails = 0
for body, level, must in cases:
    esc = body.replace("'", "''")
    out = srv.psql(f"select risk_level || '|' || array_to_string(reasons, ',') from public.scan_message_risk('{esc}')")
    line = [l.strip() for l in out.splitlines() if '|' in l and 'risk_level' not in l][0]
    got_level, got_reasons = line.split('|', 1)
    ok = got_level == level and all(r in got_reasons.split(',') for r in must)
    fails += (not ok)
    print(('PASS' if ok else 'FAIL'), f'[{got_level:6}] {got_reasons:32} <- {body}')
print(f'\n{len(cases)-fails}/{len(cases)} passed')
sys.exit(1 if fails else 0)
