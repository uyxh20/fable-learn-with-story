import { WorkflowEntrypoint } from 'cloudflare:workers';
import { generateText, generateImage } from './openrouter.js';

// Retry transient storage failures without repeating a billed provider request.
async function save(operation) {
  for(let attempt=0;;attempt++) {
    try {return await operation();} catch(error) {
      if(attempt===2) throw error;
      await new Promise(resolve=>setTimeout(resolve,1000*(attempt+1)));
    }
  }
}

export class GenerateFable extends WorkflowEntrypoint {
  async run(event,step) {
    const id=event.payload.id, env=this.env;
    try {
      await step.do('write and save story',{retries:{limit:0,delay:'1 second'},timeout:'3 minutes'},async()=>{
        if(await env.STORIES.head(`creations/${id}/story.json`)) return;
        const row=await env.DB.prepare('SELECT * FROM creations WHERE id=?').bind(id).first();
        if(!row) throw new Error('missing_creation');
        const reserved=await env.DB.prepare("UPDATE creations SET text_started=1,status='writing',updated_at=? WHERE id=? AND text_started=0").bind(new Date().toISOString(),id).run();
        if(!reserved.meta.changes) throw new Error('text_needs_reconciliation');
        const doc=await generateText(env,JSON.parse(row.request_json));
        await save(()=>env.STORIES.put(`creations/${id}/story.json`,JSON.stringify(doc),{httpMetadata:{contentType:'application/json'}}));
      });
      await step.do('mark saved text',async()=>{
        const object=await env.STORIES.get(`creations/${id}/story.json`),doc=await object.json();
        await env.DB.prepare("UPDATE creations SET title=?,status='illustrating',updated_at=? WHERE id=?").bind(doc.title,new Date().toISOString(),id).run();
      });
      await step.do('illustrate and save image',{retries:{limit:0,delay:'1 second'},timeout:'5 minutes'},async()=>{
        if(await env.STORIES.head(`creations/${id}/cover`)) return;
        const reserved=await env.DB.prepare('UPDATE creations SET image_started=1 WHERE id=? AND image_started=0').bind(id).run();
        if(!reserved.meta.changes) throw new Error('image_needs_reconciliation');
        const object=await env.STORIES.get(`creations/${id}/story.json`),doc=await object.json();
        const image=await generateImage(env,doc);
        await save(()=>env.STORIES.put(`creations/${id}/cover`,image.bytes,{httpMetadata:{contentType:image.type}}));
        await save(()=>env.STORIES.put(`creations/${id}/image-metadata.json`,JSON.stringify({model:env.IMAGE_MODEL,prompt:doc.image_prompt,usage:image.usage}),{httpMetadata:{contentType:'application/json'}}));
      });
      await step.do('complete saved book',async()=>{
        await env.DB.prepare("UPDATE creations SET status='completed',updated_at=? WHERE id=?").bind(new Date().toISOString(),id).run();
      });
      return {story_id:id};
    } catch(error) {
      await step.do('record failure',async()=>{
        const code=/^[a-z_]+$/.test(error.message||'')?error.message:'generation_failed';
        await env.DB.prepare("UPDATE creations SET status='failed',error=?,updated_at=? WHERE id=?").bind(code,new Date().toISOString(),id).run();
      });
      return {story_id:id,status:'failed'};
    }
  }
}
