import asyncio,sys
from playwright.async_api import async_playwright
CH=sys.argv[1]
URL='https://httpbin.org/response-headers?Set-Cookie=nb_human%3Dok%3B%20Max-Age%3D31536000%3B%20Path%3D%2F'
async def main():
    async with async_playwright() as p:
        ctx=await p.chromium.launch_persistent_context('/workspace/nbtest/profile',executable_path='/usr/bin/google-chrome',viewport={'width':1400,'height':1000})
        pg=ctx.pages[0]
        await pg.goto(CH,wait_until='load'); await pg.wait_for_timeout(8000)
        tc=pg.get_by_role('button',name='Take control')
        if await tc.count(): await tc.first.click(); await pg.wait_for_timeout(5000)
        if not await pg.get_by_role('textbox',name='Address').count():
            await pg.get_by_role('button',name="Open the Bot's screen full size").first.click(); await pg.wait_for_timeout(4000)
        addr=pg.get_by_role('textbox',name='Address')
        await addr.fill(URL); await addr.press('Enter'); await pg.wait_for_timeout(6000)
        await pg.screenshot(path='human1.png')
        # then go to the cookie page by typing like a person
        await addr.fill('https://httpbin.org/cookies'); await addr.press('Enter'); await pg.wait_for_timeout(6000)
        cv=pg.locator('canvas').first; await cv.click(position={'x':200,'y':200})
        await pg.keyboard.press('Control+a')
        await pg.screenshot(path='human2.png')
        await pg.get_by_role('button',name='Hand back').first.click(); await pg.wait_for_timeout(4000)
        print('handed back; panel says:', 'The Bot has control' in await pg.inner_text('body'))
        await ctx.close()
asyncio.run(main())
