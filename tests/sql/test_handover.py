import sys, os
sys.path.insert(0, os.path.dirname(__file__))
import pg, psycopg2
srv = pg.boot_with_base(['chat_risk_scan_schema.sql', 'handover_dispute_schema.sql'])
S='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'; B='bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'; X='eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'; ADM='99999999-9999-9999-9999-999999999999'
L='cccccccc-cccc-cccc-cccc-cccccccccccc'; C='dddddddd-dddd-dddd-dddd-dddddddddddd'; C2='dddddddd-dddd-dddd-dddd-ddddddddddd2'
srv.psql(f"""
insert into auth.users(id,email) values ('{S}','s@x'),('{B}','b@x'),('{X}','x@x'),('{ADM}','adm@x');
insert into public.profiles(id,display_name,is_admin) values ('{S}','Seller',false),('{B}','Buyer',false),('{X}','Other',false),('{ADM}','Admin',true) on conflict (id) do update set is_admin=excluded.is_admin;
insert into public.listings(id,owner_id,title,price,category,condition,location,emoji,bg) values ('{L}','{S}','Laptop',100,'Electronics','Good','Delhi','x','bg');
insert into public.conversations(id,listing_id,buyer_id,seller_id) values ('{C}','{L}','{B}','{S}'),('{C2}','{L}','{X}','{S}');
insert into public.messages(conversation_id,sender_id,body) values ('{C}','{B}','hello');
""")
conn = psycopg2.connect(srv.get_uri()); conn.autocommit = True
def run(uid, sql):
    cur = conn.cursor()
    cur.execute("select set_config('request.jwt.claim.sub', %s, false)", (uid,))
    cur.execute(sql); 
    try: return cur.fetchall()
    except psycopg2.ProgrammingError: return None
def err(uid, sql):
    try: run(uid, sql); return ''
    except Exception as e: return str(e)
def role(r):  # run subsequent statements as a restricted role to test RLS
    conn.cursor().execute(f"set role {r}" if r else "reset role")
ok=True
def check(n,c):
    global ok; ok&=bool(c); print('PASS' if c else 'FAIL', n)

check('stranger cannot confirm', 'not found' in err(X, f"select public.confirm_handover('{C}')"))
run(S, f"select public.confirm_handover('{C}','handed over at metro')")
h=run(S, "select seller_confirmed_at is not null, buyer_confirmed_at is not null, completed_at is not null from public.deal_handovers")[0]
check('seller confirm recorded, not yet complete', h==(True,False,False))
check('buyer notified of seller confirmation', run(B,"select count(*) from public.notifications where user_id='"+B+"' and type='handover_confirmed'")[0][0]==1)
run(S, f"select public.confirm_handover('{C}')")   # idempotent
check('repeat confirm is idempotent (no 2nd notification)', run(S,"select count(*) from public.notifications where type='handover_confirmed'")[0][0]==1)
check('listing still active before both confirm', run(S,f"select status from public.listings where id='{L}'")[0][0]=='active')
run(B, f"select public.confirm_handover('{C}','received, works fine')")
h=run(B, "select completed_at is not null from public.deal_handovers")[0]
check('deal completes when both confirmed', h==(True,))
check('listing auto-marked sold', run(B,f"select status from public.listings where id='{L}'")[0][0]=='sold')
check('both notified of completion', run(B,"select count(*) from public.notifications where type='deal_completed'")[0][0]==2)
check('deal stats: seller 1 sold', run(S,f"select sold_count, bought_count from public.get_user_deal_stats('{S}')")[0]==(1,0))
check('deal stats: buyer 1 bought', run(S,f"select sold_count, bought_count from public.get_user_deal_stats('{B}')")[0]==(0,1))
check('another buyer cannot start a 2nd handover for the same sold listing', 'no longer available' in err(X, f"select public.confirm_handover('{C2}')"))
check('RLS: other buyer cannot see handover rows', (role('authenticated'), run(X,"select count(*) from public.deal_handovers")[0][0], role(None))[1]==0)
role('authenticated')
e1 = err(B,"update public.deal_handovers set completed_at=null")
e2 = err(B,"insert into public.deal_disputes(conversation_id,listing_id,raised_by,against_user,reason,description) values (gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),'other','xxxxxxxxxxxx')")
e3 = err(B,"update public.listings set status='sold' where id='"+L+"'")
role(None)
check('RLS: clients cannot update handovers directly', 'permission denied' in e1)
check('RLS: clients cannot insert disputes directly', 'permission denied' in e2)
role(None)

# ---- disputes
check('short description rejected by check constraint', 'violates check constraint' in err(B, f"select public.open_dispute('{C}','not_received','short')"))
run(B, f"select public.open_dispute('{C}','not_as_described','Screen has a crack that was not in the photos')")
check('dispute opened', run(B,"select count(*) from public.deal_disputes")[0][0]==1)
check('other party notified', run(S,"select count(*) from public.notifications where type='dispute_opened' and user_id='"+S+"'")[0][0]==1)
check('duplicate live dispute blocked', 'already have an open dispute' in err(B, f"select public.open_dispute('{C}','damaged','Another report about the same thing')"))
check('stranger cannot open dispute', 'not found' in err(X, f"select public.open_dispute('{C}','other','I am not a participant here ok')"))
did=run(B,"select id from public.deal_disputes")[0][0]
check('non-admin cannot resolve', 'Admins only' in err(B, f"select public.resolve_dispute('{did}','resolved','x')"))
check('resolution note required', 'note is required' in err(ADM, f"select public.resolve_dispute('{did}','resolved','')"))
role('authenticated')
check('admin can read chat of a disputed conversation', run(ADM, f"select count(*) from public.messages where conversation_id='{C}'")[0][0]>=1)
check('admin cannot read chats WITHOUT a dispute', run(ADM, f"select count(*) from public.messages where conversation_id='{C2}'")[0][0]==0)
role(None)
run(ADM, f"select public.resolve_dispute('{did}','resolved','Seller agreed to a partial refund in cash')")
check('dispute resolved + both notified', run(S,"select count(*) from public.notifications where type='dispute_resolved'")[0][0]==2)
check('can raise a new dispute after closure', run(B, f"select public.open_dispute('{C}','other','Following up with a new concern here')") is not None)
sys.exit(0 if ok else 1)
