import test from 'node:test';
import assert from 'node:assert/strict';
import { generateText,generateImage } from '../src/openrouter.js';
import { boundedJSON,validateCreation,generationEnabled } from '../src/creation-api.js';
const env={OPENROUTER_API_KEY:'test-only',LLM_MODEL:'test/text',IMAGE_MODEL:'google/test-image'};
const input={concept:'Compound growth',lang:'en',setting:'Chinese classical'};
const content={title:'The orchard',story:'The gardener planted a tree. '.repeat(12),explanation:'Each seed grows from the previous harvest.',image_prompt:'A gardener in an orchard.'};
test('provider requests use only the server secret; complete story and usage are preserved',async()=>{
  const doc=await generateText(env,input,async(url,options)=>{
    assert.equal(url,'https://openrouter.ai/api/v1/chat/completions');assert.equal(options.redirect,'manual');
    assert.equal(options.headers.Authorization,'Bearer test-only');assert.equal(JSON.parse(options.body).max_tokens,4000);
    return Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify(content)}}],usage:{cost:0.01}});
  });
  assert.ok(doc.markdown.includes(content.story));assert.ok(doc.markdown.includes(content.explanation));assert.equal(doc.text_usage.cost,0.01);
  assert.equal(JSON.stringify(doc).includes('test-only'),false);
});
test('truncated, malformed and rejected provider results fail without leaking provider errors',async()=>{
  await assert.rejects(generateText(env,input,async()=>Response.json({choices:[{finish_reason:'length'}]})),/incomplete_text/);
  await assert.rejects(generateText(env,input,async()=>Response.json({choices:[{message:{content:'not JSON'}}]})),/invalid_text/);
  await assert.rejects(generateText(env,input,async()=>new Response('sensitive provider details',{status:401})),/^Error: provider_text_failed$/);
});
test('image output must be bounded raster bytes, never a URL or SVG',async()=>{
  await assert.rejects(generateImage(env,content,async()=>Response.json({data:[{url:'https://example.com/image'}]})),/invalid_image/);
  await assert.rejects(generateImage(env,content,async()=>Response.json({data:[{b64_json:Buffer.from('<svg/>').toString('base64')}]})),/invalid_image/);
  await assert.rejects(boundedJSON(new Response('0123456789'),5),/payload_too_large/);
});
test('generation stays disabled until storage, workflow, key and both models exist',()=>{
  assert.equal(generationEnabled({...env,GENERATION_ENABLED:'true'}),false);
  assert.equal(generationEnabled({...env,GENERATION_ENABLED:'true',DB:{},STORIES:{},GENERATE:{}}),true);
  assert.throws(()=>validateCreation({...input,idempotency_token:crypto.randomUUID(),concept:'x'.repeat(2001)}),/invalid_request/);
  assert.throws(()=>validateCreation({...input,idempotency_token:crypto.randomUUID(),lang:'unknown'}),/invalid_request/);
});
