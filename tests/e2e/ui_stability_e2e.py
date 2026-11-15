import json, sys, threading, http.server, socketserver, os, time, base64
from functools import partial
from playwright.sync_api import sync_playwright

UID='11111111-1111-1111-1111-111111111111'; OTHER='22222222-2222-2222-2222-222222222222'
CONV='33333333-3333-3333-3333-333333333333'; LISTING='44444444-4444-4444-4444-444444444444'

def b64(o): return base64.urlsafe_b64encode(json.dumps(o).encode()).rstrip(b'=').decode()
jwt=f"{b64({'alg':'HS256','typ':'JWT'})}.{b64({'sub':UID,'role':'authenticated','exp':4102444800})}.sig"
session={'access_token':jwt,'refresh_token':'r','expires_in':3600,'expires_at':4102444800,'token_type':'bearer',
 'user':{'id':UID,'aud':'authenticated','role':'authenticated','email':'me@example.com','app_metadata':{},'user_metadata':{},'created_at':'2024-01-01T00:00:00Z'}}

profile={'id':UID,'display_name':'Test User','city':'Delhi','trust_score':50,'verified':False,'rating_avg':None,'rating_count':0,'is_admin':False,'suspended':False}
notifs=[{'id':f'n{i}','user_id':UID,'type':'message','title':f'New message {i}','body':'Hello there','link':'/messages','read':i%2==0,'created_at':'2026-11-14T08:00:00Z'} for i in range(6)]
conv_row={'id':CONV,'listing_id':LISTING,'buyer_id':UID,'seller_id':OTHER,'created_at':'2026-11-01T00:00:00Z',
 'listings':{'title':'Used laptop','price':25000,'emoji':'💻','photo_urls':[],'status':'active'}}
msgs=[{'id':f'm{i}','conversation_id':CONV,'sender_id':UID if i%2 else OTHER,'body':f'Message number {i}','created_at':f'2026-11-10T08:{i%60:02d}:00Z','flagged':False,'flag_reasons':[]} for i in range(60)]

def handle(route):
    req=route.request; url=req.url; acc=req.headers.get('accept','')
    single='vnd.pgrst.object' in acc
    def ok(data): route.fulfill(status=200,content_type='application/json',headers={'access-control-allow-origin':'*','access-control-allow-headers':'*','content-range':'0-0/*'},body=json.dumps(data))
    if req.method=='OPTIONS':
        return route.fulfill(status=204,headers={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'*'})
    if '/rest/v1/profiles' in url: return ok(profile if single else [profile])
    if '/rest/v1/notifications' in url: return ok(notifs)
    if '/rest/v1/conversations' in url: return ok([conv_row])
    if '/rest/v1/messages' in url:
        if single: return ok(msgs[-1])
        return ok(msgs)
    if single:
        return route.fulfill(status=406,content_type='application/json',headers={'access-control-allow-origin':'*'},body=json.dumps({'code':'PGRST116','message':'none','details':'','hint':''}))
    ok([])

def serve(directory,port):
    class H(http.server.SimpleHTTPRequestHandler):
        def __init__(s,*a,**k): super().__init__(*a,directory=directory,**k)
        def log_message(s,*a): pass
        def do_GET(s):
            p=s.translate_path(s.path)
            if not os.path.isfile(p): s.path='/index.html'
            return super().do_GET()
    socketserver.TCPServer.allow_reuse_address=True; srv=socketserver.TCPServer(('127.0.0.1',port),H)
    threading.Thread(target=srv.serve_forever,daemon=True).start(); return srv

