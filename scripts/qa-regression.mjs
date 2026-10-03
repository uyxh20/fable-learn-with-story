// Read-only smoke checks: safe for local or production with no provider calls.
import { chromium,expect } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
const base=process.env.FABLE_TEST_URL||'http://127.0.0.1:8787',evidence=process.env.FABLE_QA_EVIDENCE;
if(evidence)await mkdir(evidence,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});const errors=[];
try{
  for(const width of [390,1440]){
    const page=await browser.newPage({viewport:{width,height:1000},reducedMotion:'reduce'});page.on('pageerror',e=>errors.push(e.message));
    for(const lang of ['en','fr','da','zh']){
      await page.goto(`${base}/?lang=${lang}`);await expect(page.locator('.fable-bubble')).toBeVisible();await page.evaluate(()=>document.fonts.ready);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
      const labels=await page.evaluate(()=>FABLE.ui[document.documentElement.lang.split('-')[0]]);
      await page.getByRole('button',{name:labels.lightLabel,exact:true}).click();
      await expect(page.locator('html')).toHaveAttribute('data-theme','light');
      if(evidence&&lang==='en')await page.screenshot({path:`${evidence}/home-light-${width}.png`,fullPage:true});
      await page.locator('.fable-sample').click();await expect(page.locator('.cine')).toBeVisible();await page.evaluate(()=>document.fonts.ready);
      await page.getByRole('button',{name:labels.contents,exact:true}).click();await page.getByRole('dialog').locator('.toc-sub').click();
      await expect(page.locator('.cine-sec[data-active]')).toHaveAttribute('data-screen-label','decode');
      await expect(page.locator('.cine-figure img')).toBeVisible();
      await page.locator('.cine-decode h3.dt').click();const before=await page.locator('.cine').evaluate(e=>e.scrollTop);await page.keyboard.press('Space');
      await expect.poll(()=>page.locator('.cine').evaluate(e=>e.scrollTop)).toBeGreaterThan(before+100);
      const after=await page.locator('.cine').evaluate(e=>e.scrollTop);await page.reload();await page.evaluate(()=>document.fonts.ready);
      await expect(page.locator('.cine-sec[data-active]')).toHaveAttribute('data-screen-label','decode');
      assert.ok(Math.abs(after-await page.locator('.cine').evaluate(e=>e.scrollTop))<5);
      await page.getByRole('button',{name:labels.contents,exact:true}).click();const dialog=page.getByRole('dialog');
      await expect(dialog.getByRole('button',{name:labels.closeLabel,exact:true})).toBeFocused();
      await page.keyboard.press('Shift+Tab');await expect(dialog.locator('button').last()).toBeFocused();
      await dialog.locator('.toc-row').last().click();await expect(page.locator('.cine-sec[data-active]')).toHaveAttribute('data-screen-label','end');
      await expect(page.locator('.fable-ending')).toBeInViewport();
      if(evidence&&lang==='en')await page.screenshot({path:`${evidence}/ending-light-${width}.png`});
      await page.locator('.fable-next').click();await expect(page.locator('.fable-home')).toBeVisible();
      await page.getByRole('button',{name:labels.darkLabel,exact:true}).click();
    }
    const health=await(await page.request.get(`${base}/healthz`)).json();assert.equal(health.status,'ok');
    console.log(`PASS ${width}px: four languages, chat composer, sample, light/dark, explanation keyboard reading, reload, focus, quiet ending and Home.`);
    await page.close();
  }
  assert.deepEqual(errors,[]);
}finally{await browser.close();}
