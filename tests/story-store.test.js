import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import worker from '../src/worker.js';
import { MAX_STORY_BYTES, saveStory } from '../src/story-store.js';

const origin = 'http://localhost:8788';
const fixture = (patch = {}) => ({ id:crypto.randomUUID(), title:'The Hall of Affairs', concept:'AI agents', lang:'en', setting:'Chinese classical', markdown:'# A fable\n\nThe entire story.\n\n## Explanation\n\nThe lesson.', image:'/art/cover.png', status:'complete', ...patch });
function bucket() {
  const data = new Map();
  return { data,
    async get(key) { const value = data.get(key); return value ? { etag:value.etag, json:async () => JSON.parse(value.body) } : null; },
    async put(key, body, options) {
      const old = data.get(key);
      if (options.onlyIf.etagDoesNotMatch === '*' && old || options.onlyIf.etagMatches && old?.etag !== options.onlyIf.etagMatches) return null;
      const etag = crypto.randomUUID(); data.set(key, { body, etag }); return { etag };
    },
  };
}
const post = (story, cookie, extra = {}) => new Request(`${origin}/api/stories`, { method:'POST', headers:{ 'Content-Type':'application/json', Origin:origin, ...(cookie ? {Cookie:cookie} : {}), ...extra }, body:JSON.stringify(story) });
const envFor = store => ({ STORIES:store, LOCAL_STORY_WRITES:'true' });

test('story is durable in the bucket, private to its cookie, and retry-safe', async () => {
  const store = bucket(); const story = fixture(); const env = envFor(store);
  const saved = await worker.fetch(post(story), env); assert.equal(saved.status, 200);
  const cookie = saved.headers.get('Set-Cookie').split(';')[0];
  assert.match(saved.headers.get('Set-Cookie'), /HttpOnly; SameSite=Strict/);
  assert.equal(store.data.size, 1);
  const read = await worker.fetch(new Request(`${origin}/api/stories/${story.id}`, {headers:{Cookie:cookie}}), env);
  assert.equal((await read.json()).story.markdown, story.markdown);
  assert.equal(read.headers.get('Cache-Control'), 'no-store');
  for (const headers of [{}, {Cookie:`fable-owner=${'a'.repeat(64)}`}]) {
    assert.equal((await worker.fetch(new Request(`${origin}/api/stories/${story.id}`, {headers}), env)).status, 404);
  }
  assert.equal((await worker.fetch(post(story, cookie), env)).status, 200);
  assert.equal(store.data.size, 1);
  assert.equal((await worker.fetch(post({...story, markdown:'Changed'}, cookie), env)).status, 409);
  assert.equal((await worker.fetch(new Request(`${origin}/api/stories`, {method:'GET', headers:{Cookie:cookie}}), env)).status, 405);
});

test('partial stories upgrade atomically; late partials cannot erase final output', async () => {
  const store = bucket(); const story = fixture({status:'partial'});
  await saveStory(store, 'owner', story);
  const complete = {...story, status:'complete', markdown:'Complete story with illustration', image:'data:image/png;base64,aGVsbG8='};
  await Promise.all([saveStory(store, 'owner', complete), saveStory(store, 'owner', complete)]);
  const result = await saveStory(store, 'owner', {...story, markdown:'Stale partial'});
  assert.equal(result.status, 'complete'); assert.equal(result.markdown, complete.markdown); assert.equal(store.data.size, 1);
});

test('local scope, request validation, and storage errors fail closed', async () => {
  const env = envFor(bucket()); const story = fixture();
  assert.equal((await worker.fetch(post(story), {})).status, 503);
  assert.equal((await worker.fetch(new Request('https://fable.example/api/stories', {method:'POST', body:JSON.stringify(story)}), env)).status, 503);
  assert.equal((await worker.fetch(post(story, null, {Origin:'https://elsewhere.example'}), env)).status, 403);
  for (const patch of [{id:'../../secret'}, {lang:'xx'}, {markdown:''}, {title:123}, {image:'https://remote.example/expiring.png'}, {image:'data:image/svg+xml;base64,aGVsbG8='}]) {
    assert.equal((await worker.fetch(post({...story, ...patch}), env)).status, 400);
  }
  assert.equal((await worker.fetch(post(story, null, {'Content-Type':'text/plain'}), env)).status, 415);
  const oversized = new Request(`${origin}/api/stories`, {method:'POST', headers:{Origin:origin,'Content-Type':'application/json'}, body:'x'.repeat(MAX_STORY_BYTES + 1)});
  assert.equal((await worker.fetch(oversized, env)).status, 413);
  const malformed = new Request(`${origin}/api/stories`, {method:'POST', headers:{Origin:origin,'Content-Type':'application/json'}, body:'{'});
  assert.equal((await worker.fetch(malformed, env)).status, 400);
  const broken = envFor({get(){throw new Error('secret detail');}});
  const response = await worker.fetch(post(story), broken); assert.equal(response.status, 503);
  assert.doesNotMatch(await response.text(), /secret detail/);
});

