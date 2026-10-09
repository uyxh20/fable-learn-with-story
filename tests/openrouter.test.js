import test from 'node:test';
import assert from 'node:assert/strict';
import { generatePlan,generateText,generateImage,planModel } from '../src/openrouter.js';
import { readableText,completedScenes } from '../src/text-stream.js';
import { boundedJSON,validateCreation,generationEnabled } from '../src/creation-api.js';
const env={OPENROUTER_API_KEY:'test-only',LLM_MODEL:'test/text',IMAGE_MODEL:'google/test-image'};
const input={concept:'Compound growth',lang:'en',setting:'Chinese classical'};
const content={title:'The orchard',visual_guide:'The same old gardener in blue robes.',scenes:Array.from({length:3},(_,i)=>({text:`Season ${i+1}. `+'The gardener planted a tree. '.repeat(8),image_prompt:`The gardener in season ${i+1}.`})),explanation:'Each seed grows from the previous harvest.',image_prompt:'A gardener in an orchard.'};
const plan={...content,lesson:content.explanation,scenes:content.scenes.map(s=>({beat:'A seed grows into a tree.',image_prompt:s.image_prompt}))};
const prose={scenes:content.scenes.map(s=>({text:s.text})),explanation:content.explanation};
function stream(parts,{finish='stop',done=true,error=false}={}) {
  const frames=[': heartbeat\r\n\r\n',...parts.map(content=>`data: ${JSON.stringify({choices:[{delta:{content}}]})}\r\n\r\n`),`data: ${JSON.stringify(error?{error:{message:'sensitive provider details'}}:{choices:[{delta:{},finish_reason:finish}],usage:{cost:0.01}})}\r\n\r\n`,...(done?['data: [DONE]\r\n\r\n']:[])];
  // Split every UTF-8 byte and SSE boundary to exercise fragmented network reads.
  const bytes=new TextEncoder().encode(frames.join(''));let i=0;
  return new Response(new ReadableStream({pull(controller){if(i<bytes.length)controller.enqueue(bytes.slice(i,i+=7));else controller.close();}}),{headers:{'Content-Type':'text/event-stream'}});
}
test('compact storyboard uses the fast plan model at medium effort and three fixed scene/image pairs',async()=>{
  const doc=await generatePlan({...env,PLAN_MODEL:'test/plan'},input,async(url,options)=>{
    assert.equal(url,'https://openrouter.ai/api/v1/chat/completions');assert.equal(options.redirect,'manual');assert.equal(options.headers.Authorization,'Bearer test-only');
    const body=JSON.parse(options.body);assert.equal(body.model,'test/plan');assert.equal(body.max_tokens,2500);assert.deepEqual(body.reasoning,{effort:'medium',exclude:true});assert.equal(body.response_format.json_schema.strict,true);assert.deepEqual(body.provider,{require_parameters:true});
    assert.ok(body.response_format.json_schema.schema.required.includes('audience'));
    return Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify({...plan,audience:'a seven-year-old'})}}],usage:{cost:0.001}});
  });
  assert.equal(doc.plan_usage.cost,0.001);assert.equal(doc.scenes.length,3);assert.equal(doc.audience,'a seven-year-old');assert.equal(JSON.stringify(doc).includes('test-only'),false);
  assert.equal(planModel(env),'test/text');assert.equal(planModel({...env,PLAN_MODEL:'x'}),'x');
  const legacy=await generatePlan(env,input,async()=>Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify(plan)}}]}));
  assert.equal(legacy.audience,'a curious adult');
});
test('stream publishes complete scenes before the explanation and keeps exact illustration prompts',async()=>{
  const updates=[];const escaped={...prose,scenes:prose.scenes.map(s=>({text:s.text+' 他説："[braces {inside} strings]" \\ 🌱'}))};
  const doc=await generateText(env,input,plan,async doc=>updates.push(doc),async(url,options)=>{
    const body=JSON.parse(options.body);assert.equal(body.stream,true);assert.equal(body.model,'test/text');assert.equal(body.max_tokens,12000);assert.equal(body.reasoning.effort,'low');assert.deepEqual(body.provider,{require_parameters:true});
    assert.ok(body.messages[0].content.includes('a curious adult'));assert.equal(JSON.parse(body.messages[1].content).audience,'a curious adult');
    return stream(['{"scenes":[',...escaped.scenes.map((s,i)=>(i?',':'')+JSON.stringify(s)),'],"explanation":'+JSON.stringify(prose.explanation)+'}']);
  });
  assert.deepEqual(updates.map(d=>d.scenes.filter(s=>!s.partial).length),[1,2,3]);assert.ok(updates.every(d=>!d.text_complete&&!d.markdown.includes(prose.explanation)));
  assert.ok(escaped.scenes.every(s=>doc.markdown.includes(s.text)));assert.equal(doc.scenes[1].image_prompt,plan.scenes[1].image_prompt);assert.equal(doc.text_complete,true);assert.equal(doc.text_usage.cost,0.01);
});
test('truncated and failed streams retain already-published scenes without exposing provider errors',async()=>{
  for(const options of [{finish:'length'},{done:false},{error:true}]) {
    const updates=[];
    await assert.rejects(generateText(env,input,plan,d=>updates.push(d),async()=>stream(['{"scenes":['+JSON.stringify(prose.scenes[0])],options)),/incomplete_text|provider_text_failed/);
    assert.equal(updates.length,1);assert.equal(updates[0].text_complete,false);
  }
  await assert.rejects(generateText(env,input,plan,null,async()=>stream(['not JSON'])),/invalid_text_json/);
  await assert.rejects(generatePlan(env,input,async()=>new Response('sensitive provider details',{status:401})),/^Error: provider_text_failed$/);
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

test('Seedream uses its supported resolution parameters and persists raster output',async()=>{
  const bytes=Buffer.from([137,80,78,71,13,10,26,10]);
  const result=await generateImage({...env,IMAGE_MODEL:'bytedance-seed/seedream-5-0-flash'},content,async(url,options)=>{
    assert.equal(url,'https://openrouter.ai/api/v1/images');const body=JSON.parse(options.body);
    assert.equal(body.model,'bytedance-seed/seedream-5-0-flash');assert.equal(body.resolution,'1K');assert.equal(body.aspect_ratio,'16:9');assert.equal(body.n,1);assert.equal(body.quality,undefined);
    return Response.json({data:[{b64_json:bytes.toString('base64'),media_type:'image/png'}]});
  });
  assert.equal(result.type,'image/png');assert.deepEqual(Buffer.from(result.bytes),bytes);
});

test('invalid plans and prose never become a completed fable',async()=>{
  for(const scenes of [plan.scenes.slice(0,2),[...plan.scenes,plan.scenes[0]],plan.scenes.map((s,i)=>i===1?{...s,image_prompt:''}:s)]) {
    await assert.rejects(generatePlan(env,input,async()=>Response.json({choices:[{message:{content:JSON.stringify({...plan,scenes})}}]})),/invalid_text_fields/);
  }
  for(const scenes of [prose.scenes.slice(0,2),[...prose.scenes,prose.scenes[0]],[{text:'Too short'}]]) {
    await assert.rejects(generateText(env,input,plan,null,async()=>stream([JSON.stringify({...prose,scenes})])),/invalid_text_fields/);
  }
});

test('sentence-complete fragments of the scene being written are published, never half sentences or escapes',async()=>{
  assert.equal(readableText('The gardener waited. Then she'),'The gardener waited.');
  assert.equal(readableText('He said "Wait." Then'),'He said "Wait."');
  assert.equal(readableText('园丁等待着。然后她'),'园丁等待着。');
  assert.equal(readableText('No boundary yet'),'');
  assert.equal(readableText('One paragraph\n\nSecond starts'),'One paragraph');
  const partial='{"scenes":[{"text":"First sentence here. Second one \\u00e9';
  assert.deepEqual(completedScenes(partial),[]);
  const updates=[];const text='Rain fell on the orchard for a week. '.repeat(4);
  const pieces=['{"scenes":[{"text":"'+text.slice(0,50),text.slice(50,120),text.slice(120)+'"}',',{"text":"'+text+'"}',',{"text":"'+text+'"}],"explanation":"The end."}'];
  const doc=await generateText(env,input,{...plan,audience:'a child'},async d=>updates.push(d),async(url,options)=>{
    assert.ok(JSON.parse(options.body).messages[0].content.includes('Write for a child'));return stream(pieces);
  });
  assert.ok(updates[0].scenes[0].partial);assert.ok(updates[0].scenes[0].text.endsWith('week.'));assert.ok(text.startsWith(updates[0].scenes[0].text));
  assert.ok(updates[0].markdown.includes(updates[0].scenes[0].text));
  const closed=updates.filter(d=>!d.scenes.some(s=>s.partial));assert.deepEqual(closed.map(d=>d.scenes.length),[1,2,3]);
  assert.equal(doc.text_complete,true);assert.equal(doc.scenes.length,3);assert.ok(doc.scenes.every(s=>!s.partial));
});
