import { build } from 'esbuild';
import { Miniflare,convertV4MiniflareOptions } from 'miniflare';
import { readFile,mkdir,writeFile,mkdtemp,rm } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { tmpdir } from 'node:os';
import { chromium,expect } from '@playwright/test';
const evidence=process.env.FABLE_QA_EVIDENCE||'.gstack/latency-2026-10-04/local';await mkdir(evidence,{recursive:true});
const bundle=await build({entryPoints:['src/entry.js'],bundle:true,format:'esm',platform:'browser',external:['cloudflare:workers'],write:false});
const pngs=await Promise.all(['cover.png','03_kongzhai_story.png','05_jigua_story.png'].map(name=>readFile(`art-src/${name}`)));let imageIndex=0,calls=[];let failImage=false,failProse=false,progressive=true;
let releaseImages,releaseSecond,releaseFinish;
const imagesGate=new Promise(r=>releaseImages=r),secondGate=new Promise(r=>releaseSecond=r),finishGate=new Promise(r=>releaseFinish=r);
const scenes=Array.from({length:3},(_,scene)=>({text:Array.from({length:4},(_,i)=>`The gardener tended tree ${scene*4+i+1}. `+'Each season, the roots grew deeper and the branches gave more fruit. '.repeat(6)).join('\n\n')}));
const plan={title:'The Patient Gardener',visual_guide:'An old gardener in blue robes.',scenes:scenes.map((_,i)=>({beat:`Tend orchard ${i+1}`,image_prompt:`Orchard scene ${i+1}.`})),lesson:'The orchard represents compound growth.'};
const explanation='The orchard represents compound growth. Small gains accumulate on previous gains. '+'Saving a little each year gives the next year more to grow from. '.repeat(4);
const persist=await mkdtemp(`${tmpdir()}/fable-qa-`);
const options=convertV4MiniflareOptions({name:'fable-test',modules:true,script:bundle.outputFiles[0].text,compatibilityDate:'2026-10-03',host:'127.0.0.1',port:8789,
  d1Databases:['DB'],r2Buckets:['STORIES'],workflows:{GENERATE:{name:'fable-test-generation',className:'GenerateFable'}},
  assets:{directory:'dist',binding:'ASSETS',run_worker_first:true,routerConfig:{has_user_worker:true}},
  bindings:{OPENROUTER_API_KEY:'local-test-only',LLM_MODEL:'test/text',IMAGE_MODEL:'google/test-image',GENERATION_ENABLED:'true',DAILY_CREATION_LIMIT:'20'},
  outboundService:async request=>{
    const url=new URL(request.url);assert.equal(url.hostname,'openrouter.ai');
    assert.equal(request.headers.get('Authorization'),'Bearer local-test-only');
    const body=await request.json();calls.push(url.pathname);
    if(url.pathname.endsWith('/chat/completions')) {
      assert.equal(body.reasoning.effort,'medium');
      if(!body.stream)return Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify(plan)}}],usage:{cost:0.001}});
      let part=0;const encoder=new TextEncoder();
      return new Response(new ReadableStream({async pull(controller){
        if(progressive&&part===1)await secondGate;if(progressive&&part===2)await finishGate;
        const parts=['{"scenes":['+JSON.stringify(scenes[0]),','+JSON.stringify(scenes[1]),','+JSON.stringify(scenes[2])+'],"explanation":'+JSON.stringify(explanation)+'}'];
        if(failProse&&part===1){controller.enqueue(encoder.encode('data: '+JSON.stringify({error:{message:'test interruption'}})+'\n\n'));controller.close();return;}
        if(part<3)controller.enqueue(encoder.encode('data: '+JSON.stringify({choices:[{delta:{content:parts[part++]}}]})+'\n\n'));
        else {controller.enqueue(encoder.encode('data: '+JSON.stringify({choices:[{delta:{},finish_reason:'stop'}],usage:{cost:0.001}})+'\n\ndata: [DONE]\n\n'));controller.close();}
      }}),{headers:{'Content-Type':'text/event-stream'}});
    }
    assert.equal(body.n,1);const index=imageIndex++%3;if(progressive)await imagesGate;if(failImage&&index===1)return new Response('test failure',{status:500});
    return Response.json({data:[{b64_json:pngs[index].toString('base64'),media_type:'image/png'}],usage:{cost:0.01}});
  },
});options.resourcePersistencePath=persist;
let mf=new Miniflare(options),browser;
try{
  await mf.ready;const db=await mf.getD1Database('DB');await db.exec((await readFile('migrations/0001_creations.sql','utf8')).replace(/\n/g,' '));
  browser=await chromium.launch({...(process.env.FABLE_CHROME?{executablePath:process.env.FABLE_CHROME}:{channel:'chrome'}),headless:true});const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce',permissions:['clipboard-read','clipboard-write']});
  const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:8789/');await expect(page.locator('.fable-bubble')).toBeVisible();
  await page.locator('#fable-idea').fill('How does compound growth work?');await expect(page.locator('.fable-send')).toBeEnabled();
  await page.locator('.fable-send').click();
  await expect(page.locator('.cine')).toBeVisible({timeout:20000});
  const id=new URL(page.url()).searchParams.get('story');assert.ok(id);
  const getState=async()=>await(await context.request.get(`http://127.0.0.1:8789/api/stories/${id}`)).json();
  const early=await getState();assert.equal(early.status,'writing');assert.equal(early.partial_result.scenes.length,1);assert.equal(early.partial_result.text_complete,false);
  assert.equal(calls.length,5,'planning, prose and all three image calls have started concurrently');
  await expect(page.locator('.cine-decode')).toHaveCount(0);await expect(page.getByRole('button',{name:'Share fable'})).toHaveCount(0);
  assert.equal((await context.request.post(`http://127.0.0.1:8789/api/stories/${id}/share`,{headers:{Origin:'http://127.0.0.1:8789'}})).status(),409);
  await page.evaluate(async()=>{await document.fonts.ready;const scene=document.querySelector('.cine-scene');document.querySelector('.cine').scrollTo({top:scene.offsetTop+120,behavior:'instant'});});
  await expect(page.locator('.cine-scene').first()).toHaveAttribute('data-active','');
  const position=await page.locator('.cine').evaluate(el=>el.scrollTop);
  releaseImages();
  await expect.poll(()=>page.locator('.cine-bg img').evaluateAll(imgs=>imgs.some(img=>img.getAttribute('src').includes('/image/0'))),{timeout:15000}).toBe(true);
  assert.ok(Math.abs(await page.locator('.cine').evaluate(el=>el.scrollTop)-position)<3,'image arrival preserves scroll');
  await page.reload();await expect(page.locator('.cine')).toBeVisible();await page.evaluate(()=>document.fonts.ready);
  await expect(page.locator('.cine-scene').first()).toHaveAttribute('data-active','');
  assert.ok(Math.abs(await page.locator('.cine').evaluate(el=>el.scrollTop)-position)<3,'reload during generation restores scroll');
  releaseSecond();
  await expect(page.locator('.cine-scene').filter({hasText:'tree 5.'})).toBeVisible({timeout:15000});
  assert.ok(Math.abs(await page.locator('.cine').evaluate(el=>el.scrollTop)-position)<3,'appending a scene preserves scroll');
  assert.equal((await getState()).status,'writing');await page.screenshot({path:`${evidence}/reading-while-generating.png`});
  releaseFinish();await expect.poll(async()=>(await getState()).status,{timeout:20000}).toBe('completed');
  await expect(page.locator('.cine-end')).toHaveCount(1,{timeout:10000});assert.ok(Math.abs(await page.locator('.cine').evaluate(el=>el.scrollTop)-position)<3,'completion preserves scroll');
  progressive=false;
  const saved=await context.request.get(`http://127.0.0.1:8789/api/stories/${id}`);assert.equal(saved.status(),200);const doc=await saved.json();assert.equal(doc.status,'completed');assert.ok(doc.result.markdown.includes('tree 12'));
  assert.equal((await context.request.get(`http://127.0.0.1:8789${doc.result.image.url}`)).status(),200);
  await page.evaluate(async()=>{await document.fonts.ready;await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));});
  assert.equal(doc.result.scenes.length,3);
  const imageBodies=[];
  for(const scene of doc.result.scenes){const image=await context.request.get(`http://127.0.0.1:8789${scene.image.url}`);assert.equal(image.status(),200);imageBodies.push((await image.body()).toString('base64'));
    const section=page.locator('.cine-scene').filter({hasText:scene.text.slice(0,30)}).first();await section.evaluate(el=>document.querySelector('.cine').scrollTo({top:el.offsetTop,behavior:'instant'}));
    await expect(section).toHaveAttribute('data-active','');await expect(page.locator('.cine-bg-layer').filter({has:page.locator(`img[src="${scene.image.url}"]`)})).toHaveCSS('opacity','1');
  }
  assert.equal(new Set(imageBodies).size,3);
  const row=await db.prepare('SELECT * FROM creations WHERE id=?').bind(id).first();
  const retry=await context.request.post('http://127.0.0.1:8789/api/generations',{headers:{Origin:'http://127.0.0.1:8789'},data:{...JSON.parse(row.request_json),idempotency_token:row.idempotency}});assert.equal((await retry.json()).job_id,id);assert.equal(calls.length,5);
  assert.equal((await context.request.get(`http://127.0.0.1:8789/api/stories/${id}/share`)).status(),405);
  assert.equal((await context.request.post('http://127.0.0.1:8789/api/session',{headers:{Origin:'https://foreign.example'}})).status(),403);
  const conflict=await context.request.post('http://127.0.0.1:8789/api/generations',{headers:{Origin:'http://127.0.0.1:8789'},data:{...JSON.parse(row.request_json),concept:'A changed topic',idempotency_token:row.idempotency}});assert.equal(conflict.status(),409);
  await page.evaluate(()=>document.fonts.ready);await page.locator('.cine-rail button').last().click();await expect(page.locator('.cine-sec[data-active]')).toHaveAttribute('data-screen-label','end');await expect(page.getByRole('heading',{name:'A story to keep.'})).toBeInViewport();
  await page.screenshot({path:`${evidence}/ending.png`});
  await page.getByRole('button',{name:'Download fable'}).click();const downloadEvent=page.waitForEvent('download');await page.getByRole('button',{name:/Offline book/}).click();const download=await downloadEvent;await download.saveAs(`${evidence}/fable.html`);const html=await readFile(`${evidence}/fable.html`,'utf8');assert.ok(html.includes('tree 12'));assert.ok(html.includes('data:image/png;base64,'));for(const bytes of imageBodies)assert.ok(html.includes(bytes));
  await page.keyboard.press('Escape');await page.getByRole('button',{name:'Share fable'}).click();await page.getByRole('button',{name:'Create share link'}).click();await expect(page.locator('.fable-share-input')).toBeVisible();const link=await page.locator('.fable-share-input').inputValue();
  const stranger=await browser.newContext();assert.equal((await stranger.request.get(`http://127.0.0.1:8789/api/stories/${id}`)).status(),404);const recipient=await stranger.newPage();await recipient.goto(link);await expect(recipient.locator('.cine')).toBeVisible();
  await page.getByRole('button',{name:'Stop sharing'}).click();await expect(page.getByRole('dialog').getByRole('status')).toContainText('Sharing is off.');assert.equal((await stranger.request.get(`http://127.0.0.1:8789/api/shared/${new URL(link).searchParams.get('share')}`)).status(),404);await stranger.close();
  failImage=true;const failed=await context.request.post('http://127.0.0.1:8789/api/generations',{headers:{Origin:'http://127.0.0.1:8789'},data:{concept:'A failed image still saves the story',setting:'Chinese classical',lang:'en',idempotency_token:crypto.randomUUID()}});const failedId=(await failed.json()).job_id;
  await expect.poll(async()=>{const r=await context.request.get(`http://127.0.0.1:8789/api/stories/${failedId}`);return(await r.json()).status;},{timeout:30000}).toBe('failed');
  const partial=await(await context.request.get(`http://127.0.0.1:8789/api/stories/${failedId}`)).json();assert.ok(partial.partial_result.markdown.includes('tree 12'));assert.equal(partial.partial_result.scenes.filter(s=>s.image).length,2);
  assert.equal((await context.request.post(`http://127.0.0.1:8789/api/stories/${failedId}/share`,{headers:{Origin:'http://127.0.0.1:8789'}})).status(),409);
  failImage=false;
  const raced=await Promise.all(Array.from({length:3},()=>context.request.post('http://127.0.0.1:8789/api/generations',{headers:{Origin:'http://127.0.0.1:8789'},data:{concept:'A bounded concurrent creation',setting:'Chinese classical',lang:'en',idempotency_token:crypto.randomUUID()}})));
  assert.deepEqual(raced.map(r=>r.status()).sort(),[202,429,429]);
  const finalId=(await raced.find(r=>r.status()===202).json()).job_id;
  await expect.poll(async()=>{const r=await context.request.get(`http://127.0.0.1:8789/api/stories/${finalId}`);return(await r.json()).status;},{timeout:20000}).toBe('completed');
  failProse=true;const interrupted=await browser.newContext();await interrupted.request.post('http://127.0.0.1:8789/api/session',{headers:{Origin:'http://127.0.0.1:8789'}});
  const broken=await interrupted.request.post('http://127.0.0.1:8789/api/generations',{headers:{Origin:'http://127.0.0.1:8789'},data:{concept:'An interrupted stream preserves finished scenes',setting:'Chinese classical',lang:'en',idempotency_token:crypto.randomUUID()}});assert.equal(broken.status(),202);const brokenId=(await broken.json()).job_id;
  await expect.poll(async()=>{const r=await interrupted.request.get(`http://127.0.0.1:8789/api/stories/${brokenId}`);return(await r.json()).status;},{timeout:20000}).toBe('failed');
  const retained=await(await interrupted.request.get(`http://127.0.0.1:8789/api/stories/${brokenId}`)).json();assert.equal(retained.partial_result.scenes.length,1);assert.equal(retained.partial_result.text_complete,false);
  const partialPage=await interrupted.newPage();await partialPage.goto(`http://127.0.0.1:8789/?story=${brokenId}#read/cover`);await expect(partialPage.locator('.cine')).toBeVisible();await expect(partialPage.locator('.cine-decode')).toHaveCount(0);await expect(partialPage.getByRole('button',{name:'Share fable'})).toBeDisabled();await interrupted.close();failProse=false;
  for(const width of [1440,390,320]){await page.setViewportSize({width,height:1000});for(const lang of ['en','fr','da','zh']){await page.goto(`http://127.0.0.1:8789/?lang=${lang}`);await expect(page.locator('.fable-bubble')).toBeVisible();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,`${lang} at ${width}`);if(lang==='en')await page.screenshot({path:`${evidence}/home-${width}.png`,fullPage:true});}}
  const regression=await promisify(execFile)(process.execPath,['scripts/qa-regression.mjs'],{env:{...process.env,FABLE_TEST_URL:'http://127.0.0.1:8789',FABLE_QA_EVIDENCE:evidence},timeout:150000});console.log(regression.stdout.trim());
  await mf.dispose();mf=new Miniflare(options);await mf.ready;
  const restarted=await context.request.get(`http://127.0.0.1:8789/api/stories/${id}`);const reopened=await restarted.json();assert.equal(reopened.status,'completed');assert.equal(reopened.result.markdown,doc.result.markdown);
  assert.equal((await context.request.get(`http://127.0.0.1:8789${doc.result.image.url}`)).status(),200);
  assert.deepEqual(errors,[]);console.log('PASS: early reading, overlapping prose/images, stable scroll, mid-generation reload, interrupted-stream retention; real local Workflow + D1 + R2; creation, full text and image persistence, reload, idempotency, private access, sharing/revocation, offline download, failure retention, 4 locales at 3 widths.');
  await writeFile(`${evidence}/local-qa.json`,JSON.stringify({passed:true,providerCalls:calls.length,errors},null,2));
}catch(error){console.error('Local provider calls:',calls);console.error(await(await mf.getD1Database('DB')).prepare('SELECT status,error FROM creations').all());throw error;}finally{await browser?.close();await mf.dispose();await rm(persist,{recursive:true,force:true});}
