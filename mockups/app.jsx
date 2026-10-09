import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';

const homes = ['The open book', 'Lantern light', 'One line', 'The little library', 'A question'];
const endings = ['Quiet colophon', 'Bookplate', 'Reading rail'];
const pages = window.FABLE.buildPages('', 'en');
const storyText = pages.filter(p => p.kind === 'Story').map(p => p.raw).join('\n\n');
const lessonText = pages.find(p => p.kind === 'Lesson').raw;
const markdown = `# The Hall of Affairs\n\n${storyText}\n\n## After the story\n\n${lessonText}`;
const defaultThemes = ['light', 'dark', 'light', 'dark', 'dark'];
const parseRoute = () => {
  const q = new URLSearchParams(location.search);
  return { home: Math.max(1, Math.min(5, Number(q.get('home')) || 1)), ending: Math.max(1, Math.min(3, Number(q.get('ending')) || 1)),
    view: ['create', 'read', 'end'].includes(q.get('view')) ? q.get('view') : 'home', story: q.get('story'), shared: q.get('shared') === 'sample' };
};
const escape = value => value.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const md = text => ({ __html: window.FABLE.renderMarkdown(text) });

function Sample({ onOpen }) {
  return <button className="sample" onClick={onOpen} aria-label="Read sample: The Hall of Affairs">
    <img src="/art/cover-1600.webp" alt="Moonlit courtyard and a scholar at a desk"/>
    <div className="sample-caption"><div><div className="eyebrow">Read a sample</div><h2>The Hall of Affairs</h2><div className="meta">How AI agents work · 5 min</div></div><span className="arrow" aria-hidden="true">↗</span></div>
  </button>;
}

