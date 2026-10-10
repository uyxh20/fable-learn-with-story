(function () {
  const copy = {
    en:{continuing:'The rest of your fable is on its way…',illustration:'An illustration from this fable.',title:'Turn your idea into a story.',sub:'What would you like to understand?',placeholder:'An idea you’d like to understand…',create:'Create a fable',sample:'Read a sample',sampleTitle:'The Hall of Affairs',sampleMeta:'How AI agents work · 5 min',world:'Story world',library:'Your fables',empty:'Your stories will appear here.',coming:'Creation is being connected. The sample is ready to read.',end:'The end',keep:'A story to keep.',take:'Take it with you. Pass it on.',download:'Download fable',share:'Share fable',next:'Create another fable',saved:'Saved privately. Share only when you choose.',offline:'Offline book',offlineSub:'Illustrations included · opens in any browser',pdf:'Save as PDF',pdfSub:'Opens your browser’s print view',copy:'Copy link',publish:'Create share link',revoke:'Stop sharing',private:'Only you can read this story until you share a link.',public:'Anyone with this link can read the story.',copied:'Link copied.',revokeDone:'Sharing is off. The old link no longer works.',loading:'Opening your fable…',working:'Your fable is being created. It will keep working if you leave.',failed:'This fable is incomplete. Finished scenes and pictures are saved.',close:'Close',back:'Home',
      tryOne:'Ideas to try',examples:['How does compound interest work?','Why is the sky blue? For my six-year-old.','What does a neural network actually learn?','How do vaccines train the immune system?','What is a supply chain? For a new hire.','Why do we procrastinate?','What is inflation? For my grandmother.','How does a bill become law?'],
      hint:'Reading starts in seconds. The whole book takes about a minute.',trust:'Private by default · No account needed · Three fables a day',enterHint:'Enter to create, Shift+Enter for a new line',
      yourIdea:'Your idea',theFable:'The fable',coverKicker:'A fable',coverSub:'An illustrated fable, with the explanation after the story',coverAlt:'An illustrated fable',sharedDeck:'',
      stPlanning:'Imagining the story',stPlanningNote:'Choosing the characters, the place, and the turn.',stWriting:'Writing the first scene',stWritingNote:'The first sentences open the book as soon as they land.',stIllustrating:'Painting the pictures',stOpening:'Opening the book',writingNow:'Still writing…',paintingNow:'Painting this scene…',sceneOf:'Scene {n} of {total}',
      errActive:'A fable of yours is still being written.',errOpen:'Open it',errDaily:'You’ve created today’s three fables. Come back tomorrow, or reread the ones you have.',errNetwork:'This network has reached today’s limit. Please try again tomorrow.',errGlobal:'Fable is fully booked today. Please come back tomorrow.',errFailed:'This fable couldn’t be finished. Please try a new idea.',errGeneric:'Something went wrong. Please try again.',errUnavailable:'Creation is paused for a moment. The sample is ready to read.',retry:'Try again',
      libWriting:'Being written',libFailed:'Unfinished',libDone:'Read',justNow:'just now',minutesAgo:'{n} min ago',hoursAgo:'{n} h ago',daysAgo:'{n} d ago'},
    fr:{continuing:'La suite de votre fable arrive…',illustration:'Une illustration de cette fable.',title:'Faites de votre idée une histoire.',sub:'Que souhaitez-vous comprendre ?',placeholder:'Une idée que vous aimeriez comprendre…',create:'Créer une fable',sample:'Lire un exemple',sampleTitle:'La salle des affaires',sampleMeta:'Comprendre les agents IA · 5 min',world:'Univers',library:'Vos fables',empty:'Vos histoires apparaîtront ici.',coming:'La création arrive bientôt. L’exemple est prêt à lire.',end:'Fin',keep:'Une histoire à garder.',take:'Emportez-la. Partagez-la.',download:'Télécharger',share:'Partager',next:'Créer une autre fable',saved:'Enregistrée en privé. Partagez si vous le souhaitez.',offline:'Livre hors ligne',offlineSub:'Illustrations incluses · dans tout navigateur',pdf:'Enregistrer en PDF',pdfSub:'Ouvre la fenêtre d’impression',copy:'Copier le lien',publish:'Créer un lien',revoke:'Arrêter le partage',private:'Cette histoire reste privée jusqu’au partage du lien.',public:'Toute personne disposant du lien peut lire l’histoire.',copied:'Lien copié.',revokeDone:'Le partage est désactivé.',loading:'Ouverture de votre fable…',working:'Votre fable continue à se créer même si vous partez.',failed:'Cette fable est incomplète. Les scènes et images terminées sont enregistrées.',close:'Fermer',back:'Accueil',
      tryOne:'Idées à essayer',examples:['Comment fonctionnent les intérêts composés ?','Pourquoi le ciel est-il bleu ? Pour mon enfant de six ans.','Qu’apprend vraiment un réseau de neurones ?','Comment un vaccin entraîne-t-il le système immunitaire ?','Qu’est-ce qu’une chaîne logistique ? Pour une nouvelle recrue.','Pourquoi remet-on tout à plus tard ?','Qu’est-ce que l’inflation ? Pour ma grand-mère.','Comment une loi est-elle votée ?'],
      hint:'La lecture commence en quelques secondes. Le livre entier prend environ une minute.',trust:'Privé par défaut · Sans compte · Trois fables par jour',enterHint:'Entrée pour créer, Maj+Entrée pour une nouvelle ligne',
      yourIdea:'Votre idée',theFable:'La fable',coverKicker:'Une fable',coverSub:'Une fable illustrée, suivie de son explication',coverAlt:'Une fable illustrée',sharedDeck:'',
      stPlanning:'L’histoire s’imagine',stPlanningNote:'Le choix des personnages, du lieu et du tournant.',stWriting:'Écriture de la première scène',stWritingNote:'Les premières phrases ouvrent le livre dès qu’elles arrivent.',stIllustrating:'Peinture des images',stOpening:'Ouverture du livre',writingNow:'Écriture en cours…',paintingNow:'Cette scène se peint…',sceneOf:'Scène {n} sur {total}',
      errActive:'Une de vos fables est encore en cours d’écriture.',errOpen:'L’ouvrir',errDaily:'Vous avez créé vos trois fables du jour. Revenez demain, ou relisez les vôtres.',errNetwork:'Ce réseau a atteint sa limite du jour. Réessayez demain.',errGlobal:'Fable est complet aujourd’hui. Revenez demain.',errFailed:'Cette fable n’a pas pu être terminée. Essayez une nouvelle idée.',errGeneric:'Un problème est survenu. Réessayez.',errUnavailable:'La création est en pause un instant. L’exemple est prêt à lire.',retry:'Réessayer',
      libWriting:'En cours d’écriture',libFailed:'Inachevée',libDone:'Lire',justNow:'à l’instant',minutesAgo:'il y a {n} min',hoursAgo:'il y a {n} h',daysAgo:'il y a {n} j'},
    da:{continuing:'Resten af din fabel er på vej…',illustration:'En illustration fra denne fabel.',title:'Gør din idé til en historie.',sub:'Hvad vil du gerne forstå?',placeholder:'En idé, du gerne vil forstå…',create:'Skab en fabel',sample:'Læs et eksempel',sampleTitle:'Salen for Anliggender',sampleMeta:'Sådan virker AI-agenter · 5 min',world:'Fortællingens verden',library:'Dine fabler',empty:'Dine historier vises her.',coming:'Oprettelse er snart klar. Læs eksemplet imens.',end:'Slut',keep:'En historie at gemme.',take:'Tag den med. Giv den videre.',download:'Hent fabel',share:'Del fabel',next:'Skab en ny fabel',saved:'Gemt privat. Del, når du ønsker det.',offline:'Offlinebog',offlineSub:'Med illustrationer · åbnes i en browser',pdf:'Gem som PDF',pdfSub:'Åbner browserens udskriftsvindue',copy:'Kopiér link',publish:'Opret delingslink',revoke:'Stop deling',private:'Kun du kan læse historien, indtil du deler et link.',public:'Alle med linket kan læse historien.',copied:'Link kopieret.',revokeDone:'Deling er slået fra.',loading:'Åbner din fabel…',working:'Din fabel bliver færdig, selvom du forlader siden.',failed:'Fablen er ikke færdig. De færdige scener og billeder er gemt.',close:'Luk',back:'Hjem',
      tryOne:'Idéer at prøve',examples:['Hvordan virker renters rente?','Hvorfor er himlen blå? Til min seksårige.','Hvad lærer et neuralt netværk egentlig?','Hvordan træner en vaccine immunforsvaret?','Hvad er en forsyningskæde? Til en ny medarbejder.','Hvorfor udskyder vi ting?','Hvad er inflation? Til min bedstemor.','Hvordan bliver et lovforslag til en lov?'],
      hint:'Læsningen begynder på få sekunder. Hele bogen tager omkring et minut.',trust:'Privat som standard · Ingen konto · Tre fabler om dagen',enterHint:'Enter opretter, Shift+Enter giver ny linje',
      yourIdea:'Din idé',theFable:'Fablen',coverKicker:'En fabel',coverSub:'En illustreret fabel med forklaringen efter historien',coverAlt:'En illustreret fabel',sharedDeck:'',
      stPlanning:'Historien tager form',stPlanningNote:'Personerne, stedet og vendepunktet vælges.',stWriting:'Første scene skrives',stWritingNote:'De første sætninger åbner bogen, så snart de lander.',stIllustrating:'Billederne males',stOpening:'Bogen åbnes',writingNow:'Skriver stadig…',paintingNow:'Denne scene males…',sceneOf:'Scene {n} af {total}',
      errActive:'En af dine fabler er stadig ved at blive skrevet.',errOpen:'Åbn den',errDaily:'Du har skabt dagens tre fabler. Kom tilbage i morgen, eller genlæs dine egne.',errNetwork:'Dette netværk har nået dagens grænse. Prøv igen i morgen.',errGlobal:'Fable er fuldt booket i dag. Kom tilbage i morgen.',errFailed:'Fablen kunne ikke færdiggøres. Prøv en ny idé.',errGeneric:'Noget gik galt. Prøv igen.',errUnavailable:'Oprettelse holder en kort pause. Eksemplet er klar til at læse.',retry:'Prøv igen',
      libWriting:'Skrives',libFailed:'Ufærdig',libDone:'Læs',justNow:'lige nu',minutesAgo:'{n} min siden',hoursAgo:'{n} t siden',daysAgo:'{n} d siden'},
    zh:{continuing:'接下来的故事正在赶来……',illustration:'这则寓言的插画。',title:'把你的想法变成故事。',sub:'你想理解什么？',placeholder:'写下你想理解的一个概念……',create:'创作寓言',sample:'阅读示例',sampleTitle:'应事斋',sampleMeta:'认识 AI 智能体 · 5 分钟',world:'故事世界',library:'我的寓言',empty:'你的故事将保存在这里。',coming:'创作功能正在接入。你可以先阅读示例。',end:'故事完',keep:'把故事带走。',take:'珍藏，也分享。',download:'下载寓言',share:'分享寓言',next:'再创作一则',saved:'已私密保存。分享由你决定。',offline:'离线故事书',offlineSub:'包含插画 · 在浏览器中打开',pdf:'另存为 PDF',pdfSub:'打开浏览器打印窗口',copy:'复制链接',publish:'创建分享链接',revoke:'停止分享',private:'创建分享链接前，只有你能阅读。',public:'任何获得链接的人都可以阅读。',copied:'链接已复制。',revokeDone:'分享已关闭，旧链接不再有效。',loading:'正在打开寓言……',working:'寓言正在创作。离开页面后仍会继续。',failed:'这则寓言尚未完成，已完成的场景和插画均已保存。',close:'关闭',back:'首页',
      tryOne:'可以试试的想法',examples:['复利是怎么运作的？','天空为什么是蓝色的？讲给六岁的孩子。','神经网络到底学到了什么？','疫苗如何训练免疫系统？','什么是供应链？讲给新员工。','我们为什么会拖延？','什么是通货膨胀？讲给奶奶听。','一项法案是如何成为法律的？'],
      hint:'几秒钟后就可以开始阅读，整本书大约一分钟完成。',trust:'默认私密 · 无需账号 · 每天三则寓言',enterHint:'按 Enter 创作，Shift+Enter 换行',
      yourIdea:'你的想法',theFable:'寓言',coverKicker:'一则寓言',coverSub:'一则插画寓言，故事之后附有解释',coverAlt:'一则插画寓言',sharedDeck:'',
      stPlanning:'正在构思故事',stPlanningNote:'选定人物、场景和转折。',stWriting:'正在写第一幕',stWritingNote:'第一句话写好，书就会打开。',stIllustrating:'正在绘制插画',stOpening:'正在打开书',writingNow:'仍在书写……',paintingNow:'这一幕正在绘制……',sceneOf:'第 {n} 幕，共 {total} 幕',
      errActive:'你有一则寓言仍在创作中。',errOpen:'打开它',errDaily:'今天的三则寓言已经创作完了。明天再来，或重读你的寓言。',errNetwork:'这个网络今天的创作次数已用完。请明天再试。',errGlobal:'今天的创作名额已满。请明天再来。',errFailed:'这则寓言未能完成。请换一个想法试试。',errGeneric:'出了点问题，请再试一次。',errUnavailable:'创作功能暂停片刻。示例随时可读。',retry:'再试一次',
      libWriting:'创作中',libFailed:'未完成',libDone:'阅读',justNow:'刚刚',minutesAgo:'{n} 分钟前',hoursAgo:'{n} 小时前',daysAgo:'{n} 天前'},
  };
  window.FABLE_HOME_COPY=copy;
  const worlds=['Chinese classical','Greek myth','Fairy tale','Contemporary'];
  const DRAFT_KEY='fable-draft';
  function readDraft(){try{return JSON.parse(sessionStorage.getItem(DRAFT_KEY))||null;}catch{return null;}}
  function writeDraft(draft){try{if(draft)sessionStorage.setItem(DRAFT_KEY,JSON.stringify(draft));else sessionStorage.removeItem(DRAFT_KEY);}catch{}}
  function relative(iso,C) {
    const minutes=Math.max(0,Math.round((Date.now()-new Date(iso).getTime())/60000));
    if(minutes<1)return C.justNow;if(minutes<60)return C.minutesAgo.replace('{n}',minutes);
    if(minutes<1440)return C.hoursAgo.replace('{n}',Math.round(minutes/60));return C.daysAgo.replace('{n}',Math.round(minutes/1440));
  }
  function errorCopy(code,C) {
    return {creation_active:C.errActive,daily_limit_browser:C.errDaily,daily_limit_network:C.errNetwork,daily_limit_global:C.errGlobal,creation_limit:C.errDaily,
      generation_unavailable:C.errUnavailable,service_unavailable:C.errUnavailable,session_required:C.errGeneric}[code]||(code&&/^[a-z_]+$/.test(code)&&code.endsWith('failed')?C.errFailed:C.errGeneric);
  }
  function Overlay({title,onClose,children}) {
    const ref=React.useRef(null);
    React.useEffect(()=>{ref.current.showModal();},[]);
    return <dialog ref={ref} className="overlay-card fable-modal" role="dialog" aria-label={title} onCancel={onClose} onClose={onClose} onKeyDown={e=>e.stopPropagation()}><button className="iconbtn fable-modal-close" aria-label={copy[document.documentElement.lang.split('-')[0]]?.close||'Close'} onClick={onClose}><Icon name="x"/></button>{children}</dialog>;
  }
  function pickExamples(list) {
    const pool=[...list];for(let i=pool.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[pool[i],pool[j]]=[pool[j],pool[i]];}
    return pool.slice(0,4);
  }
  function Home({onWeave,onOpenBook,onOpenSaved,theme,setTheme,lang,setLang,T}) {
    const C=copy[lang], draft=React.useMemo(readDraft,[]);
    const [topic,setTopic]=React.useState(draft?.concept||''),[world,setWorld]=React.useState(worlds.includes(draft?.setting)?draft.setting:worlds[0]);
    const [enabled,setEnabled]=React.useState(true),[stories,setStories]=React.useState([]),[library,setLibrary]=React.useState(false);
    const [examples,setExamples]=React.useState(()=>pickExamples(C.examples));
    const area=React.useRef(null);
    React.useEffect(()=>{setExamples(pickExamples(C.examples));},[lang]);
    React.useEffect(()=>{let active=true;fetch('/api/config').then(r=>r.json()).then(d=>{if(active&&d.generation_enabled===false)setEnabled(false);}).catch(()=>{});
      fetch('/api/stories').then(r=>r.json()).then(d=>{if(active)setStories(d.stories||[]);}).catch(()=>{});return()=>{active=false;};},[]);
    React.useEffect(()=>{const el=area.current;if(!el)return;el.style.height='auto';el.style.height=`${Math.min(el.scrollHeight,260)}px`;},[topic]);
    const ready=enabled&&topic.trim().length>=2;
    const submit=()=>{if(!ready)return;writeDraft({concept:topic.trim(),setting:world});onWeave({concept:topic.trim(),setting:world});};
    const useExample=text=>{setTopic(text);requestAnimationFrame(()=>{area.current?.focus();const n=area.current;if(n)n.setSelectionRange(n.value.length,n.value.length);});};
    return <div className="fable-home" lang={htmlLang(lang)}><header className="fable-home-bar"><Logo lang={lang}/><div className="fable-home-tools">{stories.length>0&&<button className="btn btn--quiet" onClick={()=>setLibrary(true)}><Icon name="shelf" size={15}/><span>{C.library}</span></button>}<LangToggle lang={lang} setLang={setLang}/><ThemeToggle theme={theme} setTheme={setTheme} lang={lang}/></div></header>
      <main className="fable-home-main"><div className="fable-question"><h1>{C.title}</h1><p className="fable-sub">{C.sub}</p>
        <form className="fable-bubble" onSubmit={e=>{e.preventDefault();submit();}}>
          <label className="sr-only" htmlFor="fable-idea">{C.placeholder}</label><textarea id="fable-idea" ref={area} rows="2" placeholder={C.placeholder} value={topic} onChange={e=>setTopic(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.nativeEvent.isComposing){e.preventDefault();submit();}}} minLength={2} maxLength={2000} required aria-describedby="fable-enter-hint"/>
          <span id="fable-enter-hint" className="sr-only">{C.enterHint}</span>
          <div className="fable-worlds" role="group" aria-label={C.world}>{worlds.map((w,i)=><button type="button" key={w} className={'fable-world'+(world===w?' is-on':'')} aria-pressed={world===w} onClick={()=>setWorld(w)}>{FABLE.settings[lang][i]}</button>)}</div>
          <div className="fable-bubble-foot">{!enabled&&<p className="sr-only" role="status">{C.coming}</p>}<button className="fable-send" type="submit" disabled={!ready}>{C.create}<Icon name="arrowR" size={17}/></button></div>
        </form>
        <div className="fable-examples" role="group" aria-labelledby="fable-examples-label"><p className="kicker" id="fable-examples-label">{C.tryOne}</p>{examples.map(ex=><button type="button" key={ex} className="fable-example" title={ex} onClick={()=>useExample(ex)}>{ex}</button>)}</div>
      </div><button className="fable-sample" data-ob="sample" onClick={()=>onOpenBook(false)} aria-label={T.readSample}><img src={FABLE.art("cover",800)} srcSet={FABLE.artSet("cover")} sizes="(max-width: 700px) 100vw, 53vw" width="1600" height="900" alt="" fetchpriority="high" decoding="async"/><div className="fable-sample-caption"><div><p className="kicker">{C.sample}</p><h2>{C.sampleTitle}</h2></div><span aria-hidden="true">↗</span></div></button></main>
      {library&&<Overlay onClose={()=>setLibrary(false)} title={C.library}><h2 className="fable-dialog-title">{C.library}</h2><div className="fable-library">{stories.map(s=><button className="fable-library-row" key={s.id} onClick={()=>onOpenSaved(s.id)}>
        <span className={'fable-library-thumb'+(s.status==='completed'?'':' is-empty')}>{s.status==='completed'&&<img src={`/api/stories/${s.id}/image/0`} alt="" loading="lazy"/>}</span>
        <span className="fable-library-text"><strong>{s.title||s.concept}</strong><span>{s.status==='completed'?C.libDone:s.status==='failed'?C.libFailed:C.libWriting} · {relative(s.created_at,C)}</span></span><span className="fable-library-go" aria-hidden="true">→</span></button>)}</div></Overlay>}
    </div>;
  }
  async function offlineBook(pages,lang) {
    const images=[...new Set(pages.map(p=>p.image).filter(Boolean))], data={};
    await Promise.all(images.map(async src=>{const response=await fetch(src);if(!response.ok)throw new Error('Could not load the illustration.');const blob=await response.blob();data[src]=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(blob);});}));
    const escape=s=>String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    let previous=null;
    const content=pages.map(p=>{let picture='';if(p.image&&p.image!==previous){picture=`<img src="${data[p.image]}" alt="${escape(p.title)}">`;previous=p.image;}return `${p.kind==='Cover'?`<h1>${escape(p.title)}</h1>${p.concept?`<p class="idea">${escape(p.concept)}</p>`:''}`:p.kind==='Lesson'?`<h2>${escape(FABLE.ui[lang].afterStory)}</h2>`:''}${picture}${p.raw?FABLE.renderMarkdown(p.raw):''}`;}).join('');
    return `<!doctype html><html lang="${htmlLang(lang)}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(pages[0].title)} — Fable</title><style>body{margin:0;color:#30281e;background:#eee5d3;font:20px/1.65 Georgia,serif}main{max-width:760px;margin:auto;padding:50px 24px}h1{font-size:52px;line-height:1.1}h2{margin-top:50px}.idea{font-style:italic;color:#6b5b43}img{width:100%;margin:24px 0;border-radius:4px}small{font:12px Arial,sans-serif;letter-spacing:.2em}li{margin-bottom:14px}@media print{body{background:white;font-size:12pt}main{padding:0}h2{break-before:page}img{max-height:65vh;object-fit:contain}p,li{orphans:3;widows:3}}</style></head><body><main><small>FABLE</small>${content}</main></body></html>`;
  }
  function Ending({pages,lang,onExit,bookInfo}) {
    const C=copy[lang],[modal,setModal]=React.useState(null),[notice,setNotice]=React.useState(''),[link,setLink]=React.useState(bookInfo?.shareURL||''),[busy,setBusy]=React.useState(false);
    const shared=new URLSearchParams(location.search).get('share');
    const storyId=bookInfo?.storyId;
    async function download(pdf=false) {
      const win=pdf?window.open('about:blank','_blank'):null;
      if(pdf&&!win){setNotice('Allow a new tab to open the print view.');return;}
      setBusy(true);setNotice('');
      try{const html=await offlineBook(pages,lang);if(win){win.document.open();win.document.write(html);win.document.close();await Promise.all([...win.document.images].map(i=>i.decode()));win.focus();win.print();}
        else{const url=URL.createObjectURL(new Blob([html],{type:'text/html'})),a=document.createElement('a');a.href=url;a.download='fable.html';a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);}}
      catch(e){win?.close();setNotice(e.message);}finally{setBusy(false);}
    }
    async function share() {
      setBusy(true);setNotice('');
      try{let url=link;if(!url){if(shared)url=`${location.origin}/?share=${encodeURIComponent(shared)}#read/cover`;
          else if(storyId){const r=await fetch(`/api/stories/${storyId}/share`,{method:'POST'});const d=await r.json();if(!r.ok)throw new Error(d.error);url=d.url;}
          else url=`${location.origin}/?lang=${lang}#read/cover`;setLink(url);}
        try{await navigator.clipboard.writeText(url);setNotice(C.copied);}catch{setNotice(C.copy);}}
      catch(e){setNotice(e.message);}finally{setBusy(false);}
    }
    async function revoke(){setBusy(true);try{const r=await fetch(`/api/stories/${storyId}/share`,{method:'DELETE'});if(!r.ok)throw new Error('Please try again.');setLink('');setNotice(C.revokeDone);}catch(e){setNotice(e.message);}finally{setBusy(false);}}
    return <div className="fable-ending"><div className="fable-rule"/><p className="kicker">{C.end}</p><h2>{C.keep}</h2><p className="fable-closing">{C.take}</p><div className="fable-end-actions"><button className="btn btn--primary" onClick={()=>{setModal('download');setNotice('');}}>{C.download} ↓</button><button className="btn" disabled={bookInfo?.partial} onClick={()=>{setModal('share');setNotice('');}}>{C.share} ↗</button></div>{storyId&&!shared&&<p className="fable-saved">{bookInfo.partial?C.failed:C.saved}</p>}<button className="fable-next" onClick={onExit}>{C.next} →</button>
      {modal&&<Overlay title={modal==='share'?C.share:C.download} onClose={()=>setModal(null)}><h2 className="fable-dialog-title">{modal==='share'?C.share:C.download}</h2>{modal==='download'?<><button className="fable-export" disabled={busy} onClick={()=>download()}>{C.offline}<span>{C.offlineSub}</span></button><button className="fable-export" disabled={busy} onClick={()=>download(true)}>{C.pdf}<span>{C.pdfSub}</span></button></>:<><p className="fable-share-copy">{link||shared||!storyId?C.public:C.private}</p>{link&&<input className="fable-share-input" aria-label={C.copy} readOnly value={link} onFocus={e=>e.target.select()}/>}<button className="btn btn--primary" disabled={busy} onClick={share}>{link||shared||!storyId?C.copy:C.publish}</button>{link&&storyId&&!shared&&<button className="btn btn--quiet" disabled={busy} onClick={revoke}>{C.revoke}</button>}</>}<p role="status" className="fable-saved">{notice}</p></Overlay>}
    </div>;
  }
  window.FableHomepage=Home;window.FableEnding=Ending;window.FABLE_ERROR_COPY=errorCopy;window.FABLE_DRAFT={read:readDraft,write:writeDraft};
})();
