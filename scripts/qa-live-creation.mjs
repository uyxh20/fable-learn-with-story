// Opt-in: one paid creation on the deployed app, then persistence and sharing checks.
import {chromium,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile,chmod} from 'node:fs/promises';
const resume=process.env.FABLE_SMOKE_RESUME==='1';
if(!resume&&process.env.FABLE_PAID_SMOKE!=='1')throw new Error('Set FABLE_PAID_SMOKE=1 to authorize one paid creation.');
const base=process.env.FABLE_TEST_URL||'https://fable-learn-with-story.ulysse-ha-19.workers.dev';
const evidence=process.env.FABLE_QA_EVIDENCE||'.gstack/production-2026-10-03/live-generation';await mkdir(evidence,{recursive:true});
const browser=await chromium.launch({...(process.env.FABLE_CHROME?{executablePath:process.env.FABLE_CHROME}:{channel:'chrome'}),headless:true});const started=Date.now();
try{
  const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce',permissions:['clipboard-read','clipboard-write'],...(resume?{storageState:`${evidence}/owner-session.json`}:{})});
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  let id;
  if(resume){id=JSON.parse(await readFile(`${evidence}/job.json`,'utf8')).id;await page.goto(`${base}/?story=${id}#read/cover`);}
  else{
    await page.goto(base);await page.locator('#fable-idea').fill('How does a feedback loop help us learn a new skill?');await expect(page.locator('.fable-send')).toBeEnabled();await page.locator('.fable-send').click();
    await expect.poll(()=>new URL(page.url()).searchParams.get('story'),{timeout:20000}).toBeTruthy();id=new URL(page.url()).searchParams.get('story');
    await context.storageState({path:`${evidence}/owner-session.json`});await chmod(`${evidence}/owner-session.json`,0o600);
    await writeFile(`${evidence}/job.json`,JSON.stringify({id,started:new Date(started).toISOString()}));
  }
  let state,last,firstReadableSeconds=null,firstReadableScenes=null,readingPosition=null;
  while(Date.now()-started<600000){
    const r=await context.request.get(`${base}/api/stories/${id}`);assert.equal(r.status(),200);state=await r.json();
    if(state.status!==last){console.log('Creation status:',state.status);last=state.status;}
    if(state.partial_result&&!firstReadableSeconds&&!resume){
      await expect(page.locator('.cine')).toBeVisible({timeout:10000});await page.evaluate(()=>document.fonts.ready);
      firstReadableSeconds=Math.round((Date.now()-started)/1000);firstReadableScenes=state.partial_result.scenes.length;
      console.log(`First readable: ${firstReadableSeconds}s (${firstReadableScenes} scene(s))`);
      await page.locator('.cine-scene').first().evaluate(el=>document.querySelector('.cine').scrollTo({top:el.offsetTop+100,behavior:'instant'}));
      await expect(page.locator('.cine-scene').first()).toHaveAttribute('data-active','');
      readingPosition=await page.locator('.cine').evaluate(el=>el.scrollTop);await page.screenshot({path:`${evidence}/early-reading.png`});
      await page.reload();await expect(page.locator('.cine')).toBeVisible();await page.evaluate(()=>document.fonts.ready);
      await expect(page.locator('.cine-scene').first()).toHaveAttribute('data-active','');
      assert.ok(Math.abs(await page.locator('.cine').evaluate(el=>el.scrollTop)-readingPosition)<3,'reload preserves position while generating');
    }
    if(['failed','completed'].includes(state.status))break;await new Promise(r=>setTimeout(r,2500));
  }
  const generationSeconds=Math.round((Date.now()-started)/1000);
  assert.equal(state.status,'completed',state.error||'Creation did not complete');assert.ok(state.result.markdown.length>1000);assert.ok(state.result.image.url.startsWith('/api/stories/'));
  await expect(page.locator('.cine-end')).toHaveCount(1,{timeout:10000});await page.evaluate(()=>document.fonts.ready);
  if(readingPosition!==null)assert.ok(Math.abs(await page.locator('.cine').evaluate(el=>el.scrollTop)-readingPosition)<3,'completion preserves position');
  const image=await context.request.get(base+state.result.image.url);assert.equal(image.status(),200);const bytes=await image.body();assert.ok(bytes.length>10000);assert.match(image.headers()['content-type'],/^image\/(png|jpeg|webp)$/);
  assert.equal(state.result.scenes.length,3);const imageBodies=[];
  for(const [i,scene] of state.result.scenes.entries()){
    const response=await context.request.get(base+scene.image.url);assert.equal(response.status(),200);imageBodies.push((await response.body()).toString('base64'));
    const section=page.locator('.cine-scene').filter({hasText:scene.text.slice(0,30)}).first();await section.evaluate(el=>document.querySelector('.cine').scrollTo({top:el.offsetTop,behavior:'instant'}));
    await expect(page.locator('.cine-bg-layer').filter({has:page.locator(`img[src="${scene.image.url}"]`)})).toHaveCSS('opacity','1');
    await page.screenshot({path:`${evidence}/scene-${i+1}.png`});
  }
  assert.equal(new Set(imageBodies).size,3);
  await page.screenshot({path:`${evidence}/cover.png`});await page.reload();await expect(page.locator('.cine')).toBeVisible();await page.evaluate(()=>document.fonts.ready);
  const reopened=await(await context.request.get(`${base}/api/stories/${id}`)).json();assert.equal(reopened.result.markdown,state.result.markdown);assert.deepEqual(await(await context.request.get(base+state.result.image.url)).body(),bytes);
  await page.locator('.cine-rail button').last().click();await expect(page.locator('.cine-sec[data-active]')).toHaveAttribute('data-screen-label','end');
  await page.getByRole('button',{name:'Download fable'}).click();const downloadEvent=page.waitForEvent('download');await page.getByRole('button',{name:/Offline book/}).click();const download=await downloadEvent;await download.saveAs(`${evidence}/fable.html`);const html=await readFile(`${evidence}/fable.html`,'utf8');assert.ok(html.includes('data:image/'));assert.ok(html.includes(state.result.title));for(const image of imageBodies)assert.ok(html.includes(image));
  await page.keyboard.press('Escape');await page.getByRole('button',{name:'Share fable'}).click();if(await page.getByRole('button',{name:'Create share link'}).count())await page.getByRole('button',{name:'Create share link'}).click();await expect(page.locator('.fable-share-input')).toBeVisible();const link=await page.locator('.fable-share-input').inputValue();
  const stranger=await browser.newContext();assert.equal((await stranger.request.get(`${base}/api/stories/${id}`)).status(),404);const recipient=await stranger.newPage();await recipient.goto(link);await expect(recipient.locator('.cine')).toBeVisible();
  await page.getByRole('button',{name:'Stop sharing'}).click();await expect(page.getByRole('dialog').getByRole('status')).toContainText('Sharing is off.');assert.equal((await stranger.request.get(`${base}/api/shared/${new URL(link).searchParams.get('share')}`)).status(),404);await stranger.close();assert.deepEqual(errors,[]);
  const report={passed:true,id,title:state.result.title,resumedExistingCreation:resume,firstReadableSeconds,firstReadableScenes,generationSeconds,verificationSeconds:Math.round((Date.now()-started)/1000),markdownCharacters:state.result.markdown.length,imageBytes:bytes.length,imageCount:3,checks:['progressive reading and stable position across reload/completion','real text and three distinct scene images','scene-aligned image transitions','private saved story and image after refresh','offline download','independent shared reader','revocation','no browser errors']};await writeFile(`${evidence}/result.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}finally{await browser.close();}