def run(label,directory,port,browser):
    serve(directory,port); out={'build':label}
    for vp_name,vp in [('desktop',{'width':1280,'height':800}),('mobile',{'width':375,'height':740})]:
        ctx=browser.new_context(viewport=vp)
        ctx.add_init_script(f"localStorage.setItem('sb-mock-auth-token', {json.dumps(json.dumps(session))})")
        ctx.route('https://mock.supabase.co/**',handle)
        pg=ctx.new_page(); errors=[]
        pg.on('pageerror',lambda e: errors.append(str(e)))
        r={}
        pg.goto(f'http://127.0.0.1:{port}/browse'); pg.wait_for_selector('header'); pg.wait_for_timeout(800)
        top=lambda: pg.evaluate("document.querySelector('main').getBoundingClientRect().top")
        h=lambda: pg.evaluate("document.documentElement.scrollHeight")
        t0,h0=top(),h()
        pg.click('button[aria-label="Notifications"]'); pg.wait_for_timeout(300)
        r['bell']={'main_shift_px':round(top()-t0),'page_height_delta':h()-h0}
        pw=pg.evaluate("(()=>{const e=[...document.querySelectorAll('header .glass-elevated')][0]; if(!e) return null; const b=e.getBoundingClientRect(); return {l:Math.round(b.left),r:Math.round(b.right),w:innerWidth,pos:getComputedStyle(e).position}})()")
        r['bell']['panel']=pw
        pg.keyboard.press('Escape'); pg.wait_for_timeout(150)
        r['bell']['closes_on_escape']=pg.evaluate("document.querySelectorAll('header .glass-elevated').length")==0
        pg.click('button[aria-label="Notifications"]'); pg.wait_for_timeout(150)
        pg.mouse.click(5,pg.evaluate("innerHeight")-5); pg.wait_for_timeout(150)
        r['bell']['closes_on_outside_click']=pg.evaluate("document.querySelectorAll('header .glass-elevated').length")==0
        # profile
        avatar=pg.locator('header button:has-text("T")').last if False else pg.locator('header div.relative > button, header div.static > button').filter(has_text='T').first
        avatar.click(); pg.wait_for_timeout(300)
        r['profile']={'main_shift_px':round(top()-t0),'page_height_delta':h()-h0,
            'panel':pg.evaluate("(()=>{const e=[...document.querySelectorAll('header .glass-elevated')][0]; if(!e) return null; const b=e.getBoundingClientRect(); return {l:Math.round(b.left),r:Math.round(b.right),w:innerWidth,pos:getComputedStyle(e).position}})()")}
        pg.keyboard.press('Escape'); pg.wait_for_timeout(150)
        # header sticky
        pg.evaluate("window.scrollTo({top:300,behavior:'instant'})"); pg.wait_for_timeout(100)
        r['header_top_when_scrolled_300px']=round(pg.evaluate("document.querySelector('header').getBoundingClientRect().top"))
        # messages
        pg.goto(f'http://127.0.0.1:{port}/messages'); pg.wait_for_selector('text=Used laptop'); pg.wait_for_timeout(500)
        r['messages_scrollY_before_open']=pg.evaluate("scrollY")
        pg.locator('ul button:has-text("Used laptop")').first.click(); pg.wait_for_selector('text=Message number 59'); pg.wait_for_timeout(1200)
        r['messages_scrollY_after_open']=round(pg.evaluate("scrollY"))
        r['page_scrollable_px']=pg.evaluate("document.documentElement.scrollHeight-innerHeight")
        r['thread_container']=pg.evaluate("(()=>{const e=[...document.querySelectorAll('div')].find(d=>getComputedStyle(d).overflowY==='auto'&&d.scrollHeight>d.clientHeight&&d.textContent.includes('Message number 59')); return e?{scrollTop:Math.round(e.scrollTop),max:Math.round(e.scrollHeight-e.clientHeight)}:null})()")
        r['last_msg_visible_in_thread']=pg.evaluate("(()=>{const m=[...document.querySelectorAll('div')].find(d=>d.children.length===0&&d.textContent==='Message number 59'); if(!m) return 'not found'; let c=m.parentElement; while(c&&!(getComputedStyle(c).overflowY==='auto'&&c.scrollHeight>c.clientHeight)) c=c.parentElement; const a=m.getBoundingClientRect(), b=c.getBoundingClientRect(); return {msgBottom:Math.round(a.bottom),containerBottom:Math.round(b.bottom),visible:a.bottom<=b.bottom+1&&a.top>=b.top, containerGap:Math.round(b.bottom-a.bottom)}})()")
        r['h_overflow']=pg.evaluate("document.documentElement.scrollWidth>innerWidth")
        r['js_errors']=errors[:3]
        out[vp_name]=r; ctx.close()
    return out

with sync_playwright() as p:
    b=p.chromium.launch()
    for label,d,port in [('ORIGINAL','/home/claude/test/dist-orig',8831),('FIXED','/home/claude/test/dist-fixed',8832)]:
        print(json.dumps(run(label,d,port,b),indent=1))
    b.close()
