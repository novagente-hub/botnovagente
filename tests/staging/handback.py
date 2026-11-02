import asyncio,sys
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        ctx=await p.chromium.launch_persistent_context('/workspace/nbtest/profile',executable_path='/usr/bin/google-chrome',viewport={'width':1400,'height':1000})
        pg=ctx.pages[0]
        await pg.goto(sys.argv[1],wait_until='load'); await pg.wait_for_timeout(8000)
        await pg.get_by_role('button',name='Devolver controle').first.click(); await pg.wait_for_timeout(5000)
        print('bot has control:', 'The Bot has control' in await pg.inner_text('body'))
        await ctx.close()
asyncio.run(main())