function App() {
  const [route, setRoute] = useState(parseRoute);
  const [theme, setTheme] = useState(defaultThemes[route.home - 1]);
  const [topic, setTopic] = useState('');
  const [world, setWorld] = useState('Chinese classical');
  const [modal, setModal] = useState(null);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(null);
  const dialog = useRef(null);
  const saveLock = useRef(false);
  const navigate = (patch, replace = false) => {
    const next = { ...route, ...patch }; const q = new URLSearchParams();
    q.set('home', next.home); q.set('ending', next.ending);
    if (next.view !== 'home') q.set('view', next.view);
    if (next.story) q.set('story', next.story);
    if (next.shared) q.set('shared', 'sample');
    history[replace ? 'replaceState' : 'pushState']({}, '', `?${q}`);
    setRoute(next); setError(''); setNotice(''); window.scrollTo(0, 0);
  };
  useEffect(() => { const fn = () => { setRoute(parseRoute()); setError(''); window.scrollTo(0,0); }; addEventListener('popstate', fn); return () => removeEventListener('popstate', fn); }, []);
  useEffect(() => { setTheme(defaultThemes[route.home - 1]); }, [route.home]);
  useEffect(() => {
    if (modal) dialog.current?.showModal(); else dialog.current?.close();
    setNotice('');
  }, [modal]);
  useEffect(() => {
    if (!route.story || route.shared) return;
    let active = true;
    fetch(`/api/stories/${encodeURIComponent(route.story)}`).then(async r => {
      if (!r.ok) throw new Error('This saved story is not available in this browser.');
      const { story } = await r.json();
      if (active) setSaved(story);
    }).catch(e => { if (active) { setSaved(null); setError(e.message); } });
    return () => { active = false; };
  }, [route.story, route.shared]);
  const chooseHome = n => navigate({ home:n, view:'home', shared:false });
  const create = () => navigate({ view:'create', shared:false });
  async function openSample(fromCreate = false) {
    if (saveLock.current) return;
    saveLock.current = true; setBusy(true); setError('');
    try {
      let id = fromCreate ? crypto.randomUUID() : localStorage.getItem('fable-design-sample');
      if (!id) id = crypto.randomUUID();
      const value = { id, title:'The Hall of Affairs', lang:'en', concept:fromCreate ? topic.trim() : 'How AI agents work',
        setting:fromCreate ? world : 'Chinese classical', markdown, image:'/art/cover-1600.webp', status:'complete' };
      const result = await window.FABLE_STORE.save(value);
      if (!fromCreate) localStorage.setItem('fable-design-sample', id);
      setSaved({ ...value, updated_at:result.saved_at });
      navigate({ view:'read', story:id, shared:false });
    } catch (e) { setError(e.message); }
    finally { setBusy(false); saveLock.current = false; }
  }
  const prompt = <form className="prompt-line" onSubmit={e => { e.preventDefault(); create(); }}>
    <input aria-label="What would you like to understand?" placeholder="An idea you’d like to understand…" value={topic} onChange={e => setTopic(e.target.value)} maxLength={2000}/>
    <button className="primary" type="submit">Create a fable <span aria-hidden="true">→</span></button>
  </form>;
  const createButton = <button className="primary" onClick={create}>Create a fable <span aria-hidden="true">→</span></button>;
  const sample = <Sample onOpen={() => openSample()}/>;
  const shareURL = `${location.origin}/mocks/?home=${route.home}&ending=${route.ending}&view=read&shared=sample`;
  async function bookHTML() {
    const images = await Promise.all(['/art/cover-1600.webp', '/art/02_yingshizhai_explain-1600.webp'].map(async url => {
      const r = await fetch(url); if (!r.ok) throw new Error('Artwork could not be loaded. Please retry.');
      const blob = await r.blob();
      return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(blob); });
    }));
    return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>The Hall of Affairs — Fable</title><style>body{margin:0;background:#eee5d3;color:#30281e;font:20px/1.65 Georgia,serif}main{max-width:700px;margin:auto;padding:50px 24px}h1{font-size:52px;line-height:1.1}h2{margin-top:60px;line-height:1.2}img{width:100%;margin:24px 0}small{font:12px Arial,sans-serif;color:#71614d}li{margin-bottom:16px}@media print{body{background:white;font-size:12pt}main{padding:0}h2{break-before:page}img{max-height:65vh;object-fit:contain}p,li{orphans:3;widows:3}}</style></head><body><main><small>FABLE · SAMPLE STORY</small><h1>${escape('The Hall of Affairs')}</h1><p>How AI agents work</p><img src="${images[0]}" alt="Moonlit courtyard">${window.FABLE.renderMarkdown(storyText)}<h2>After the story</h2><img src="${images[1]}" alt="An illustrated map of the AI agent’s layers">${window.FABLE.renderMarkdown(lessonText)}<hr><small>Fable · Learn through stories · Local design preview</small></main></body></html>`;
  }
  async function download(asPDF = false) {
    const printWindow = asPDF ? window.open('about:blank', '_blank') : null;
    if (asPDF && !printWindow) { setNotice('Allow a new tab to open the print view.'); return; }
    setNotice('Preparing your illustrated book…');
    try {
      const html = await bookHTML();
      if (asPDF) {
        printWindow.document.open(); printWindow.document.write(html); printWindow.document.close();
        await Promise.all([...printWindow.document.images].map(i => i.decode()));
        printWindow.focus(); printWindow.print();
        setNotice('Choose “Save as PDF” in the print window.');
      } else {
        const url = URL.createObjectURL(new Blob([html], { type:'text/html' }));
        const a = document.createElement('a'); a.href = url; a.download = 'the-hall-of-affairs.html'; a.click();
        setTimeout(() => URL.revokeObjectURL(url), 60000);
        setNotice('Downloaded. Your book opens offline, with illustrations.');
      }
    } catch (e) { printWindow?.close(); setNotice(e.message || 'Download failed. Please retry.'); }
  }
  async function copyLink() {
    try { await navigator.clipboard.writeText(shareURL); setNotice('Local preview link copied. It works only on this computer.'); }
    catch { setNotice('Select and copy the link above.'); }
  }
  const actions = <div className="actions"><button className="primary" onClick={() => setModal('download')}>Download fable <span aria-hidden="true">↓</span></button><button className="primary outline" onClick={() => setModal('share')}>Share fable <span aria-hidden="true">↗</span></button></div>;
  const saveLabel = saved ? 'Saved privately on this computer.' : 'Sample preview · saving starts when you open a story.';
  return <>
    <nav className="study" aria-label="Local design review">
      <span className="study-label">LOCAL STUDY</span>
      <div className="variant-nav" aria-label="Homepage variants">{homes.map((name,i) => <button key={name} aria-label={`Homepage ${i+1}: ${name}`} aria-pressed={route.home === i+1} onClick={() => chooseHome(i+1)}>{i+1}<span className="variant-name"> · {name}</span></button>)}</div>
      <div className="study-end"><label htmlFor="ending">Ending</label><select id="ending" value={route.ending} onChange={e => navigate({ ending:Number(e.target.value), view:'end' })}>{endings.map((name,i) => <option key={name} value={i+1}>{String.fromCharCode(65+i)} · {name}</option>)}</select><button onClick={() => navigate({ view:route.view === 'end' ? 'home' : 'end' })}>{route.view === 'end' ? 'Homepage' : 'Preview end'}</button></div>
    </nav>
    <div className={`site ${route.view === 'home' ? `home-${route.home}` : ''}`} data-theme={theme}>
      {route.view === 'home' && route.home === 2 && <img className="home-backdrop" src="/art/cover-1600.webp" alt=""/>}
      <header className="brandbar"><button className="brand" onClick={() => navigate({ view:'home', shared:false })}>Fable</button><div className="brand-right">{route.view !== 'home' && <button className="text-button" onClick={() => navigate({ view:'home', shared:false })}>Home</button>}<button className="text-button theme" onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')} aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}>◐</button></div></header>
      {route.shared && <div className="shared-note">Shared-story preview · sample content · local only</div>}
      {error && <div className="error" role="alert" style={{padding:'0 6vw'}}>{error} <button className="link" onClick={() => openSample()}>Open sample again</button></div>}
      {busy && <div className="notice" role="status" style={{padding:'0 6vw'}}>Saving the sample locally…</div>}
      {route.view === 'home' && <>
        <main className="hero">
          {route.home === 1 && <><div><h1>Big ideas.<br/><em>Little stories.</em></h1><p className="subline">Learn anything through an illustrated fable.</p>{createButton}</div>{sample}</>}
          {route.home === 2 && <><h1>Understand it.<br/><em>Through a story.</em></h1><p className="subline">An idea becomes an illustrated fable.</p>{createButton}{sample}</>}
          {route.home === 3 && <><h1>Learn through <em>stories.</em></h1><p className="subline">Your idea. An illustrated fable.</p>{prompt}{sample}</>}
          {route.home === 4 && <><h1>A little story.<br/><em>A new way to understand.</em></h1><div className="shelf-grid">{sample}<div className="shelf-create"><div className="eyebrow">Your next fable</div><h2>What will you<br/>learn today?</h2><p>Turn an idea into an illustrated story.</p>{createButton}</div></div></>}
          {route.home === 5 && <><div className="question"><div className="eyebrow">Learn through stories</div><h1 style={{marginTop:24}}>What would you<br/>like to <em>understand?</em></h1><p className="subline">We’ll turn it into an illustrated fable.</p>{prompt}</div>{sample}</>}
        </main>
        {route.home !== 5 && <footer className="page-foot">A story first. Understanding follows.</footer>}
      </>}
      {route.view === 'create' && <main className="compose"><div className="eyebrow">Create a fable</div><h1>Start with an idea.</h1><form onSubmit={e => { e.preventDefault(); openSample(true); }}><label className="field" htmlFor="topic">What would you like to understand?</label><input autoFocus id="topic" placeholder="e.g. How memory works" value={topic} onChange={e => setTopic(e.target.value)} required minLength={2} maxLength={2000}/><fieldset className="worlds"><legend className="field">Choose a world</legend>{['Chinese classical','Greek myth','Fairy tale','Contemporary'].map(w => <button type="button" key={w} aria-pressed={world === w} onClick={() => setWorld(w)}>{w}</button>)}</fieldset><button type="submit" className="primary" disabled={busy || topic.trim().length < 2}>{busy ? 'Saving…' : 'Create my fable'} <span aria-hidden="true">→</span></button><p className="demo-note">Local demo: opens the sample story. AI generation is not connected.</p></form></main>}
      {route.view === 'read' && !error && <main><div className="reader-intro"><div className="eyebrow">A sample fable · How AI agents work</div><h1>The Hall of Affairs</h1><span className="meta">5 minute read</span><img src="/art/01_yingshizhai_story-1600.webp" alt="A scholar, a clerk and a steward in the Hall of Affairs"/></div><article className="prose"><div dangerouslySetInnerHTML={md(storyText)}/><h2>After the story</h2><img src="/art/02_yingshizhai_explain-1600.webp" alt="Illustrated layers of an AI agent, shown as a house"/><div dangerouslySetInnerHTML={md(lessonText)}/></article><div className="read-finish"><button className="primary" onClick={() => navigate({ view:'end' })}>Finish the fable <span aria-hidden="true">→</span></button></div></main>}
      {route.view === 'end' && <main className={`end end-${route.ending}`}>
        {route.ending === 1 && <><div className="colophon"/><div className="eyebrow">The end</div><h1>A story to keep.</h1><p className="closing">Take it with you. Pass it on.</p>{actions}<p className="saved">{saveLabel}</p><button className="link next" onClick={create}>Create another fable →</button></>}
        {route.ending === 2 && <><div className="keepsake"><img src="/art/cover-1600.webp" alt="Cover of The Hall of Affairs"/><div className="eyebrow">Fable · Your reading collection</div><h1>The Hall<br/>of Affairs</h1><div className="meta">How AI agents work</div></div><p className="closing">Some stories are worth passing on.</p>{actions}<p className="saved">{saveLabel}</p><button className="link next" onClick={create}>Make another →</button></>}
        {route.ending === 3 && <><img className="end-art" src="/art/01_yingshizhai_story-1600.webp" alt="The quiet courtyard"/><div><div className="eyebrow">The end</div><h1>Now you see the whole house.</h1><button className="link next" onClick={create}>What will you learn next? →</button></div><div className="end-rail"><div><strong>The Hall of Affairs</strong><p className="saved">{saveLabel}</p></div>{actions}</div></>}
      </main>}
      <dialog ref={dialog} onCancel={() => setModal(null)} onClose={() => setModal(null)} aria-labelledby="dialog-title">
        <div className="dialog-top"><h2 id="dialog-title">{modal === 'share' ? 'Pass the story on.' : 'Keep the fable.'}</h2><button className="close" aria-label="Close dialog" onClick={() => setModal(null)}>×</button></div>
        {modal === 'download' ? <><p>The story and its explanation, together.</p><button className="option" onClick={() => download()}>Offline book <span>HTML · illustrations included · opens in any browser</span></button><button className="option" onClick={() => download(true)}>Save as PDF <span>Opens your browser’s print view</span></button></> : <><p>A quiet link to the story. No account needed to read.</p><label className="field" htmlFor="share-url">Local sample link</label><input id="share-url" value={shareURL} readOnly onFocus={e => e.target.select()}/><button className="primary" onClick={copyLink}>Copy preview link ↗</button><p className="demo-note">Sharing mock only. This link opens the sample on this computer; nothing has been published.</p><a className="link" href={shareURL} target="_blank" rel="noreferrer">Preview recipient view ↗</a></>}
        <div className="notice" role="status">{notice}</div>
      </dialog>
    </div>
  </>;
}

createRoot(document.getElementById('root')).render(<App/>);
