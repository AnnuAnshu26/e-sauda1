"""Browser test of the new UI (chat warnings, deal panel, promote modal, sponsored labels) against a
mocked Supabase backend. Usage:  VITE_SUPABASE_URL=https://mock.supabase.co VITE_SUPABASE_ANON_KEY=x \
npx vite build --outDir /tmp/dist-e2e && python3 tests/e2e/c2c_features_e2e.py /tmp/dist-e2e"""
import json, sys, threading, http.server, socketserver, os, base64
from playwright.sync_api import sync_playwright

DIST = sys.argv[1] if len(sys.argv) > 1 else '/tmp/dist-e2e'
UID='11111111-1111-1111-1111-111111111111'; OTHER='22222222-2222-2222-2222-222222222222'
CONV='33333333-3333-3333-3333-333333333333'; LISTING='44444444-4444-4444-4444-444444444444'
PROMO='55555555-5555-5555-5555-555555555555'; ORG='66666666-6666-6666-6666-666666666666'
b64=lambda o: base64.urlsafe_b64encode(json.dumps(o).encode()).rstrip(b'=').decode()
jwt=f"{b64({'alg':'HS256','typ':'JWT'})}.{b64({'sub':UID,'role':'authenticated','exp':4102444800})}.sig"
session={'access_token':jwt,'refresh_token':'r','expires_in':3600,'expires_at':4102444800,'token_type':'bearer','user':{'id':UID,'aud':'authenticated','role':'authenticated','email':'me@example.com','app_metadata':{},'user_metadata':{},'created_at':'2024-01-01T00:00:00Z'}}
def listing(i,title,video=None): return {'id':i,'owner_id':OTHER,'title':title,'price':25000,'category':'Electronics','sub_category':'Laptops','condition':'Good','description':'d','city':'Delhi','location':'Delhi','distance_km':0,'emoji':'💻','bg':'bg-cream-dark','status':'active','created_at':'2026-11-01T00:00:00Z','photo_urls':[],'video_url':video,'latitude':None,'longitude':None}
L_ORG=listing(ORG,'Organic Desk','http://127.0.0.1:8841/o.mp4'); L_PROMO=listing(PROMO,'Promoted Laptop','http://127.0.0.1:8841/p.mp4'); L_MINE={**listing(LISTING,'My Camera'),'owner_id':UID}
profile={'id':UID,'display_name':'Test User','city':'Delhi','trust_score':50,'verified':False,'rating_avg':None,'rating_count':0,'is_admin':False,'suspended':False}
conv={'id':CONV,'listing_id':LISTING,'buyer_id':UID,'seller_id':OTHER,'created_at':'2026-11-01T00:00:00Z','listings':{'title':'Used laptop','price':25000,'emoji':'💻','photo_urls':[],'status':'active'}}
def msg(i,sender,body,level='low',reasons=()): return {'id':f'm{i}','conversation_id':CONV,'sender_id':sender,'body':body,'created_at':f'2026-11-10T08:{i:02d}:00Z','flagged':level!='low','flag_reasons':list(reasons),'risk_level':level}
msgs=[msg(1,UID,'Hi, is it available?'),msg(2,OTHER,'Yes. Send advance and scan this QR','high',['advance_payment','qr_payment']),msg(3,UID,'check https://example.com/x','medium',['external_link'])]
plans=[{'code':'listing_basic','name':'Promote listing','description':'Shown in Promoted section','price_paise':100,'duration_days':3,'includes_reel':False},
       {'code':'listing_reel','name':'Promote listing + reel','description':'Plus Explore reel','price_paise':500,'duration_days':7,'includes_reel':True}]
state={'rpcs':[], 'verify':'unpaid'}
pending_promo={'id':'77777777-7777-7777-7777-777777777777','listing_id':LISTING,'plan_code':'listing_reel','amount_paise':500,'duration_days':7,'includes_reel':True,'status':'pending_payment','starts_at':None,'expires_at':None,'created_at':'2026-11-20T08:00:00Z'}

