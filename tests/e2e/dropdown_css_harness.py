import glob, json
from playwright.sync_api import sync_playwright
css = open(glob.glob('/home/claude/repo/e-sauda1-main/dist/assets/index-*.css')[0]).read()

def page_html(buggy):
    extra = ".glass,.glass-elevated{position:relative}" if buggy else ""   # simulates old cascade: glass rules after utilities
    return f"""<!doctype html><html><head><meta name=viewport content="width=device-width,initial-scale=1">
<style>{css}</style><style>{extra}</style></head><body>
<div class="flex min-h-screen flex-col bg-cream">
<header class="glass sticky top-0 z-40 !border-x-0 !border-t-0 !rounded-none">
 <div class="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3 md:flex-nowrap">
  <span class="shrink-0">e-Sauda</span>
  <div class="static shrink-0 sm:relative" id="nw"><button id="bell" class="p-2">Bell</button>
   <div id="panel" hidden class="glass-elevated absolute inset-x-4 top-full z-50 mt-2 rounded-xl2 p-2 sm:inset-x-auto sm:right-0 sm:w-80">notifications</div></div>
  <div class="static shrink-0 sm:relative" id="pw"><button id="avatar" class="h-9 w-9">Y</button>
   <div id="menu" hidden class="glass-elevated absolute inset-x-4 top-full z-50 mt-2 rounded-xl2 p-2 sm:inset-x-auto sm:right-0 sm:w-64">menu</div></div>
 </div></header>
<main id="main" class="flex-1"><div style="height:2500px" id="content">homepage content</div></main></div>
<script>
 const t=(b,p)=>document.getElementById(b).onclick=()=>{{const el=document.getElementById(p);el.hidden=!el.hidden}};
 t('bell','panel'); t('avatar','menu');
 addEventListener('keydown',e=>{{if(e.key==='Escape')document.querySelectorAll('#panel,#menu').forEach(x=>x.hidden=true)}});
</script></body></html>"""

results=[]
with sync_playwright() as p:
    b=p.chromium.launch()
    for vp_name,vp in [('desktop',{'width':1280,'height':800}),('tablet',{'width':820,'height':1000}),('mobile',{'width':375,'height':740})]:
        for buggy in (True, False):
            pg=b.new_page(viewport=vp)
            pg.set_content(page_html(buggy))
            pg.wait_for_timeout(100)
            m=lambda: pg.evaluate("({top:document.getElementById('main').getBoundingClientRect().top,h:document.documentElement.scrollHeight,sw:document.documentElement.scrollWidth,iw:innerWidth})")
            before=m()
            row={'viewport':vp_name,'variant':'OLD cascade' if buggy else 'FIXED'}
            for btn,panel in (('bell','panel'),('avatar','menu')):
                pg.click('#'+btn); pg.wait_for_timeout(50)
                after=m()
                box=pg.evaluate(f"(()=>{{const r=document.getElementById('{panel}').getBoundingClientRect();return [r.left,r.right]}})()")
                row[btn]={'content_shift_px':round(after['top']-before['top']),'page_height_delta':after['h']-before['h'],'on_screen':box[0]>=0 and box[1]<=after['iw']+0.5,'h_overflow':after['sw']>after['iw']}
                pg.keyboard.press('Escape'); pg.wait_for_timeout(30)
                row[btn]['esc_closes']=pg.evaluate(f"document.getElementById('{panel}').hidden")
            # sticky header check
            pg.evaluate("scrollTo(0,600)"); pg.wait_for_timeout(50)
            row['header_top_after_scroll']=round(pg.evaluate("document.querySelector('header').getBoundingClientRect().top"))
            results.append(row); pg.close()
    b.close()
for r in results: print(json.dumps(r))
