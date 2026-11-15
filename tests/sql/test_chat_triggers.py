import sys, os
sys.path.insert(0, os.path.dirname(__file__))
import pg
srv = pg.boot_with_base(['chat_risk_scan_schema.sql'])
A='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'; B='bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
L='cccccccc-cccc-cccc-cccc-cccccccccccc'; C='dddddddd-dddd-dddd-dddd-dddddddddddd'
srv.psql(f"""
insert into auth.users(id,email) values ('{A}','a@x'),('{B}','b@x');
insert into public.profiles(id,display_name,is_admin) values ('{A}','Seller',false),('{B}','Buyer',false) on conflict do nothing;
insert into public.listings(id,owner_id,title,price,category,condition,location,emoji,bg) values ('{L}','{A}','Laptop',100,'Electronics','Good','Delhi','x','bg');
insert into public.conversations(id,listing_id,buyer_id,seller_id) values ('{C}','{L}','{B}','{A}');
""")
import psycopg2
conn = psycopg2.connect(srv.get_uri()); conn.autocommit = True
def err(sql):
    cur = conn.cursor()
    try:
        cur.execute(sql); return ''
    except Exception as e:
        return str(e)
def q(sql):
    return srv.psql(sql)
ok=True
def check(name, cond):
    global ok; ok &= bool(cond); print('PASS' if cond else 'FAIL', name)

# client LIES: sends flagged=false, no reasons
q(f"insert into public.messages(conversation_id,sender_id,body,flagged,flag_reasons) values ('{C}','{A}','pay advance 500 on rahul@ybl or call 9876543210 and send otp',false,'{{}}')")
out=q("select risk_level, flagged, array_to_string(flag_reasons,',') from public.messages")
check('client-supplied flagged=false is overridden', 'high' in out and ' t ' in out.replace('|',' ') or ('high' in out and 't' in out))
ev=q("select risk_level, excerpt, escalated from public.moderation_events")
check('audit event written', 'high' in ev)
check('excerpt has no phone/UPI id', '9876543210' not in ev and 'rahul@ybl' not in ev and '[number]' in ev and '[id]' in ev)
print(ev.strip())

# low-risk message creates no event
q(f"insert into public.messages(conversation_id,sender_id,body) values ('{C}','{B}','is it available?')")
check('low risk logs nothing', '(1 row)' in q("select 1 from public.moderation_events"))

# escalation after 3 highs in 24h
for i in range(2):
    q(f"insert into public.messages(conversation_id,sender_id,body) values ('{C}','{A}','send me the otp number {i}')")
check('3rd high-risk message escalates', 't' in q("select escalated from public.moderation_events order by created_at desc limit 1").split())

# too long
r=err(f"insert into public.messages(conversation_id,sender_id,body) values ('{C}','{A}','{'x'*2001}')")
check('2001-char message rejected', 'too long' in r)

# rate limit: 30 / minute
q(f"insert into public.messages(conversation_id,sender_id,body) select '{C}','{B}','hi '||g from generate_series(1,29) g")  # 29 + 1 earlier = 30 in the last minute
r=err(f"insert into public.messages(conversation_id,sender_id,body) values ('{C}','{B}','one more')")
check('rate limit blocks bursts', 'too quickly' in r)

# appeal
mid=[l.strip() for l in q("select id from public.messages where risk_level='high' limit 1").splitlines() if '-' in l and len(l.strip())==36][0]
r=err(f"select set_config('request.jwt.claim.sub','{B}',false); select public.appeal_message_flag('{mid}','mistake')")
check('non-sender cannot appeal', 'Nothing to appeal' in r)
q(f"select set_config('request.jwt.claim.sub','{A}',false); select public.appeal_message_flag('{mid}','this is a mistake');")
check('sender can appeal own flagged message', 'requested' in q("select appeal_status from public.moderation_events where appeal_status<>'none'"))
r=err(f"select set_config('request.jwt.claim.sub','{A}',false); select public.review_moderation_event((select id from public.moderation_events limit 1),'overturned','x')")
check('non-admin cannot review', 'Admins only' in r)
sys.exit(0 if ok else 1)