def handle(route):
    req=route.request; url=req.url; single='vnd.pgrst.object' in req.headers.get('accept','')
    H={'access-control-allow-origin':'*','access-control-allow-headers':'*','content-range':'0-0/*'}
    ok=lambda d: route.fulfill(status=200,content_type='application/json',headers=H,body=json.dumps(d))
    if req.method=='OPTIONS': return route.fulfill(status=204,headers={**H,'access-control-allow-methods':'*'})
    if '/rest/v1/rpc/' in url:
        name=url.split('/rpc/')[1].split('?')[0]; body=req.post_data_json if req.post_data else {}
        state['rpcs'].append((name,body))
        if name=='get_promoted_listings': return ok([L_PROMO] if body.get('p_scope')=='listing' else [L_PROMO])
        if name=='confirm_handover': return ok({'id':'h1','conversation_id':CONV,'listing_id':LISTING,'buyer_id':UID,'seller_id':OTHER,'seller_confirmed_at':None,'buyer_confirmed_at':'2026-11-10T09:00:00Z','completed_at':None})
        if name=='open_dispute': return ok({'id':'d1','conversation_id':CONV,'listing_id':LISTING,'raised_by':UID,'against_user':OTHER,'reason':body.get('p_reason'),'description':body.get('p_description'),'status':'open','resolution_note':None,'created_at':'2026-11-10T09:05:00Z','resolved_at':None})
        return ok(None)
    if '/functions/v1/verify-promotion-payment' in url:
        if state['verify']=='unpaid': return route.fulfill(status=200,content_type='application/json',headers=H,body=json.dumps({'status':'pending_payment','orderStatus':'ACTIVE','message':'Cashfree reports this order as ACTIVE, not paid. If money was deducted from your account, it may still be settling: try again in a few minutes.'}))
        if state['verify']=='paid': return route.fulfill(status=200,content_type='application/json',headers=H,body=json.dumps({'status':'active','message':'Payment confirmed. Your promotion is live.'}))
        return route.fulfill(status=404,content_type='application/json',headers=H,body=json.dumps({'code':'NOT_FOUND','message':'Requested function was not found'}))
    if '/rest/v1/promotions' in url: return ok([pending_promo])
    if '/rest/v1/profiles' in url: return ok(profile if single else [profile])
    if '/rest/v1/promotion_plans' in url: return ok(plans)
    if '/rest/v1/conversations' in url: return ok([conv])
    if '/rest/v1/messages' in url: return ok(msgs[-1] if single else msgs)
    if '/rest/v1/listings' in url:
        if 'owner_id=eq' in url: return ok([L_MINE])
        return ok([L_ORG,L_PROMO])
    if '/rest/v1/notifications' in url: return ok([])
    if single: return route.fulfill(status=406,content_type='application/json',headers=H,body=json.dumps({'code':'PGRST116','message':'none','details':'','hint':''}))
    ok([])

def serve(directory,port):
    class Hh(http.server.SimpleHTTPRequestHandler):
        def __init__(s,*a,**k): super().__init__(*a,directory=directory,**k)
        def log_message(s,*a): pass
        def do_GET(s):
            if not os.path.isfile(s.translate_path(s.path)): s.path='/index.html'
            return super().do_GET()
    socketserver.TCPServer.allow_reuse_address=True
    srv=socketserver.TCPServer(('127.0.0.1',port),Hh); threading.Thread(target=srv.serve_forever,daemon=True).start()

ok_all=True
def check(n,c):
    global ok_all; ok_all&=bool(c); print('PASS' if c else 'FAIL',n)

