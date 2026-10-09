// Scans the partial JSON the model has streamed so far and reports what is safe to show:
// every closed scene object, plus the complete sentences of the scene still being written.
// Unfinished sentences, escapes and the explanation stay private until they are whole.
function scanScenes(text) {
  let depth=0,quoted=false,escaped=false,stringStart=0,key='',sceneKey='',inScenes=false,start=-1,textStart=-1;
  const scenes=[];
  for(let i=0;i<text.length;i++) {
    const c=text[i];
    if(quoted) {
      if(escaped) escaped=false;
      else if(c==='\\') escaped=true;
      else if(c==='"') {
        quoted=false;
        if(depth===1)key=JSON.parse(text.slice(stringStart,i+1));
        else if(depth===3&&inScenes) {
          if(textStart<0&&sceneKey==='')sceneKey=JSON.parse(text.slice(stringStart,i+1));
          else {sceneKey='';textStart=-1;}
        }
      }
      continue;
    }
    if(c==='"') {quoted=true;stringStart=i;if(depth===3&&inScenes&&sceneKey==='text')textStart=i+1;}
    else if(c==='{'||c==='[') {
      if(c==='['&&depth===1&&key==='scenes')inScenes=true;
      if(c==='{'&&depth===2&&inScenes){start=i;sceneKey='';textStart=-1;}
      depth++;
    } else if(c==='}'||c===']') {
      if(c==='}'&&depth===3&&inScenes&&start>=0){scenes.push(JSON.parse(text.slice(start,i+1)));start=-1;sceneKey='';textStart=-1;}
      if(c===']'&&depth===2)inScenes=false;
      depth--;
    }
  }
  let open='';
  if(quoted&&inScenes&&depth===3&&sceneKey==='text'&&textStart>=0) {
    let fragment=text.slice(textStart);
    // Drop a trailing escape that has not finished arriving (a lone backslash or a short \uXXXX).
    const tail=fragment.match(/(\\+)$/);
    if(tail&&tail[1].length%2===1)fragment=fragment.slice(0,-1);
    const unicode=fragment.match(/\\u[0-9a-fA-F]{0,3}$/);
    if(unicode)fragment=fragment.slice(0,unicode.index);
    try{open=JSON.parse(`"${fragment}"`);}catch{open='';}
  }
  return {scenes,open};
}

export function completedScenes(text) {return scanScenes(text).scenes;}

// The part of an unfinished scene that ends on a sentence or paragraph boundary.
export function readableText(open) {
  const matches=[...open.matchAll(/[.!?…]["'”’»)]*(?=\s|$)|[。！？]["”’」』)]*|\n\n/g)];
  if(!matches.length)return '';
  const last=matches[matches.length-1];
  return open.slice(0,last.index+last[0].length).trim();
}

export function validateScene(scene) {
  if(typeof scene?.text!=='string'||scene.text.trim().length<100||scene.text.length>35000)throw new Error('invalid_text_fields');
}

export async function readTextStream(response,onProgress) {
  if(!response.headers.get('Content-Type')?.includes('text/event-stream'))throw new Error('provider_text_failed');
  const reader=response.body.getReader(),decoder=new TextDecoder();
  let buffer='',content='',size=0,published=0,publishedOpen='',finish='',done=false,usage=null;
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
          const {scenes,open}=scanScenes(content);
          if(scenes.length>3)throw new Error('invalid_text_fields');
          scenes.forEach(validateScene);
          const readable=scenes.length<3?readableText(open):'';
          if(scenes.length>published){published=scenes.length;publishedOpen='';await onProgress(scenes,readable,true);}
          else if(readable&&readable!==publishedOpen){publishedOpen=readable;await onProgress(scenes,readable,false);}
        }
      }
    }
    if(!done||finish!=='stop')throw new Error('incomplete_text');
    let result;try{result=JSON.parse(content);}catch{throw new Error('invalid_text_json');}
    return {content:result,usage};
  } finally {await reader.cancel();}
}
