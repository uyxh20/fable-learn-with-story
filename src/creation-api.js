export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export async function hash(value) {
  const bytes = await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));
  return [...new Uint8Array(bytes)].map(b=>b.toString(16).padStart(2,'0')).join('');
}
export async function boundedJSON(response, limit) {
  if (Number(response.headers.get('Content-Length')) > limit) throw new Error('payload_too_large');
  const reader = response.body?.getReader();
  if (!reader) throw new Error('invalid_json');
  const parts=[]; let size=0;
  for (;;) { const {value,done}=await reader.read(); if(done) break; size+=value.length;
    if(size>limit) { await reader.cancel(); throw new Error('payload_too_large'); } parts.push(value); }
  const bytes=new Uint8Array(size); let offset=0;
  for(const p of parts){bytes.set(p,offset);offset+=p.length;}
  try { return JSON.parse(new TextDecoder().decode(bytes)); } catch {throw new Error('invalid_json');}
}
export function ownerCookie(request) {
  const value=request.headers.get('Cookie')?.split(';').map(x=>x.trim()).find(x=>x.startsWith('fable-creator='))?.slice(14);
  return /^[a-f0-9]{64}$/.test(value||'') ? value : null;
}
export function generationEnabled(env) {
  return !!(env.GENERATION_ENABLED==='true' && env.OPENROUTER_API_KEY && env.LLM_MODEL && env.IMAGE_MODEL && env.DB && env.STORIES && env.GENERATE);
}
export function validateCreation(data) {
  if(!data || !UUID.test(data.idempotency_token||'') || typeof data.concept!=='string' || data.concept.trim().length<2 || data.concept.length>2000 ||
    !['en','fr','da','zh'].includes(data.lang) || !['Chinese classical','Greek myth','Fairy tale','Contemporary'].includes(data.setting)) throw new Error('invalid_request');
  return {concept:data.concept.trim(),lang:data.lang,setting:data.setting};
}
const friendlyError = 'This fable could not be completed. Finished scenes and pictures are saved. Please try a new fable later.';

