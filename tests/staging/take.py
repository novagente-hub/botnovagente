import asyncio,sys
from playwright.async_api import async_playwright
CH=sys.argv[1]
async def main():
    async with async_playwright() as p:
        ctx=await p.chromium.launch_persistent_context('/workspace/nbtest/profile',executable_path='/usr/bin/google-chrome',viewport={'width':1400,'height':1000})
        pg=ctx.pages[0]
        await pg.goto(CH,wait_until='load'); await pg.wait_for_timeout(8000)
        await pg.get_by_role('button',name='Take control').first.click()
        await pg.wait_for_timeout(6000)
        await pg.screenshot(path='take1.png')
        print((await pg.inner_text('body'))[-800:])
        for e in await pg.query_selector_all('button,input,canvas,img,video'):
            print(await e.evaluate("e=>e.tagName+' '+(e.getAttribute('aria-label')||'')+' '+(e.innerText||'').slice(0,30)+' '+(e.getAttribute('data-testid')||'')"))
        await ctx.close()
asyncio.run(main())
