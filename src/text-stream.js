// Only publish closed scene objects; unfinished JSON and sentences stay private.
function completedScenes(text) {
  let depth=0,quoted=false,escaped=false,stringStart=0,key='',inScenes=false,start=-1;
  const scenes=[];
  for(let i=0;i<text.length;i++) {
    const c=text[i];
    if(quoted) {
      if(escaped) escaped=false;
      else if(c==='\\') escaped=true;
      else if(c==='"') {quoted=false;if(depth===1)key=JSON.parse(text.slice(stringStart,i+1));}
      continue;
    }
    if(c==='"') {quoted=true;stringStart=i;}
    else if(c==='{'||c==='[') {
      if(c==='['&&depth===1&&key==='scenes')inScenes=true;
      if(c==='{'&&depth===2&&inScenes)start=i;
      depth++;
    } else if(c==='}'||c===']') {
      if(c==='}'&&depth===3&&inScenes&&start>=0){scenes.push(JSON.parse(text.slice(start,i+1)));start=-1;}
      if(c===']'&&depth===2)inScenes=false;
      depth--;
    }
  }
  return scenes;
}

export function validateScene(scene) {
  if(typeof scene?.text!=='string'||scene.text.trim().length<100||scene.text.length>35000)throw new Error('invalid_text_fields');
}

export async function readTextStream(response,onScenes) {
  if(!response.headers.get('Content-Type')?.includes('text/event-stream'))throw new Error('provider_text_failed');
  const reader=response.body.getReader(),decoder=new TextDecoder();
  let buffer='',content='',size=0,published=0,finish='',done=false,usage=null;
  try {
    while(!done) {
      const part=await reader.read();
      if(part.done)break;
      size+=part.value.length;if(size>4*1024*1024)throw new Error('payload_too_large');
      buffer+=decoder.decode(part.value,{stream:true});
      let boundary;
      while((boundary=/\r?\n\r?\n/.exec(buffer))) {
        const frame=buffer.slice(0,boundary.index);buffer=buffer.slice(boundary.index+boundary[0].length);
        const data=frame.split(/\r?\n/).filter(line=>line.startsWith('data:')).map(line=>line.slice(5).trimStart()).join('\n');
        if(!data)continue;
        if(data==='[DONE]'){done=true;break;}
        let chunk;try{chunk=JSON.parse(data);}catch{throw new Error('invalid_text_json');}
        const choice=chunk.choices?.[0];
        if(chunk.error||choice?.finish_reason==='error')throw new Error('provider_text_failed');
        if(choice?.finish_reason)finish=choice.finish_reason;
        if(finish==='length')throw new Error('incomplete_text');
        if(chunk.usage)usage=chunk.usage;
        const delta=choice?.delta?.content;
        if(typeof delta==='string'&&delta) {
          content+=delta;if(content.length>1024*1024)throw new Error('payload_too_large');
          const scenes=completedScenes(content);
          if(scenes.length>3)throw new Error('invalid_text_fields');
          scenes.forEach(validateScene);
          if(scenes.length>published){await onScenes(scenes);published=scenes.length;}
        }
      }
    }
    if(!done||finish!=='stop')throw new Error('incomplete_text');
    let result;try{result=JSON.parse(content);}catch{throw new Error('invalid_text_json');}
    return {content:result,usage};
  } finally {await reader.cancel();}
}