export async function creationResponse(request,env,json) {
  const url=new URL(request.url), path=url.pathname;
  if(path==='/api/config') return json({generation_enabled:generationEnabled(env),storage_enabled:!!(env.DB&&env.STORIES)});
  if(!env.DB||!env.STORIES) return json({error:'generation_unavailable',detail:'Creation is not connected yet. Please enjoy the sample.'},503);
  const mutation=!['GET','HEAD'].includes(request.method);
  if(mutation && request.headers.get('Origin')!==url.origin) return json({error:'origin_not_allowed'},403);
  if(path==='/api/session' && request.method==='POST') {
    const response=json({ok:true});
    if(!ownerCookie(request)) {
      const token=[...crypto.getRandomValues(new Uint8Array(32))].map(b=>b.toString(16).padStart(2,'0')).join('');
      response.headers.set('Set-Cookie',`fable-creator=${token}; HttpOnly; SameSite=Strict; Path=/api; Max-Age=31536000${url.protocol==='https:'?'; Secure':''}`);
    }
    return response;
  }
  const cookie=ownerCookie(request), owner=cookie?await hash(cookie):null;
  const shared=path.match(/^\/api\/shared\/([a-f0-9]{64})(\/image(?:\/[0-2])?)?$/);
  const story=path.match(/^\/api\/stories\/([a-f0-9-]+)(\/(?:image(?:\/[0-2])?|share))?$/);
  const job=path.match(/^\/api\/generations\/([a-f0-9-]+)$/);
  if(shared || story || job) {
    if(request.method!=='GET' && !(story?.[2]==='/share' && ['POST','DELETE'].includes(request.method))) return json({error:'method_not_allowed'},405);
    const row=shared ? await env.DB.prepare('SELECT * FROM creations WHERE share_token=? AND status=\'completed\'').bind(shared[1]).first()
      : owner && UUID.test((story||job)[1]) ? await env.DB.prepare('SELECT * FROM creations WHERE id=? AND owner=?').bind((story||job)[1],owner).first() : null;
    if(!row) return json({error:'story_not_found'},404);
    if(story?.[2]==='/share') {
      if(!['POST','DELETE'].includes(request.method)) return json({error:'method_not_allowed'},405);
      if(row.status!=='completed') return json({error:'story_not_ready'},409);
      if(request.method==='DELETE') {await env.DB.prepare('UPDATE creations SET share_token=NULL WHERE id=? AND owner=?').bind(row.id,owner).run();return json({shared:false});}
      const token=row.share_token || [...crypto.getRandomValues(new Uint8Array(32))].map(b=>b.toString(16).padStart(2,'0')).join('');
      await env.DB.prepare('UPDATE creations SET share_token=COALESCE(share_token,?) WHERE id=? AND owner=?').bind(token,row.id,owner).run();
      const saved=await env.DB.prepare('SELECT share_token FROM creations WHERE id=?').bind(row.id).first();
      return json({url:`${url.origin}/?share=${saved.share_token}#read/cover`});
    }
    if(shared?.[2] || story?.[2]?.startsWith('/image')) {
      const index=Number((shared||story)[2].split('/')[2]||0);
      const object=await env.STORIES.get(`creations/${row.id}/${index===0?'cover':`scene-${index}`}`);
      if(!object) return json({error:'image_not_found'},404);
      const response=new Response(object.body,{headers:{'Content-Type':object.httpMetadata.contentType,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'}});
      return response;
    }
    const object=await env.STORIES.get(`creations/${row.id}/story.json`);
    const doc=object ? await object.json():null;
    const imageBase=shared?`/api/shared/${shared[1]}/image`:`/api/stories/${row.id}/image`;
    const images=doc?await Promise.all((doc.scenes||[{}]).map(async(_,index)=>await env.STORIES.head(`creations/${row.id}/${index===0?'cover':`scene-${index}`}`)?{url:`${imageBase}/${index}`}:null)):[];
    const result=doc?{title:doc.title,markdown:doc.markdown,lang:doc.lang,setting:doc.setting,concept:shared?'':doc.concept,text_complete:doc.text_complete!==false,image:images[0]||null,...(doc.scenes?{scenes:doc.scenes.map((scene,index)=>({text:scene.text,image:images[index]}))}:{})}:null;
    return json({job_id:row.id,story_id:row.id,status:row.status,stage:row.status==='illustrating'?'image_call_started':row.status==='completed'?'complete':'story_call_started',
      ...(row.error?{error:friendlyError}:{}),...(row.status==='completed'?{result}:result?{partial_result:result}:{}),share_url:!shared&&row.share_token?`${url.origin}/?share=${row.share_token}#read/cover`:null});
  }
  if(path==='/api/stories' && request.method==='GET') {
    if(!owner) return json({stories:[]});
    const rows=await env.DB.prepare('SELECT id,title,status,error,created_at,request_json FROM creations WHERE owner=? ORDER BY created_at DESC LIMIT 30').bind(owner).all();
    return json({stories:rows.results.map(({request_json,error,...row})=>({...row,concept:JSON.parse(request_json).concept,...(error?{error:friendlyError}:{})}))});
  }
  if(path!=='/api/generations'||request.method!=='POST') return json({error:'not_found'},404);
  if(!generationEnabled(env)) return json({error:'generation_unavailable',detail:'Creation is being connected. Please enjoy the sample for now.'},503);
  if(!owner) return json({error:'session_required'},401);
  if(!request.headers.get('Content-Type')?.startsWith('application/json')) return json({error:'invalid_content_type'},415);
  let data, input;
  try {data=await boundedJSON(request,8192);input=validateCreation(data);}catch(e){return json({error:e.message},e.message==='payload_too_large'?413:400);}
  const requestJSON=JSON.stringify(input);
  let row=await env.DB.prepare('SELECT * FROM creations WHERE owner=? AND idempotency=?').bind(owner,data.idempotency_token).first();
  if(row && row.request_json!==requestJSON) return json({error:'idempotency_conflict'},409);
  if(!row) {
    const id=crypto.randomUUID(), now=new Date().toISOString(), day=now.slice(0,10);
    const ip=await hash(`${day}:${request.headers.get('CF-Connecting-IP')||'local'}`);
    const globalLimit=Math.min(100,Math.max(1,Number(env.DAILY_CREATION_LIMIT)||20));
    // One atomic SQL reservation covers concurrency and global/browser/network quotas.
    await env.DB.prepare(`INSERT OR IGNORE INTO creations (id,owner,ip_hash,idempotency,request_json,created_at,updated_at)
      SELECT ?,?,?,?,?,?,? WHERE (SELECT COUNT(*) FROM creations WHERE created_at>=?)<?
      AND (SELECT COUNT(*) FROM creations WHERE owner=? AND created_at>=?)<3
      AND (SELECT COUNT(*) FROM creations WHERE ip_hash=? AND created_at>=?)<5
      AND NOT EXISTS (SELECT 1 FROM creations WHERE owner=? AND status IN ('queued','writing','illustrating'))`)
      .bind(id,owner,ip,data.idempotency_token,requestJSON,now,now,day,globalLimit,owner,day,ip,day,owner).run();
    row=await env.DB.prepare('SELECT * FROM creations WHERE owner=? AND idempotency=?').bind(owner,data.idempotency_token).first();
    if(!row) return json({error:'creation_limit',detail:'A fable is already being created, or today’s creation limit has been reached. Please try later.'},429);
  }
  if(row.status==='queued') {
    try {await env.GENERATE.create({id:row.id,params:{id:row.id}});}
    catch {
      // A repeated POST may race the first dispatch. Verify before declaring failure.
      try {const instance=await env.GENERATE.get(row.id);await instance.status();}
      catch {await env.DB.prepare("UPDATE creations SET status='failed',error='dispatch_failed' WHERE id=? AND status='queued'").bind(row.id).run();return json({error:'generation_unavailable'},503);}
    }
  }
  return json({job_id:row.id,story_id:row.id,status:row.status},202);
}
