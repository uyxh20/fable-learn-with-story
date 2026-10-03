import { WorkflowEntrypoint } from 'cloudflare:workers';
import { generatePlan, generateText, generateImage } from './openrouter.js';

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
      const plan=await step.do('plan and save storyboard',{retries:{limit:0,delay:'1 second'},timeout:'5 minutes'},async()=>{
        const existing=await env.STORIES.get(`creations/${id}/plan.json`);
        if(existing)return existing.json();
        const row=await env.DB.prepare('SELECT * FROM creations WHERE id=?').bind(id).first();
        if(!row)throw new Error('missing_creation');
        const reserved=await env.DB.prepare("UPDATE creations SET text_started=text_started|1,status='writing',updated_at=? WHERE id=? AND (text_started&1)=0").bind(new Date().toISOString(),id).run();
        if(!reserved.meta.changes)throw new Error('text_needs_reconciliation');
        const plan=await generatePlan(env,JSON.parse(row.request_json));
        await save(()=>env.STORIES.put(`creations/${id}/plan.json`,JSON.stringify(plan),{httpMetadata:{contentType:'application/json'}}));
        return plan;
      });
      await step.do('save story title',async()=>{await env.DB.prepare('UPDATE creations SET title=? WHERE id=?').bind(plan.title,id).run();});
      // A single streamed prose request overlaps all three illustration requests.
      // Each closed scene is durably saved before the reader can discover it.
      const prose=step.do('write and save story',{retries:{limit:0,delay:'1 second'},timeout:'5 minutes'},async()=>{
        const existing=await env.STORIES.get(`creations/${id}/story.json`);
        if(existing&&(await existing.json()).text_complete)return;
        const reserved=await env.DB.prepare('UPDATE creations SET text_started=text_started|2 WHERE id=? AND (text_started&2)=0').bind(id).run();
        if(!reserved.meta.changes)throw new Error('text_needs_reconciliation');
        const persist=doc=>save(()=>env.STORIES.put(`creations/${id}/story.json`,JSON.stringify(doc),{httpMetadata:{contentType:'application/json'}}));
        const doc=await generateText(env,plan,plan,persist);
        await persist(doc);
        await env.DB.prepare("UPDATE creations SET status='illustrating',updated_at=? WHERE id=?").bind(new Date().toISOString(),id).run();
      }).then(()=>null,error=>error.message||'generation_failed');
      const scenes=plan.scenes;
      const illustrations=Promise.all(scenes.map(async(scene,index)=>{
        try {
          await step.do(index===0?'illustrate and save image':`illustrate scene ${index+1}`,{retries:{limit:0,delay:'1 second'},timeout:'5 minutes'},async()=>{
            const key=index===0?'cover':`scene-${index}`,bit=1<<index;
            if(await env.STORIES.head(`creations/${id}/${key}`)) return;
            const reserved=await env.DB.prepare('UPDATE creations SET image_started=image_started|? WHERE id=? AND (image_started&?)=0').bind(bit,id,bit).run();
            if(!reserved.meta.changes) throw new Error('image_needs_reconciliation');
            const prompt=`${plan.visual_guide}\nScene ${index+1}: ${scene.image_prompt}`;
            const image=await generateImage(env,{image_prompt:prompt});
            await save(()=>env.STORIES.put(`creations/${id}/${key}`,image.bytes,{httpMetadata:{contentType:image.type}}));
            await save(()=>env.STORIES.put(`creations/${id}/${key}-metadata.json`,JSON.stringify({model:env.IMAGE_MODEL,prompt,usage:image.usage}),{httpMetadata:{contentType:'application/json'}}));
          });
          return true;
        } catch {return false;}
      }));
      const [textError,outcomes]=await Promise.all([prose,illustrations]);
      if(textError)throw new Error(textError);
      if(outcomes.some(ok=>!ok)) throw new Error('illustration_incomplete');
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
