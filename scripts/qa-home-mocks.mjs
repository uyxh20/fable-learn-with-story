import { chromium, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

const base = process.env.FABLE_TEST_URL || 'http://127.0.0.1:8788';
assert.ok(['localhost','127.0.0.1'].includes(new URL(base).hostname), 'Local mocks only');
const evidence = '.gstack/homepage-study-2026-10-03';
await mkdir(evidence, {recursive:true});
const browser = await chromium.launch({channel:'chrome',headless:true});
const errors = []; const results = [];
async function settle(page) {
  await page.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].map(i => i.decode().catch(() => {}))); });
}
async function fits(page, label) {
  const width = page.viewportSize().width;
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
  assert.equal(overflow, false, `${label} horizontal overflow at ${width}`);
  for (const el of await page.locator('button,input,select').all()) {
    if (!(await el.isVisible())) continue;
    const b = await el.boundingBox();
    assert.ok(b.x >= -1 && b.x + b.width <= width + 1, `${label} control out of bounds: ${await el.textContent()}`);
  }
}
try {
  for (const width of [1440,390,320]) {
    const context = await browser.newContext({viewport:{width,height:width === 1440 ? 1000 : 844},reducedMotion:'reduce'});
    const page = await context.newPage(); page.on('pageerror', e => errors.push(e.message));
    for (let home=1; home<=5; home++) {
      await page.goto(`${base}/mocks/?home=${home}`); await settle(page);
      await expect(page.locator('h1')).toBeVisible();
      await fits(page, `Home ${home}`);
      if (width !== 320) await page.screenshot({path:`${evidence}/home-${home}-${width}.png`, fullPage:true});
      await page.getByRole('button',{name:/Switch to .* theme/}).click(); await fits(page, `Home ${home} alternate theme`);
      if (width === 1440) await page.screenshot({path:`${evidence}/home-${home}-alternate.png`, fullPage:true});
      if ([3,5].includes(home)) await page.getByRole('textbox',{name:'What would you like to understand?'}).fill('Compound interest');
      await page.getByRole('button',{name:/Create a fable/}).click();
      await expect(page.getByRole('heading',{name:'Start with an idea.'})).toBeVisible();
      if ([3,5].includes(home)) await expect(page.locator('#topic')).toHaveValue('Compound interest');
      await page.locator('#topic').fill('How memory works');
      await page.getByRole('button',{name:'Fairy tale',exact:true}).click();
      await expect(page.getByRole('button',{name:'Fairy tale',exact:true})).toHaveAttribute('aria-pressed','true');
      await fits(page, 'Create');
      if (home === 1 && width !== 320) await page.screenshot({path:`${evidence}/create-${width}.png`,fullPage:true});
      await page.getByRole('button',{name:'Create my fable'}).click();
      await expect(page.getByRole('heading',{name:'The Hall of Affairs',exact:true})).toBeVisible();
      const id = new URL(page.url()).searchParams.get('story'); assert.ok(id, 'Saved id attached to reading route');
      const stored = await context.request.get(`${base}/api/stories/${id}`); assert.equal(stored.status(),200);
      const doc = (await stored.json()).story;
      assert.equal(doc.concept,'How memory works'); assert.equal(doc.setting,'Fairy tale'); assert.equal(doc.status,'complete');
      assert.ok(doc.markdown.includes('The point')); assert.ok(doc.markdown.length > 5000);
      await page.reload(); await expect(page.locator('.prose')).toBeVisible();
      await page.getByRole('button',{name:'Finish the fable'}).click();
      await expect(page.getByRole('heading',{name:'A story to keep.'})).toBeVisible();
      await expect(page.locator('.saved')).toContainText('Saved privately');
      await page.getByRole('button',{name:'Create another fable'}).click();
      await expect(page.locator('#topic')).toBeVisible();
      results.push(`Home ${home}: create, saved full story, reload, finish, create again at ${width}px`);
    }
    for (let ending=1; ending<=3; ending++) {
      await page.goto(`${base}/mocks/?home=1&ending=${ending}&view=end`); await settle(page); await fits(page, `Ending ${ending}`);
      if (width !== 320) await page.screenshot({path:`${evidence}/ending-${ending}-${width}.png`,fullPage:true});
      await page.getByRole('button',{name:'Share fable'}).click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await expect(page.locator('#share-url')).toHaveValue(/shared=sample/);
      await page.keyboard.press('Escape'); await expect(page.getByRole('dialog')).not.toBeVisible();
      await page.getByRole('button',{name:'Download fable'}).click();
      await expect(page.getByRole('dialog')).toBeVisible(); await fits(page, 'Download dialog');
      if (ending === 1 && width !== 320) await page.screenshot({path:`${evidence}/download-${width}.png`});
      if (ending === 1 && width === 1440) {
        const event = page.waitForEvent('download'); await page.getByRole('button',{name:/Offline book/}).click();
        const download = await event; const path = `${evidence}/${download.suggestedFilename()}`; await download.saveAs(path);
        const html = await readFile(path,'utf8');
        assert.ok(html.includes('data:image/png;base64,')); assert.ok(html.includes('The point')); assert.ok(!html.includes('src="http'));
        const offline = await context.newPage(); await offline.goto(`file://${process.cwd()}/${path}`);
        assert.equal(await offline.locator('img').evaluateAll(images => images.every(i=>i.complete && i.naturalWidth > 0)), true);
        await offline.close();
      }
      await page.getByRole('button',{name:'Close dialog'}).click();
      results.push(`Ending ${ending}: download and share dialogs at ${width}px`);
    }
    await page.goto(`${base}/mocks/?home=1`);
    await page.getByRole('button',{name:'Read sample: The Hall of Affairs'}).click();
    await expect(page.locator('.prose')).toBeVisible();
    const id = new URL(page.url()).searchParams.get('story');
    const stranger = await browser.newContext();
    assert.equal((await stranger.request.get(`${base}/api/stories/${id}`)).status(),404);
    await stranger.close();
    // Private session cookies stay in memory; screenshot evidence contains no credentials.
    await context.close();
  }
  const context = await browser.newContext();
  const recipient = await context.newPage(); await recipient.goto(`${base}/mocks/?view=read&shared=sample`);
  await expect(recipient.locator('.shared-note')).toContainText('local only');
  await expect(recipient.locator('.prose')).toBeVisible();
  assert.equal((await context.request.post(`${base}/api/generations`, {data:{concept:'test'}})).status(),503);
  await context.close();
  assert.deepEqual(errors,[]);
  await writeFile(`${evidence}/qa-results.json`, JSON.stringify({results,errors},null,2));
  console.log(`PASS: ${results.length} flow/layout checks, offline illustrated download, private retrieval, shared sample, generation disabled.`);
} finally { await browser.close(); }
