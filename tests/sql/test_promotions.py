import sys, os
sys.path.insert(0, os.path.dirname(__file__))
import pg, psycopg2
srv = pg.boot_with_base(['chat_risk_scan_schema.sql', 'handover_dispute_schema.sql', 'promotions_schema.sql'])
S='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'; B='bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'; ADM='99999999-9999-9999-9999-999999999999'
L1='c0000000-0000-0000-0000-000000000001'; L2='c0000000-0000-0000-0000-000000000002'; L3='c0000000-0000-0000-0000-000000000003'
srv.psql(f"""
insert into auth.users(id,email) values ('{S}','s@x'),('{B}','b@x'),('{ADM}','adm@x');
insert into public.profiles(id,display_name,is_admin) values ('{S}','Seller',false),('{B}','Buyer',false),('{ADM}','Admin',true) on conflict (id) do update set is_admin=excluded.is_admin;
insert into public.listings(id,owner_id,title,price,category,condition,location,emoji,bg,video_url) values
 ('{L1}','{S}','Laptop',100,'E','Good','Delhi','x','bg','http://v/1.mp4'),
 ('{L2}','{S}','Phone',100,'E','Good','Delhi','x','bg',null),
 ('{L3}','{S}','Chair',100,'E','Good','Delhi','x','bg','http://v/3.mp4');
""")
conn = psycopg2.connect(srv.get_uri()); conn.autocommit = True
cur = conn.cursor()
def run(sql, uid=None, role=None):
    cur.execute("reset role"); 
    cur.execute("select set_config('request.jwt.claim.sub', %s, false)", (uid or '',))
    if role: cur.execute(f"set role {role}")
    cur.execute(sql)
    try: return cur.fetchall()
    except psycopg2.ProgrammingError: return None
def err(sql, uid=None, role=None):
    try: run(sql, uid, role); return ''
    except Exception as e: return str(e)
ok=True
def check(n,c):
    global ok; ok&=bool(c); print('PASS' if c else 'FAIL', n)
def mk(order, listing, plan='listing_basic', amount=100, days=3, reel=False):
    run(f"insert into public.promotions(listing_id,seller_id,plan_code,amount_paise,duration_days,includes_reel,cashfree_order_id) values ('{listing}','{S}','{plan}',{amount},{days},{str(reel).lower()},'{order}')")

check('seeded plans: Rs1 listing, Rs5 listing+reel', run("select code, price_paise, includes_reel from public.promotion_plans order by sort_order")==[('listing_basic',100,False),('listing_reel',500,True)])
check('plan below Rs1 rejected', 'check constraint' in err("insert into public.promotion_plans(code,name,price_paise,duration_days) values ('x','x',50,1)"))
check('anon can read active plans', run("select count(*) from public.promotion_plans", role='anon')[0][0]==2)
check('seller cannot edit plans', run("update public.promotion_plans set price_paise=100 where code='listing_reel' returning 1", S, 'authenticated') in ([], None))

mk('promo_1', L1)
check('clients cannot insert promotions (service role only)', 'permission denied' in err("insert into public.promotions(listing_id,seller_id,plan_code,amount_paise,duration_days,cashfree_order_id) values ('%s','%s','listing_basic',100,3,'promo_x')"%(L2,S), S, 'authenticated'))
check('only one live promotion per listing', 'unique' in err(f"insert into public.promotions(listing_id,seller_id,plan_code,amount_paise,duration_days,cashfree_order_id) values ('{L1}','{S}','listing_basic',100,3,'promo_dup')"))
check('pending promotion is NOT shown publicly', run("select count(*) from public.get_promoted_listings('listing',10)", role='anon')[0][0]==0)
check('clients cannot call activate_promotion', 'permission denied' in err("select public.activate_promotion('promo_1','pay1',100)", S, 'authenticated'))
check('wrong amount refused', 'does not match' in err("select public.activate_promotion('promo_1','pay1',1)"))
check('still pending after refused activation', run("select status from public.promotions where cashfree_order_id='promo_1'")[0][0]=='pending_payment')
run("select public.activate_promotion('promo_1','pay1',100)")
check('verified payment activates', run("select status, expires_at > now() + interval '2 days 23 hours' from public.promotions where cashfree_order_id='promo_1'")[0]==('active',True))
exp1=run("select expires_at from public.promotions where cashfree_order_id='promo_1'")[0][0]
run("select public.activate_promotion('promo_1','pay1',100)")
check('replayed webhook is idempotent (expiry unchanged, 1 notification)', run("select expires_at from public.promotions where cashfree_order_id='promo_1'")[0][0]==exp1 and run("select count(*) from public.notifications where type='promotion_active'")[0][0]==1)
check('active promotion appears publicly', [r[0] for r in run("select id from public.get_promoted_listings('listing',10)", role='anon')]==[L1])
check("'reel' scope only returns promotions that include the reel", run("select count(*) from public.get_promoted_listings('reel',10)", role='anon')[0][0]==0)

