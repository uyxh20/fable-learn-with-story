import { build } from 'esbuild';
import { Miniflare,convertV4MiniflareOptions } from 'miniflare';
import { readFile,mkdir,writeFile,mkdtemp,rm } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { tmpdir } from 'node:os';
import { chromium,expect } from '@playwright/test';
const evidence='.gstack/production-2026-10-03';await mkdir(evidence,{recursive:true});
const bundle=await build({entryPoints:['src/entry.js'],bundle:true,format:'esm',platform:'browser',external:['cloudflare:workers'],write:false});
const png=await readFile('public/art/cover.png');let calls=[];let failImage=false;
const persist=await mkdtemp(`${tmpdir()}/fable-qa-`);
const options=convertV4MiniflareOptions({name:'fable-test',modules:true,script:bundle.outputFiles[0].text,compatibilityDate:'2026-10-03',host:'127.0.0.1',port:8789,
  d1Databases:['DB'],r2Buckets:['STORIES'],workflows:{GENERATE:{name:'fable-test-generation',className:'GenerateFable'}},
  assets:{directory:'dist',binding:'ASSETS',run_worker_first:true,routerConfig:{has_user_worker:true}},
  bindings:{OPENROUTER_API_KEY:'local-test-only',LLM_MODEL:'test/text',IMAGE_MODEL:'google/test-image',GENERATION_ENABLED:'true',DAILY_CREATION_LIMIT:'20'},
  outboundService:async request=>{
    const url=new URL(request.url);assert.equal(url.hostname,'openrouter.ai');
    assert.equal(request.headers.get('Authorization'),'Bearer local-test-only');
    const body=await request.json();calls.push(url.pathname);
    if(url.pathname.endsWith('/chat/completions'))return Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify({title:'The Patient Gardener',story:Array.from({length:12},(_,i)=>`The gardener tended tree ${i+1}. `+'Each season, the roots grew deeper and the branches gave more fruit. '.repeat(6)).join('\n\n'),explanation:'The orchard represents compound growth. Small gains accumulate on previous gains. '+ 'Saving a little each year gives the next year more to grow from. '.repeat(4),image_prompt:'An old gardener in an ink-painted orchard.'})}}],usage:{cost:0.001}});
    assert.equal(body.n,1);if(failImage)return new Response('test failure',{status:500});
    return Response.json({data:[{b64_json:png.toString('base64'),media_type:'image/png'}],usage:{cost:0.01}});
  },
});options.resourcePersistencePath=persist;
let mf=new Miniflare(options),browser;
try{
  await mf.ready;const db=await mf.getD1Database('DB');await db.exec((await readFile('migrations/0001_creations.sql','utf8')).replace(/\n/g,' '));
  browser=await chromium.launch({channel:'chrome',headless:true});const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce',permissions:['clipboard-read','clipboard-write']});
  const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:8789/');await expect(page.locator('.fable-bubble')).toBeVisible();
  await page.locator('#fable-idea').fill('How does compound growth work?');await expect(page.locator('.fable-send')).toBeEnabled();
  await page.locator('.fable-send').click();
  await expect(page.getByRole('button',{name:'Open the book',exact:true})).toBeVisible({timeout:20000});
  const id=new URL(page.url()).searchParams.get('story');assert.ok(id);
  await page.getByRole('button',{name:'Open the book',exact:true}).click();
  await expect(page.getByRole('heading',{name:'The Patient Gardener',exact:true}).first()).toBeVisible();
  await page.reload();await expect(page.locator('.cine')).toBeVisible();
  const saved=await context.request.get(`http://127.0.0.1:8789/api/stories/${id}`);assert.equal(saved.status(),200);const doc=await saved.json();assert.equal(doc.status,'completed');assert.ok(doc.result.markdown.includes('tree 12'));
  assert.equal((await context.request.get(`http://127.0.0.1:8789${doc.result.image.url}`)).status(),200);
  const row=await db.prepare('SELECT * FROM creations WHERE id=?').bind(id).first();
  const retry=await context.request.post('http://127.0.0.1:8789/api/generations',{headers:{Origin:'http://127.0.0.1:8789'},data:{...JSON.parse(row.request_json),idempotency_token:row.idempotency}});assert.equal((await retry.json()).job_id,id);assert.equal(calls.length,2);
  assert.equal((await context.request.get(`http://127.0.0.1:8789/api/stories/${id}/share`)).status(),405);
  assert.equal((await context.request.post('http://127.0.0.1:8789/api/session',{headers:{Origin:'https://foreign.example'}})).status(),403);
  const conflict=await context.request.post('http://127.0.0.1:8789/api/generations',{headers:{Origin:'http://127.0.0.1:8789'},data:{...JSON.parse(row.request_json),concept:'A changed topic',idempotency_token:row.idempotency}});assert.equal(conflict.status(),409);
  await page.evaluate(()=>document.fonts.ready);await page.locator('.cine-rail button').last().click();await expect(page.locator('.cine-sec[data-active]')).toHaveAttribute('data-screen-label','end');await expect(page.getByRole('heading',{name:'A story to keep.'})).toBeInViewport();
  await page.screenshot({path:`${evidence}/ending.png`});
  await page.getByRole('button',{name:'Download fable'}).click();const downloadEvent=page.waitForEvent('download');await page.getByRole('button',{name:/Offline book/}).click();const download=await downloadEvent;await download.saveAs(`${evidence}/fable.html`);const html=await readFile(`${evidence}/fable.html`,'utf8');assert.ok(html.includes('tree 12'));assert.ok(html.includes('data:image/png;base64,'));
  await page.keyboard.press('Escape');await page.getByRole('button',{name:'Share fable'}).click();await page.getByRole('button',{name:'Create share link'}).click();await expect(page.locator('.fable-share-input')).toBeVisible();const link=await page.locator('.fable-share-input').inputValue();
  const stranger=await browser.newContext();assert.equal((await stranger.request.get(`http://127.0.0.1:8789/api/stories/${id}`)).status(),404);const recipient=await stranger.newPage();await recipient.goto(link);await expect(recipient.locator('.cine')).toBeVisible();
  await page.getByRole('button',{name:'Stop sharing'}).click();assert.equal((await stranger.request.get(`http://127.0.0.1:8789/api/shared/${new URL(link).searchParams.get('share')}`)).status(),404);await stranger.close();
  failImage=true;const failed=await context.request.post('http://127.0.0.1:8789/api/generations',{headers:{Origin:'http://127.0.0.1:8789'},data:{concept:'A failed image still saves the story',setting:'Chinese classical',lang:'en',idempotency_token:crypto.randomUUID()}});const failedId=(await failed.json()).job_id;
  await expect.poll(async()=>{const r=await context.request.get(`http://127.0.0.1:8789/api/stories/${failedId}`);return(await r.json()).status;},{timeout:30000}).toBe('failed');
  const partial=await(await context.request.get(`http://127.0.0.1:8789/api/stories/${failedId}`)).json();assert.ok(partial.partial_result.markdown.includes('tree 12'));
  assert.equal((await context.request.post(`http://127.0.0.1:8789/api/stories/${failedId}/share`,{headers:{Origin:'http://127.0.0.1:8789'}})).status(),409);
  failImage=false;
  const raced=await Promise.all(Array.from({length:3},()=>context.request.post('http://127.0.0.1:8789/api/generations',{headers:{Origin:'http://127.0.0.1:8789'},data:{concept:'A bounded concurrent creation',setting:'Chinese classical',lang:'en',idempotency_token:crypto.randomUUID()}})));
  assert.deepEqual(raced.map(r=>r.status()).sort(),[202,429,429]);
  const finalId=(await raced.find(r=>r.status()===202).json()).job_id;
  await expect.poll(async()=>{const r=await context.request.get(`http://127.0.0.1:8789/api/stories/${finalId}`);return(await r.json()).status;},{timeout:20000}).toBe('completed');
  for(const width of [1440,390,320]){await page.setViewportSize({width,height:1000});for(const lang of ['en','fr','da','zh']){await page.goto(`http://127.0.0.1:8789/?lang=${lang}`);await expect(page.locator('.fable-bubble')).toBeVisible();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,`${lang} at ${width}`);if(lang==='en')await page.screenshot({path:`${evidence}/home-${width}.png`,fullPage:true});}}
  const regression=await promisify(execFile)(process.execPath,['scripts/qa-regression.mjs'],{env:{...process.env,FABLE_TEST_URL:'http://127.0.0.1:8789',FABLE_QA_EVIDENCE:evidence},timeout:150000});console.log(regression.stdout.trim());
  await mf.dispose();mf=new Miniflare(options);await mf.ready;
  const restarted=await context.request.get(`http://127.0.0.1:8789/api/stories/${id}`);const reopened=await restarted.json();assert.equal(reopened.status,'completed');assert.equal(reopened.result.markdown,doc.result.markdown);
  assert.equal((await context.request.get(`http://127.0.0.1:8789${doc.result.image.url}`)).status(),200);
  assert.deepEqual(errors,[]);console.log('PASS: real local Workflow + D1 + R2; creation, full text and image persistence, reload, idempotency, private access, sharing/revocation, offline download, failure retention, 4 locales at 3 widths.');
  await writeFile(`${evidence}/local-qa.json`,JSON.stringify({passed:true,providerCalls:calls.length,errors},null,2));
}catch(error){console.error('Local provider calls:',calls);console.error(await(await mf.getD1Database('DB')).prepare('SELECT status,error FROM creations').all());throw error;}finally{await browser?.close();await mf.dispose();await rm(persist,{recursive:true,force:true});}
