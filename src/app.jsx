(function () {
  function App() {
    const query=()=>new URLSearchParams(location.search);
    const [theme,setTheme]=React.useState(()=>{try{return localStorage.getItem('fable-theme')==='light'?'light':'dark';}catch{return 'dark';}});
    const [lang,setLang]=React.useState(()=>{let l=query().get('lang');try{l=l||localStorage.getItem('fable-lang');}catch{}return ['en','fr','da','zh'].includes(l)?l:'en';});
    const [screen,setScreen]=React.useState(()=>query().has('story')||query().has('share')?'loading':location.hash.startsWith('#read/')?'reader':'create');
    const [generated,setGenerated]=React.useState(null),[request,setRequest]=React.useState(null),[error,setError]=React.useState('');
    const [loadKey,setLoadKey]=React.useState(()=>`${query().get('story')||''}:${query().get('share')||''}`);
    const C=FABLE_HOME_COPY[lang],T={...FABLE.ui[lang],...(generated?{figureAlt:generated.pages[0].title,figureCaption:C.illustration}:{})};
    const source=document.getElementById('source-md').textContent.trim();
    const pages=React.useMemo(()=>generated?.pages||FABLE.buildPages(source,lang),[generated,lang]);
    React.useEffect(()=>{document.documentElement.dataset.theme=theme;try{localStorage.setItem('fable-theme',theme);}catch{}},[theme]);
    React.useEffect(()=>{document.documentElement.lang=htmlLang(lang);try{localStorage.setItem('fable-lang',lang);}catch{}window.dispatchEvent(new CustomEvent('fable:language',{detail:lang}));},[lang]);
    React.useEffect(()=>{window.__fableScreen=screen;window.dispatchEvent(new CustomEvent('fable:screen',{detail:screen}));},[screen]);
    React.useEffect(()=>{const sync=()=>{const q=query();setLoadKey(`${q.get('story')||''}:${q.get('share')||''}`);if(!q.has('story')&&!q.has('share')){setGenerated(null);setScreen(location.hash.startsWith('#read/')?'reader':'create');}};addEventListener('popstate',sync);addEventListener('hashchange',sync);return()=>{removeEventListener('popstate',sync);removeEventListener('hashchange',sync);};},[]);
    React.useEffect(()=>{const [id,share]=loadKey.split(':');if(!id&&!share)return;let active=true;if(generated?.storyId!==id)setScreen('loading');setError('');
      const show=book=>{if(!active||!book)return;setGenerated(book);setLang(book.lang);setScreen('reader');};
      FABLE_LIVE.load(id,share,()=>active,show).then(show).catch(e=>{if(active){setError(e.message);setGenerated(book=>book?{...book,generating:false,partial:true}:book);}});
      return()=>{active=false;};},[loadKey]);
    const home=()=>{history.pushState(null,'',`/?lang=${lang}`);setGenerated(null);setLoadKey(':');setError('');setScreen('create');};
    const openSaved=id=>{location.href=`/?story=${encodeURIComponent(id)}#read/cover`;};
    const sample=()=>{setGenerated(null);setLoadKey(':');try{sessionStorage.removeItem(`fable-reading-place:?lang=${lang}`);}catch{}history.pushState(null,'',`/?lang=${lang}#read/cover`);setScreen('reader');};
    const shared={theme,setTheme,lang,setLang:generated?undefined:setLang,T};
    // Keep experimental readers confined to localhost while preserving local design work.
    const local=['localhost','127.0.0.1'].includes(location.hostname);
    const Reader=local?({popup:window.PopupStageReader,tunnel:window.TunnelBookReader,mechanics:window.PaperMechanicsReader}[query().get('reader')]||CinemaReader):CinemaReader;
    return <>{screen==='create'&&<FableHomepage {...shared} onOpenBook={sample} onOpenSaved={openSaved} onWeave={req=>{setRequest(req);setScreen('generate');}}/>}
      {screen==='generate'&&<GenerateScreen {...shared} setLang={undefined} request={request} onDone={result=>{setGenerated(result);setLang(result.lang);setScreen('reader');setLoadKey(`${result.storyId}:`);}}/>}
      {screen==='loading'&&<main className="fable-loading"><h1>{C.loading}</h1><p role={error?'alert':'status'}>{error||C.working}</p><button className="btn" onClick={home}>{C.back}</button></main>}
      {screen==='reader'&&error&&<p className="fable-reader-notice" role="alert">{error}</p>}
      {screen==='reader'&&<Reader {...shared} pages={pages} bookInfo={generated} onExit={home}/>}</>;
  }
  ReactDOM.createRoot(document.getElementById('root')).render(<App/>);
})();
