import asyncio,sys,time
from playwright.async_api import async_playwright
MSG=sys.argv[1]; OUT=sys.argv[2]; WAIT=int(sys.argv[3]) if len(sys.argv)>3 else 150
async def main():
    async with async_playwright() as p:
        ctx=await p.chromium.launch_persistent_context('/workspace/nbtest/profile',executable_path='/usr/bin/google-chrome',viewport={'width':1400,'height':1000})
        pg=ctx.pages[0]
        await pg.goto('http://localhost:13020/',wait_until='networkidle')
        pass
        await pg.wait_for_timeout(2500)
        box=pg.locator('[contenteditable=true],textarea').first
        await box.click(); await pg.keyboard.type(MSG); await pg.keyboard.press('Enter')
        t0=time.time(); last=''
        while time.time()-t0<WAIT:
            await pg.wait_for_timeout(5000)
            txt=await pg.inner_text('main') if await pg.query_selector('main') else await pg.inner_text('body')
            if txt==last and time.time()-t0>25: break
            last=txt
        print('URL',pg.url,'elapsed',int(time.time()-t0))
        print(last[-3000:])
        await pg.screenshot(path=OUT,full_page=True)
        await ctx.close()
asyncio.run(main())