test('server-backed reader retains every paragraph and restores the saved job route', async () => {
  let polls=0; const markdown='# A story\n\n'+Array.from({length:20},(_,i)=>`Paragraph ${i}: `+'A meaningful sentence. '.repeat(25)).join('\n\n')+'\n\n### After the story\n\nThe explanation.';
  const window={location:{search:'',protocol:'http:'}};const routes=[];
  vm.runInNewContext(await readFile(new URL('../src/live-fable.js',import.meta.url),'utf8'),{window,URLSearchParams,crypto,history:{replaceState(a,b,url){routes.push(url);}},setTimeout(fn){fn();},
    async fetch(path){if(path==='/api/session')return Response.json({ok:true});if(path==='/api/generations')return Response.json({job_id:'job',story_id:'job'});polls++;return Response.json({status:'completed',story_id:'job',result:{title:'Complete book',lang:'en',concept:'AI',setting:'Chinese classical',markdown,image:{url:'/api/stories/job/image'}}});}});
  const result=await window.FABLE_LIVE.generate({request:{concept:'AI',setting:'Chinese classical'},lang:'en'});
  assert.equal(result.storyId,'job');assert.equal(result.pages[0].title,'Complete book');assert.equal(result.markdown,markdown);
  assert.ok(result.pages.some(p=>p.raw?.includes('Paragraph 19')));assert.deepEqual(routes,['/?story=job#read/cover']);assert.equal(polls,1);
});

test('scene text keeps its corresponding image through reader pagination',async()=>{
  const window={};vm.runInNewContext(await readFile(new URL('../src/live-fable.js',import.meta.url),'utf8'),{window});
  const scenes=Array.from({length:3},(_,i)=>({text:`Scene ${i+1}. `+'A paragraph about this scene. '.repeat(30)+'\n\n'+'The same scene continues. '.repeat(30),image:{url:`/image/${i}`}}));
  const pages=window.FABLE_LIVE.buildPages({title:'Three scenes',lang:'en',markdown:'# Three scenes\n\nStory\n\n### After the story\n\nExplanation.',scenes,imageSrc:'/image/0'});
  const story=pages.filter(p=>p.kind==='Story');assert.equal(story.length,6);
  story.forEach((page,i)=>assert.equal(page.image,scenes[Math.floor(i/2)].image.url));
  assert.equal(pages.at(-1).image,'/image/2');
});


test('reader receives every saved scene/image update and withholds the explanation until ready',async()=>{
  const window={},updates=[];let polls=0;
  const scene={text:'The first complete scene. '+ 'A tree grows. '.repeat(50)};
  const states=[{status:'writing',partial_result:{scenes:[scene],text_complete:false}},
    {status:'writing',partial_result:{scenes:[{...scene,image:{url:'/image/0'}}],text_complete:false}},
    {status:'completed',result:{scenes:[scene,scene,scene],text_complete:true}}];
  vm.runInNewContext(await readFile(new URL('../src/live-fable.js',import.meta.url),'utf8'),{window,URLSearchParams,setTimeout(fn){fn();},async fetch(){const state=states[polls++],key=state.result?'result':'partial_result';return Response.json({...state,story_id:'job',[key]:{title:'Growing',lang:'en',markdown:'# Growing\n\nStory\n\n### After the story\n\nLesson',...state[key]}});}});
  const final=await window.FABLE_LIVE.load('job','',()=>true,book=>updates.push(book));
  assert.equal(updates.length,2);assert.equal(updates[0].generating,true);assert.equal(updates[0].pages.some(p=>p.kind==='Lesson'),false);
  assert.equal(updates[1].run.images[0].src,'/image/0');assert.equal(final.generating,false);assert.equal(final.partial,false);assert.equal(final.pages.at(-1).kind,'Lesson');
});