serve(DIST,8841)
with sync_playwright() as p:
    b=p.chromium.launch()
    for vp_name,vp in [('desktop',{'width':1280,'height':800}),('mobile',{'width':375,'height':740})]:
        print('---',vp_name); state['rpcs'].clear()
        ctx=b.new_context(viewport=vp)
        ctx.add_init_script(f"localStorage.setItem('sb-mock-auth-token', {json.dumps(json.dumps(session))})")
        ctx.route('https://mock.supabase.co/**',handle)
        pg=ctx.new_page(); errs=[]; pg.on('pageerror',lambda e: errs.append(str(e)))
        base='http://127.0.0.1:8841'
        noh=lambda: not pg.evaluate("document.documentElement.scrollWidth>innerWidth")

        # ---------- Home: sponsored section, deduped
        pg.goto(base+'/'); pg.wait_for_selector('text=Promoted listings'); pg.wait_for_timeout(600)
        check('Home shows a Promoted section labelled Sponsored', pg.locator('section[aria-label="Sponsored listings"] >> text=Sponsored').count()>=1)
        check('promoted listing appears exactly once on Home (not duplicated in organic grid)', pg.locator('text=Promoted Laptop').count()==1)
        check('organic listing still shown', pg.locator('text=Organic Desk').count()>=1)
        check('Home: no horizontal overflow', noh())

        # ---------- Placement: promoted first
        pg.goto(base+'/browse'); pg.wait_for_selector('text=Promoted Laptop'); pg.wait_for_timeout(500)
        t=pg.evaluate("document.body.innerText")
        check('Browse: promoted listing is placed BEFORE the organic one, with a Sponsored label', t.index('Promoted Laptop')<t.index('Organic Desk') and 'SPONSORED' in t.upper().split('ORGANIC DESK')[0])
        pg.goto(base+'/explore'); pg.wait_for_selector('text=Promoted Laptop'); pg.wait_for_timeout(500)
        t=pg.evaluate("document.body.innerText")
        check('Explore: sponsored reel is FIRST in the feed and labelled Sponsored', t.index('Promoted Laptop')<t.index('Organic Desk') and 'SPONSORED' in t.upper().split('ORGANIC DESK')[0])

        # ---------- Messages
        pg.goto(base+'/messages'); pg.wait_for_selector('text=Used laptop'); pg.locator('ul button:has-text("Used laptop")').first.click()
        pg.wait_for_selector('text=scan this QR'); pg.wait_for_timeout(1200)
        scroll_after_open=pg.evaluate('scrollY')  # measured BEFORE any test-driven clicks (Playwright scrolls to click)
        alert=pg.locator('[role=alert]')
        check('recipient sees a high-risk warning attached to the flagged message', alert.count()==1 and 'may be a scam' in alert.first.inner_text())
        t=alert.first.inner_text()
        check('warning explains advance payment AND QR risk in plain language', 'before you have met' in t and 'never receives' in t)
        check('sender sees "other person was warned" + appeal link on own flagged msg', pg.locator('text=was shown a safety warning').count()==1 and pg.locator('text=Think this is a mistake?').count()==1)
        pg.click('text=Think this is a mistake?'); pg.wait_for_selector('text=Review requested')
        check('appeal calls appeal_message_flag RPC', any(n=='appeal_message_flag' for n,_ in state['rpcs']))
        # pre-send nudge for a risky draft
        pg.fill('input[placeholder="Type a message…"]','pay advance and send me your otp'); pg.keyboard.press('Enter'); pg.wait_for_timeout(300)
        check('sender is warned BEFORE sending a risky message', pg.locator('text=Send anyway').count()==1)
        pg.click('text=Edit message')
        # deal panel
        panel=pg.locator('[data-testid=deal-panel]')
        check('deal panel visible with buyer wording', panel.count()==1 and pg.locator('button:has-text("I received it")').count()==1)
        pbox=panel.bounding_box()
        check('deal panel is a compact bar (<= 70px tall collapsed)', pbox['height']<=70)
        pg.click('button:has-text("I received it")'); pg.wait_for_selector('text=waiting for the seller')
        check('confirming calls confirm_handover and shows waiting-for-other-side', any(n=='confirm_handover' for n,_ in state['rpcs']))
        pg.click('button:has-text("Details")'); pg.click('button:has-text("Report a problem")'); pg.wait_for_selector('[role=dialog][aria-label="Report a problem"]')
        pg.fill('textarea','short'); 
        check('report needs >=10 chars', pg.locator('button:has-text("Send report")').is_disabled())
        pg.fill('textarea','The screen has a crack not shown in the photos'); pg.click('button:has-text("Send report")'); pg.wait_for_timeout(500)
        d=[b for n,b in state['rpcs'] if n=='open_dispute']
        check('dispute submitted with reason + description', len(d)==1 and d[0]['p_reason']=='not_received' and 'crack' in d[0]['p_description'])
        check('Messages: opening a chat did not scroll the page; no h-overflow', scroll_after_open==0 and noh())

        # ---------- MyListings: Promote modal
        pg.goto(base+'/my-listings'); pg.wait_for_selector('text=My Camera')
        pg.click('button:has-text("Promote")'); pg.wait_for_selector('[role=dialog]')
        dlg=pg.locator('[role=dialog]'); txt=dlg.inner_text()
        check('modal lists both plans from the DB with prices (₹1 and ₹5)', '₹1' in txt and '₹5' in txt and '3 days' in txt and '7 days' in txt)
        check('modal states Sponsored labelling', 'Sponsored' in txt)
        box=dlg.bounding_box()
        check('modal fits inside the viewport', box['y']>=0 and box['y']+box['height']<=vp['height']+1 and box['x']>=0 and box['x']+box['width']<=vp['width']+1)
        check('background scroll locked while modal open', pg.evaluate("document.body.style.overflow")=='hidden')
        check('pay button disabled until a phone number is entered', pg.locator('button:has-text("and promote")').is_disabled())
        pg.fill('input[placeholder*="mobile"]','9876543210')
        check('pay button shows the selected plan price', pg.locator('button:has-text("Pay ₹1 and promote")').is_enabled())
        pg.click('[role=radio]:has-text("listing + reel")')
        check('switching plan updates the price (₹5)', pg.locator('button:has-text("Pay ₹5 and promote")').count()==1)
        pg.keyboard.press('Escape'); pg.wait_for_timeout(200)
        check('Escape closes modal and restores scroll', pg.locator('[role=dialog]').count()==0 and pg.evaluate("document.body.style.overflow")!='hidden')
        # ---------- Check payment button always tells the seller something
        pg.reload(); pg.wait_for_selector('text=Your promotions'); pg.wait_for_timeout(800)
        state['verify']='unpaid'; pg.click('button:has-text("Check payment")'); pg.wait_for_selector('[role=status]')
        check('Check payment (unpaid): shows what Cashfree said', 'not paid' in pg.locator('[role=status]').inner_text())
        state['verify']='missing'; pg.click('button:has-text("Check payment")'); pg.wait_for_timeout(800)
        check('Check payment (function unreachable): shows an error, never silent', 'Could not check the payment' in pg.locator('[role=status]').inner_text())
        state['verify']='paid'; pg.click('button:has-text("Check payment")'); pg.wait_for_timeout(800)
        check('Check payment (paid): shows success', 'live' in pg.locator('[role=status]').inner_text())
        check('MyListings: no horizontal overflow', noh())
        check('no JS errors', not errs)
        if errs: print(errs[:3])
        ctx.close()
    b.close()
sys.exit(0 if ok_all else 1)
