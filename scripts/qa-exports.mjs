// No provider calls: verify sample downloads and share links locally or on the live site.
import {chromium,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
const base=process.env.FABLE_TEST_URL||'http://127.0.0.1:8787';
const evidence=process.env.FABLE_QA_EVIDENCE||'.gstack/exports';await mkdir(evidence,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
  const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce',permissions:['clipboard-read','clipboard-write']});
  await context.addInitScript(()=>{window.print=()=>{window.__printRequested=true;};});
  const page=await context.newPage();await page.goto(`${base}/?lang=en#read/end`);await page.evaluate(()=>document.fonts.ready);
  await expect(page.locator('.cine-sec[data-active]')).toHaveAttribute('data-screen-label','end');
  await page.getByRole('button',{name:'Download fable'}).click();
  const event=page.waitForEvent('download');await page.getByRole('button',{name:/Offline book/}).click();const download=await event;await download.saveAs(`${evidence}/sample.html`);
  const html=await readFile(`${evidence}/sample.html`,'utf8');assert.ok(html.includes('data:image/png;base64,'));assert.ok(html.includes('The Hall of Affairs'));
  const popup=context.waitForEvent('page');await page.getByRole('button',{name:/Save as PDF/}).click();const print=await popup;
  await expect.poll(()=>print.evaluate(()=>window.__printRequested)).toBe(true);
  assert.ok(await print.locator('img').evaluateAll(images=>images.length>=2&&images.every(i=>i.complete&&i.naturalWidth>0)));
  const pdf=await print.pdf({path:`${evidence}/sample.pdf`,format:'A4',printBackground:true});assert.equal(pdf.subarray(0,4).toString(),'%PDF');await print.close();
  await page.keyboard.press('Escape');await page.getByRole('button',{name:'Share fable'}).click();await page.getByRole('button',{name:'Copy link',exact:true}).click();
  const url=await page.locator('.fable-share-input').inputValue();assert.equal(await page.evaluate(()=>navigator.clipboard.readText()),url);
  const recipient=await browser.newPage();await recipient.goto(url);await expect(recipient.locator('.cine')).toBeVisible();await recipient.close();
  const offline=await browser.newPage();await offline.route('**/*',route=>route.abort());await offline.setContent(html);
  assert.ok(await offline.locator('img').evaluateAll(images=>images.length>=2&&images.every(i=>i.complete&&i.naturalWidth>0)));await offline.close();
  const health=await(await context.request.get(`${base}/healthz`)).json();
  for(const path of ['/.dev.vars','/.git/config','/mocks/compare','/src/openrouter.js'])assert.equal((await context.request.get(base+path)).status(),404,path);
  const session=await context.request.post(`${base}/api/session`,{headers:{Origin:base}});assert.equal(session.status(),200);
  const cookie=session.headers()['set-cookie'];assert.ok(cookie.includes('HttpOnly')&&cookie.includes('SameSite=Strict'));
  if(base.startsWith('https:'))assert.ok(cookie.includes('Secure'));
  assert.equal((await context.request.post(`${base}/api/session`,{headers:{Origin:'https://foreign.example'}})).status(),403);
  await writeFile(`${evidence}/smoke.json`,JSON.stringify({passed:true,health,checks:['offline HTML with embedded images','PDF print request and render','clipboard and independent sample recipient','private files unavailable','secure session cookie','cross-origin writes refused']},null,2));
  console.log('PASS: offline HTML, PDF, sample sharing, private file exclusions, secure cookies and cross-origin protection.');
}finally{await browser.close();}