mk('promo_2', L3, 'listing_reel', 500, 7, True); run("select public.activate_promotion('promo_2','pay2',500)")
check("reel plan shows in reel scope", [r[0] for r in run("select id from public.get_promoted_listings('reel',10)", role='anon')]==[L3])
mk('promo_3', L2, 'listing_reel', 500, 7, True); run("select public.activate_promotion('promo_3','pay3',500)")
check('reel plan but listing has no video: excluded from reels, included in listings', run("select count(*) from public.get_promoted_listings('reel',10)", role='anon')[0][0]==1 and run("select count(*) from public.get_promoted_listings('listing',10)", role='anon')[0][0]==3)

run(f"update public.listings set status='sold' where id='{L2}'")
check('sold listing stops being promoted', run("select count(*) from public.get_promoted_listings('listing',10)", role='anon')[0][0]==2)
run("update public.promotions set expires_at = now() - interval '1 minute' where cashfree_order_id='promo_1'")
check('expired promotion gets NO placement even before status is swept', run("select count(*) from public.get_promoted_listings('listing',10)", role='anon')[0][0]==1)
check('expire_promotions flips status', run("select public.expire_promotions()")[0][0]==1 and run("select status from public.promotions where cashfree_order_id='promo_1'")[0][0]=='expired')

# failure then success on the same order (Cashfree allows retries within one order)
run(f"update public.listings set status='active' where id='{L2}'")
mk('promo_4', L1)   # L1's earlier promo is expired, so a new one is allowed
run("select public.fail_promotion('promo_4')")
check('failed attempt recorded', run("select status from public.promotions where cashfree_order_id='promo_4'")[0][0]=='payment_failed')
run("select public.activate_promotion('promo_4','pay4',100)")
check('user retried inside the same order and paid: activates', run("select status from public.promotions where cashfree_order_id='promo_4'")[0][0]=='active')

# paid but listing gone -> under_review, never shown
run(f"update public.listings set status='removed' where id='{L3}'")
run("update public.promotions set status='expired' where cashfree_order_id='promo_3'")
mk('promo_5', L2); run(f"update public.listings set status='removed' where id='{L2}'"); run("select public.activate_promotion('promo_5','pay5',100)")
check('paid-but-listing-removed goes to under_review, not live', run("select status from public.promotions where cashfree_order_id='promo_5'")[0][0]=='under_review')
# late payment on a cancelled order -> under_review
run(f"update public.listings set status='active' where id='{L2}'")
mk('promo_6', L2); run("update public.promotions set status='cancelled' where cashfree_order_id='promo_6'")
run("select public.activate_promotion('promo_6','pay6',100)")
check('late payment on a cancelled order is held for review', run("select status from public.promotions where cashfree_order_id='promo_6'")[0][0]=='under_review')

# admin
check('non-admin cannot pause', 'Admins only' in err("select public.admin_set_promotion_status((select id from public.promotions where cashfree_order_id='promo_4'),'paused')", S, 'authenticated'))
run("select public.admin_set_promotion_status((select id from public.promotions where cashfree_order_id='promo_4'),'paused','suspicious')", ADM, 'authenticated')
check('paused promotion stops showing', run("select count(*) from public.get_promoted_listings('listing',10)", role='anon')[0][0]==0)
check('admin cannot resume an expired promotion', 'already expired' in err("select public.admin_set_promotion_status((select id from public.promotions where cashfree_order_id='promo_1'),'active')", ADM, 'authenticated'))
st=run("select * from public.admin_promotion_stats()", ADM, 'authenticated')[0]
check(f'admin stats: revenue Rs {st[0]/100:g} from paid orders', st[0]==100+500+500+100+100+100 and st[3]==0)
check('seller sees only own promotions; stranger sees none', run("select count(*) from public.promotions", S, 'authenticated')[0][0]>0 and run("select count(*) from public.promotions", B, 'authenticated')[0][0]==0)
sys.exit(0 if ok else 1)
