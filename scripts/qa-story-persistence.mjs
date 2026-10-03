import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { mkdir, writeFile } from 'node:fs/promises';

const bundle = await build({entryPoints:['src/worker.js'],bundle:true,format:'esm',platform:'browser',write:false});
const config = convertV4MiniflareOptions({modules:true,script:bundle.outputFiles[0].text,compatibilityDate:'2026-10-02',host:'127.0.0.1',port:0,
  r2Buckets:['STORIES'],resourcePersistencePath:'.local-preview/persistence-test',bindings:{LOCAL_STORY_WRITES:'true'}});
let mf = new Miniflare(config);
const origin = 'http://localhost';
const story = { id:crypto.randomUUID(), title:'Restart proof', concept:'Persistence', lang:'en', setting:'Chinese classical', markdown:'# A story\n\nThis text must survive a real runtime restart.\n\n## Explanation\n\nThe whole story is retained.', image:'data:image/png;base64,aGVsbG8=', status:'partial' };
try {
  const first = await mf.dispatchFetch(`${origin}/api/stories`, {method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(story)});
  assert.equal(first.status,200);
  const cookie = first.headers.get('Set-Cookie').split(';')[0];
  const post = value => mf.dispatchFetch(`${origin}/api/stories`, {method:'POST',headers:{Origin:origin,'Content-Type':'application/json',Cookie:cookie},body:JSON.stringify(value)});
  const complete = {...story,status:'complete',markdown:`${story.markdown}\n\nFinal revision.`};
  assert.equal((await post(complete)).status,200);
  assert.equal((await post(story)).status,200); // late partial cannot erase completion
  await mf.dispose();
  mf = new Miniflare(config);
  const response = await mf.dispatchFetch(`${origin}/api/stories/${story.id}`, {headers:{Cookie:cookie}});
  assert.equal(response.status,200);
  const restored = (await response.json()).story;
  assert.equal(restored.markdown,complete.markdown);
  assert.equal(restored.image,complete.image);
  assert.equal(restored.status,'complete');
  assert.equal((await post(complete)).status,200);
  assert.equal((await mf.dispatchFetch(`${origin}/api/stories/${story.id}`)).status,404);
  const result = 'PASS: local R2 story and embedded image survive runtime restart; partial-to-final CAS, retries, and owner isolation verified.';
  await mkdir('.gstack/homepage-study-2026-10-03',{recursive:true});
  await writeFile('.gstack/homepage-study-2026-10-03/persistence-check.txt',result+'\n');
  console.log(result);
} finally { await mf.dispose(); }
