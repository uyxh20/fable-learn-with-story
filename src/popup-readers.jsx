/*
 * [INPUT]: FABLE pages, locale/theme controls, onExit; ?reader= selects a mock.
 * [OUTPUT]: window.PopupStageReader, window.TunnelBookReader, window.PaperMechanicsReader
 * [POS]: Local reader experiments. No side effects until mounted.
 */
(function () {
  const { useState, useEffect, useRef, useMemo, useCallback } = React;
  const STYLE = `
.pb-root { position:fixed; inset:0; overflow:hidden; background:var(--bg); color:var(--ink); z-index:40; font-family:var(--font-body); }
.pb-root * { box-sizing:border-box; }
.pb-desk { position:absolute; inset:-20px; background-size:cover; background-position:center; filter:blur(12px); opacity:.12; pointer-events:none; }
.pb-top { position:absolute; inset:0 0 auto; height:76px; display:flex; align-items:center; gap:12px; padding:12px 24px; background:var(--bg); border-bottom:1px solid var(--line); z-index:5; }
.pb-root button,.pb-root select { cursor:pointer; }
.pb-root button:focus-visible,.pb-root select:focus-visible,.pb-text:focus-visible,.pb-pull:focus-visible { outline:2px solid var(--accent); outline-offset:4px; }
.pb-top button { min-width:44px; min-height:44px; }
.pb-label { flex:1; min-width:0; font-size:18px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.pb-top .langtoggle { flex:none; }
.pb-workspace { position:absolute; inset:98px 52px 92px; display:flex; align-items:center; justify-content:center; }
.pb-book { position:relative; width:min(1200px,100%); height:min(680px,100%); touch-action:pan-y; perspective:1900px; }
.pb-spread { --open:1; width:100%; height:100%; display:grid; grid-template-columns:1fr 1fr; background:var(--bg-2); border-radius:6px 15px 15px 6px; box-shadow:0 5px 0 var(--line-2),0 9px 0 var(--bg-2),0 30px 60px #0006; border:1px solid var(--line-2); }
.pb-text { position:relative; padding:clamp(24px,4vw,64px); overflow:auto; scrollbar-width:thin; overscroll-behavior:contain; min-height:0; border-right:1px solid var(--line-2); background:linear-gradient(90deg,transparent 95%,var(--line)); }
.pb-text h1,.pb-text h2 { font:500 clamp(30px,3.2vw,52px)/1.08 var(--font-display); margin:22px 0; text-wrap:balance; }
.pb-text:lang(zh) h1,.pb-text:lang(zh) h2 { font-family:var(--font-cjk); }
.pb-text p { font-size:20px; line-height:1.65; }
.pb-text .cine-prose { font-size:21px; line-height:1.7; }
.pb-text .cine-prose p { font-size:inherit; }
.pb-text .cine-prose li { font-size:inherit; }
.pb-text .kicker { color:var(--ink-2); font:10px/1.6 var(--font-mono); letter-spacing:.12em; }
.pb-text .pb-deck { color:var(--ink-2); }
.pb-text::after { content:''; display:block; position:sticky; bottom:-64px; height:20px; background:linear-gradient(transparent,var(--bg-2)); pointer-events:none; }
.pb-picture { position:relative; min-width:0; display:grid; place-items:center; perspective:1100px; perspective-origin:50% 40%; }
.pb-plate { position:relative; width:85%; height:64%; transform-style:preserve-3d; }
.pb-flat { width:100%; height:100%; object-fit:cover; border:7px solid #d5c3a2; }
.pb-caption { position:absolute; bottom:20px; left:22px; right:22px; color:var(--ink-2); text-align:center; font:10px/1.6 var(--font-mono); letter-spacing:.12em; text-transform:uppercase; }
.pb-cover { width:68%; height:86%; position:relative; background:#25312b; color:#f6eddb; border-radius:3px 10px 10px 3px; border:1px solid #9e885e; border-left:14px solid #28342e; box-shadow:8px 7px 0 #c4b38e,14px 20px 30px #0005; display:flex; flex-direction:column; justify-content:flex-end; padding:22px; transform:rotateY(-12deg); }
.pb-cover img { position:absolute; inset:0; width:100%; height:100%; object-fit:cover; opacity:.65; }
.pb-cover::after { content:''; position:absolute; inset:0; background:linear-gradient(transparent,#14201bea); }
.pb-cover strong,.pb-cover span { z-index:1; font-family:var(--font-display); font-size:32px; line-height:1.05; }
.pb-cover span { font:10px/1.5 var(--font-mono); margin-top:16px; color:#d7bb85; }
.pb-leaf { position:absolute; inset:0 0 0 50%; transform-origin:left; transform:rotateY(var(--leaf,0deg)); transform-style:preserve-3d; z-index:3; pointer-events:none; }
.pb-leaf.pb-backward { inset:0 50% 0 0; transform-origin:right; }
.pb-leaf-face { position:absolute; inset:0; backface-visibility:hidden; -webkit-backface-visibility:hidden; background:var(--bg-2); border:1px solid var(--line-2); padding:40px; overflow:hidden; }
.pb-leaf-front img { width:100%; height:100%; object-fit:cover; }
.pb-leaf-back { transform:rotateY(180deg); }
.pb-leaf .pb-text { height:100%; padding:10px; }
.pb-edge { position:absolute; top:50%; width:44px; height:60px; border:1px solid var(--line-2); background:var(--bg-2); color:var(--ink); border-radius:50%; z-index:4; }
.pb-edge.prev { left:-34px; } .pb-edge.next { right:-34px; }
.pb-root button:disabled { opacity:.3; cursor:default; }
.pb-bottom { position:absolute; inset:auto 24px 18px; display:flex; align-items:center; justify-content:space-between; gap:16px; }
.pb-switch { display:flex; align-items:center; gap:12px; font:11px var(--font-mono); color:var(--ink-2); }
.pb-switch a { color:var(--ink-2); text-decoration:none; padding:10px 4px; border-bottom:1px solid transparent; }
.pb-switch a[aria-current] { color:var(--ink); border-color:var(--accent); }
.pb-switch select { display:none; background:var(--bg-2); color:var(--ink); border:1px solid var(--line-2); min-height:44px; }
.pb-count { color:var(--ink-2); font:11px var(--font-mono); white-space:nowrap; }
.pb-mobile-nav { display:none; }
.pb-overlay { position:absolute; inset:0; background:#0009; z-index:10; display:grid; place-items:center; padding:16px; }
.pb-dialog { width:min(480px,100%); max-height:80vh; overflow:auto; background:var(--bg-2); border:1px solid var(--line-2); padding:24px; display:grid; gap:6px; }
.pb-dialog button { min-height:44px; text-align:left; background:transparent; border:0; color:var(--ink); padding:10px; font:17px var(--font-body); }
.pb-dialog button[aria-current] { background:var(--line); }

.pb-stage { position:absolute; inset:8% 10% 4%; transform-style:preserve-3d; transform:rotateX(-8deg); }
.pb-floor { position:absolute; left:0; top:90%; width:100%; height:38%; transform-origin:top; transform:rotateX(90deg); background:linear-gradient(#baa27c,#8f7959); border:1px solid #cfbc96; }
.pb-wall { position:absolute; inset:0 0 10%; transform-origin:bottom; transform:rotateX(calc(-90deg * (1 - var(--open)))); border:8px solid #c4b18e; background:#c4b18e; box-shadow:0 8px 16px #0004; }
.pb-wall img { width:100%; height:100%; object-fit:cover; }

.pb-cut { position:absolute; bottom:10%; left:0; width:100%; height:90%; transform-origin:bottom; transform:translateZ(var(--z)) rotateX(calc(-90deg * (1 - clamp(0, calc(var(--open) * 1.2 - var(--delay)), 1)))); }
.pb-cut img { width:100%; height:100%; object-fit:cover; clip-path:polygon(0 76%,4% 74%,8% 79%,12% 71%,16% 73%,20% 66%,24% 70%,28% 77%,32% 73%,36% 79%,40% 75%,44% 81%,48% 78%,52% 83%,56% 80%,60% 84%,64% 77%,68% 81%,72% 76%,76% 80%,80% 73%,84% 76%,88% 68%,92% 71%,96% 65%,100% 70%,100% 100%,0 100%); }
.pb-cut svg { position:absolute; bottom:0; width:42%; height:66%; fill:#958568; stroke:#d6c59f; stroke-width:2; }
.pb-tunnel { position:absolute; inset:0; transform-style:preserve-3d; transform:rotateX(var(--tilt-x,0deg)) rotateY(var(--tilt-y,0deg)); transition:transform 180ms ease-out; }
.pb-tunnel-plane { position:absolute; inset:0; transform:translateZ(calc(var(--depth) * var(--open))); transform-style:preserve-3d; }
.pb-tunnel-plane svg { width:100%; height:100%; filter:drop-shadow(0 5px 6px #0005); }
.pb-tunnel-plane img { position:absolute; inset:0; width:100%; height:100%; object-fit:cover; }
.pb-tunnel-band { clip-path:polygon(0 78%,10% 74%,17% 79%,25% 70%,34% 75%,45% 72%,55% 80%,68% 75%,80% 80%,90% 71%,100% 75%,100% 100%,0 100%); }
.pb-mechanism { position:absolute; inset:4% 0 8%; transform-style:preserve-3d; transform-origin:bottom; transform:rotateX(calc(-80deg * (1 - var(--open)))); border:7px solid #c8b590; box-shadow:0 12px 25px #0005; background:#cab994; }
.pb-mechanism.pb-decode-mechanism { inset:35% 0 6%; }
.pb-mechanism > img { width:100%; height:100%; object-fit:cover; }
.pb-pull { position:absolute; left:calc(20% + var(--pull) * .45%); bottom:-28px; width:110px; height:44px; display:grid; place-items:center; background:#dfcc9e; color:#342b1e; border:1px solid #9a835b; border-radius:0 0 8px 8px; font:12px var(--font-mono); cursor:ew-resize; touch-action:none; user-select:none; box-shadow:0 5px 10px #0003; }
.pb-lift { position:absolute; inset:0; transform-origin:top; transform:rotateX(calc(var(--lift,0) * 158deg)); transform-style:preserve-3d; transition:transform 650ms var(--ease); touch-action:none; cursor:pointer; }
.pb-lift img { position:absolute; inset:0; width:100%; height:100%; object-fit:cover; backface-visibility:hidden; -webkit-backface-visibility:hidden; border:1px solid #dac49c; }
.pb-lift-back { position:absolute; inset:0; transform:rotateY(180deg); background:#c8b793; backface-visibility:hidden; -webkit-backface-visibility:hidden; border:1px solid #a18c65; }
.pb-peek { inset:20% 26% 18%; transform-origin:left; transform:rotateY(calc(var(--lift,0) * -145deg)); }
.pb-peek img { object-fit:cover; object-position:75% 50%; }
.pb-flap-control { position:absolute; bottom:-38px; left:0; width:100%; min-height:44px; padding:8px; background:#d8c299; color:#30271a; border:1px solid #a28c63; font:12px var(--font-body); touch-action:none; }
@media(max-width:899px) {
 .pb-desk { filter:none; }
 .pb-top { height:64px; padding:8px; gap:4px; }
 .pb-label { display:none; }
 .pb-top [data-ob=shelf] { margin-right:auto; padding:8px; }
 .pb-workspace { inset:76px 12px 112px; }
 .pb-book { width:100%; height:100%; perspective:none; }
 .pb-spread { grid-template-columns:1fr; grid-template-rows:46% 54%; border-radius:8px; }
 .pb-picture { grid-row:1; }
 .pb-text { grid-row:2; padding:20px 24px; border-right:0; border-top:1px solid var(--line-2); background:var(--bg-2); }
 .pb-text .cine-prose,.pb-text p { font-size:18px; line-height:1.6; }
 .pb-text h1,.pb-text h2 { font-size:30px; margin:10px 0; }
 .pb-text::after { bottom:-20px; }
 .pb-plate { width:76%; height:70%; }
 .pb-caption { bottom:6px; font-size:8px; }
 .pb-cover { width:44%; height:85%; padding:12px; border-left-width:7px; }
 .pb-cover strong { font-size:20px; } .pb-cover span { font-size:7px; margin-top:6px; }
 .pb-edge,.pb-switch a,.pb-count { display:none; }
 .pb-bottom { bottom:10px; inset-inline:12px; display:block; }
 .pb-switch { justify-content:center; gap:8px; }
 .pb-switch select { display:block; width:min(260px,80vw); }
 .pb-mobile-nav { display:flex; gap:12px; margin-bottom:5px; }
 .pb-mobile-nav button { height:44px; flex:1; color:var(--ink); background:var(--bg-2); border:1px solid var(--line-2); border-radius:4px; }
 .pb-leaf { display:none; }
}
`;
  const variants = [['original', 'Original'], ['popup', 'A Pop-up Stage'], ['tunnel', 'B Tunnel Book'], ['mechanics', 'C Paper Mechanics']];
  function sectionsFor(pages) {
    const out = [];
    pages.forEach(p => {
      if (p.kind === 'Cover') out.push({ type: 'cover', page: p, image: p.image });
      else if (p.kind === 'Story') {
        if (p.sceneIndex === 0) out.push({ type: 'chapter', page: p, image: p.image });
        out.push({ type: 'scene', page: p, image: p.image });
      } else out.push({ type: 'decode', page: p, image: p.image });
    });
    const image = out[out.length - 1]?.image || pages[0]?.image;
    out.push({ type: 'end', page: { image }, image });
    return out;
  }
  const clamp = (n, min = 0, max = 1) => Math.max(min, Math.min(max, n));
  const ease = n => n * n * (3 - 2 * n);
  function TextPage({ s, T, meta, lang, onBegin, onExit }) {
    const p = s.page;
    const end = { en:'End of the fable', fr:'Fin de la fable', da:'Fablen er slut', zh:'寓言完' }[lang];
    return <>
      <p className="kicker">{s.type === 'scene' ? `${T.theFable} · ${p.sceneIndex + 1}/${p.sceneCount}` : s.type === 'decode' ? T.afterStory : s.type === 'chapter' ? `${T.ch} ${roman(p.chapterIndex + 1)}` : meta.trilogy}</p>
      {s.type === 'scene' || s.type === 'decode' ? <>{s.type === 'decode' && <h2>{p.title}</h2>}<Prose raw={p.raw} drop={s.type === 'scene' && p.sceneIndex === 0}/></> : <>
        <h2 style={{fontFamily:_cjk(p.title || end) ? 'var(--font-cjk)' : 'var(--font-display)'}}>{s.type === 'end' ? end : s.type === 'cover' ? meta.title : p.title}</h2>
        <p className="pb-deck">{s.type === 'chapter' ? p.deck : meta.subtitle}</p>
        <button className="btn btn--ghost" onClick={s.type === 'end' ? onExit : onBegin}>{s.type === 'end' ? T.shelf : T.begin} <Icon name="right" size={16}/></button>
      </>}
    </>;
  }
  function Stage({ s, T }) {
    const scene=s.page.sceneIndex||0, pan=s.page.pan??50;
    return <div className="pb-stage"><div className="pb-floor"/><div className="pb-wall"><img src={s.image} alt={s.type === 'decode' ? T.figureAlt : ''} style={{objectPosition:`${pan}% 50%`}}/></div>
      <div className="pb-cut" style={{'--z':'36px','--delay':'.12'}} aria-hidden="true"><img src={s.image} alt="" style={{objectPosition:`${pan}% 50%`}}/></div>
      <div className="pb-cut" style={{'--z':'65px','--delay':'.2'}} aria-hidden="true"><svg style={{left:scene%2?'auto':'-2%',right:scene%2?'-2%':'auto'}} viewBox="0 0 180 240" preserveAspectRatio="none">
        {scene%3===0 ? <path fillRule="evenodd" d="M10 240V64Q90-10 170 64V240H10Z M40 240V92Q90 12 140 92V240Z"/> : scene%3===1 ? <path d="M15 240V93H0L90 18L180 93H165V240H145V95H35V240ZM20 62L90 0L160 62Z"/> : <path d="M26 240L40 45L52 240ZM66 240L83 4L93 240ZM112 240L130 38L142 240Z M36 110Q-8 59 6 35Q51 54 36 110 M85 84Q124 35 150 44Q149 89 85 84 M126 141Q162 100 177 110Q177 145 126 141"/>}
      </svg></div>
    </div>;
  }
  function Tunnel({ s, T, reduced }) {
    const ref = useRef(null), scene = s.page.sceneIndex || 0;
    const colors = ['#d8c9a7','#c7b58e','#b2a17f','#978768'];
    const shift = (scene % 3 - 1) * 22;
    return <div className="pb-tunnel" ref={ref} onPointerMove={e => {
      if (reduced || e.pointerType !== 'mouse' || innerWidth < 900) return;
      const r=e.currentTarget.getBoundingClientRect();
      ref.current.style.setProperty('--tilt-x',`${clamp((e.clientY-r.top)/r.height,0,1)*-12+6}deg`);
      ref.current.style.setProperty('--tilt-y',`${clamp((e.clientX-r.left)/r.width,0,1)*12-6}deg`);
    }} onPointerLeave={() => {ref.current.style.setProperty('--tilt-x','0deg');ref.current.style.setProperty('--tilt-y','0deg');}}>
      <div className="pb-tunnel-plane" style={{'--depth':'-240px'}}><img src={s.image} alt={s.type==='decode'?T.figureAlt:''} style={{objectPosition:`${s.page.pan??50}% 50%`}}/></div>
      {[3,2,1,0].map(i => <div className="pb-tunnel-plane" key={i} style={{'--depth':`${-60*i}px`}}>
        {i>0 && <img className="pb-tunnel-band" src={s.image} alt="" aria-hidden="true" style={{objectPosition:`${clamp((s.page.pan||0)+i*12,0,100)}% 50%`, clipPath:`polygon(0 ${86-i*5}%, 12% ${80-i*4}%, 26% ${84-i*5}%, 40% ${72-i*3}%, 58% ${86-i*4}%, 70% ${76-i*4}%, 85% ${83-i*3}%, 100% ${75-i*3}%,100% 100%,0 100%)`}}/>}
        <svg viewBox="0 0 500 400" preserveAspectRatio="none" aria-hidden="true"><path fill={colors[i]} fillRule="evenodd" stroke="#e8d9b6" strokeWidth="2" d={`M0 0H500V400H0Z M${48+i*10+shift} ${50+i*6} Q250 ${18+i*10} ${452-i*10+shift} ${50+i*6} L${443-i*8+shift} ${340-i*5} Q250 ${372-i*6} ${58+i*8+shift} ${340-i*5} Z`}/></svg>
      </div>)}
    </div>;
  }
  function Mechanics({ s, T, pages }) {
    const [pull,setPull]=useState(0), [lift,setLift]=useState(false);
    const drag=useRef(null), moved=useRef(false);
    const decode=s.type==='decode', tab=s.type!=='decode' && (s.page.sceneIndex||0)%2===0;
    const story=pages.find(p=>p.kind==='Story' && p.chapterIndex===s.page.chapterIndex)?.image || s.image;
    const words={en:['Pull','Lift to peek','Close flap'],fr:['Tirer','Soulever','Refermer'],da:['Træk','Løft flappen','Luk flappen'],zh:['拉动','掀开看看','合上']}[document.documentElement.lang.split('-')[0]] || ['Pull','Lift to peek','Close flap'];
    const dragStart=e=>{e.preventDefault();e.stopPropagation();e.currentTarget.setPointerCapture(e.pointerId);drag.current={x:e.clientX,y:e.clientY,value:pull};moved.current=false;};
    const dragMove=e=>{if(!drag.current)return;const dx=e.clientX-drag.current.x,dy=e.clientY-drag.current.y;if(Math.abs(dx)+Math.abs(dy)>8)moved.current=true;if(tab)setPull(Math.round(clamp(drag.current.value+dx*.8,0,100)));else if(dy < -25)setLift(true);else if(dy>25)setLift(false);};
    const dragEnd=()=>{drag.current=null;};
    const toggle=()=>{if(!moved.current)setLift(v=>!v);moved.current=false;};
    return <div className={`pb-mechanism ${decode?'pb-decode-mechanism':''}`} data-mechanism="" style={{'--pull':pull,'--lift':lift?1:0}}>
      <img src={s.image} alt={decode?T.figureAlt:''} style={{objectPosition:`${clamp((s.page.pan??50)+pull*((s.page.pan??50)>50?-.7:.7),0,100)}% 50%`}}/>
      {tab ? <div className="pb-pull" role="slider" tabIndex={0} aria-label={words[0]} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pull} onPointerDown={dragStart} onPointerMove={dragMove} onPointerUp={dragEnd} onPointerCancel={dragEnd} onKeyDown={e=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();e.stopPropagation();setPull(n=>e.key==='Home'?0:e.key==='End'?100:clamp(n+(e.key==='ArrowRight'?10:-10),0,100));}}}>↔ {words[0]}</div> : <>
        <div className={`pb-lift ${decode?'':'pb-peek'}`} aria-hidden="true" onPointerDown={dragStart} onPointerMove={dragMove} onPointerUp={dragEnd} onPointerCancel={dragEnd} onClick={toggle}><div className="pb-lift-back"/><img src={decode?story:s.image} alt=""/></div>
        <button className="pb-flap-control" aria-expanded={lift} onClick={()=>setLift(v=>!v)}>{lift?words[2]:decode?T.afterStory:words[1]} ↑</button>
      </>}
    </div>;
  }
  function Installation({ s, variant, pages, T, reduced }) {
    if (variant === 'popup') return <Stage s={s} T={T}/>;
    if (variant === 'tunnel') return <Tunnel s={s} T={T} reduced={reduced}/>;
    return <Mechanics s={s} T={T} pages={pages}/>;

  }
  function Contents({ sections, active, T, meta, onPick, onClose }) {
    const dialog = useRef(null);
    useEffect(() => {
      const prior = document.activeElement;
      dialog.current.querySelector('button').focus();
      return () => prior?.focus();
    }, []);
    return <div className="pb-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}><div className="pb-dialog" role="dialog" aria-modal="true" aria-label={T.contents} ref={dialog} onKeyDown={e => {
      if (e.key === 'Escape') { e.stopPropagation(); onClose(); }
      if (e.key === 'Tab') {
        const buttons = [...dialog.current.querySelectorAll('button')];
        const next = (buttons.indexOf(document.activeElement) + (e.shiftKey ? -1 : 1) + buttons.length) % buttons.length;
        e.preventDefault(); buttons[next].focus();
      }
    }}>
      <button onClick={onClose}>{T.closeLabel} ×</button>
      {sections.map((s,i) => <button key={sectionRoute(s)} aria-current={i === active ? 'page' : undefined} onClick={() => onPick(i)}>{i + 1}. {s.type === 'end' ? T.endLabel : barLabel(s,T,meta)}</button>)}
      <button onClick={() => { onClose(); window.dispatchEvent(new Event('fable:guide')); }}>{T.guideLabel}</button>
    </div></div>;
  }
  function BookReader({ variant, pages, T, lang, theme, setTheme, setLang, onExit }) {
    const sections = useMemo(() => sectionsFor(pages), [pages]);
    const routeIndex = () => Math.max(0, sections.findIndex(s => sectionRoute(s) === location.hash));
    const [active, setActive] = useState(routeIndex);
    const [turn, setTurn] = useState(null);
    const [toc, setToc] = useState(false);
    const [reduced, setReduced] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
    const spread = useRef(null), leaf = useRef(null), text = useRef(null), frame = useRef(0), lock = useRef(false), swipe = useRef(null);
    const meta = pages[0]?.meta || FABLE.metaFor(lang);
    const cur = sections[active] || sections[0];
    useEffect(() => {
      const media = matchMedia('(prefers-reduced-motion: reduce)');
      const sync = () => setReduced(media.matches);
      media.addEventListener('change',sync); return () => media.removeEventListener('change',sync);
    }, []);
    useEffect(() => {
      const sync = () => {
        cancelAnimationFrame(frame.current); lock.current = false; setTurn(null);
        const i = routeIndex(); setActive(i);
        history.replaceState(null,'',sectionRoute(sections[i]));
        if (spread.current) { spread.current.style.setProperty('--open','1'); spread.current.style.transform = ''; }
        if (text.current) text.current.scrollTop = 0;
      };
      sync(); window.addEventListener('hashchange',sync);
      return () => { window.removeEventListener('hashchange',sync); cancelAnimationFrame(frame.current); };
    }, [sections]);
    const go = useCallback((i) => {
      if (lock.current || i === active || i < 0 || i >= sections.length) return;
      if (reduced) {
        setActive(i); history.replaceState(null,'',sectionRoute(sections[i]));
        spread.current.style.setProperty('--open','1'); text.current.scrollTop = 0; lock.current = false; return;
      }
      lock.current = true; setTurn({ from:active, to:i, dir:i > active ? 1 : -1 });
    }, [active, sections, reduced]);
    useEffect(() => {
      if (!turn) return;
      const mobile = innerWidth < 900;
      const duration = mobile ? 700 : 1100;
      let start, swapped = false;
      const tick = now => {
        start ??= now;
        const t = clamp((now-start)/duration);
        if (t >= .4 && !swapped) {
          swapped = true; setActive(turn.to); text.current.scrollTop = 0;
          history.replaceState(null,'',sectionRoute(sections[turn.to]));
        }
        const open = t < .4 ? 1-ease(clamp(t/.35)) : ease(clamp((t-(turn.dir < 0 ? .75 : .45))/(turn.dir < 0 ? .25 : .55)));
        spread.current.style.setProperty('--open',String(open));
        if (mobile) spread.current.style.transform = `translateX(${Math.sin(t*Math.PI)*-turn.dir*18}px)`;
        else if (leaf.current) {
          const progress = ease(clamp((t-.28)/.55));
          leaf.current.style.setProperty('--leaf',`${(turn.dir > 0 ? -180 : 180)*progress}deg`);
          leaf.current.style.visibility = t < .28 || t > .84 ? 'hidden' : 'visible';
        }
        if (t < 1) frame.current = requestAnimationFrame(tick);
        else { spread.current.style.setProperty('--open','1'); spread.current.style.transform=''; lock.current=false; setTurn(null); }
      };
      frame.current = requestAnimationFrame(tick);
      return () => cancelAnimationFrame(frame.current);
    }, [turn]);
    useEffect(() => {
      const key = e => {
        if (e.key === 'Escape') { setToc(false); return; }
        if (toc || document.querySelector('.ob-card[role="dialog"]') || lock.current || e.defaultPrevented || e.target.closest('input, textarea, select, [contenteditable], [role="dialog"], [role="slider"]')) return;
        if (e.target.closest('button') && [' ','Enter'].includes(e.key)) return;
        const forward = ['ArrowRight','PageDown',' '].includes(e.key), back = ['ArrowLeft','PageUp'].includes(e.key);
        if (!forward && !back) return;
        e.preventDefault();
        const el = text.current;
        if (['PageDown',' '].includes(e.key) && el.scrollTop + el.clientHeight < el.scrollHeight - 4) el.scrollBy({top:el.clientHeight*.75,behavior:reduced ? 'instant' : 'smooth'});
        else go(active + (forward ? 1 : -1));
      };
      window.addEventListener('keydown',key); return () => window.removeEventListener('keydown',key);
    }, [active,go,toc,reduced]);
    const switchUrl = value => { const url = new URL(location.href); url.searchParams.set('reader',value); return url.href; };
    return <div className="pb-root" data-variant={variant} lang={htmlLang(lang)}>
      <style>{STYLE}</style><div className="pb-desk" style={{backgroundImage:`url("${cur.image}")`}}/>
      <header className="pb-top"><button className="btn btn--quiet" data-ob="shelf" onClick={onExit}><Icon name="left" size={16}/>{T.shelf}</button><span className="pb-label">{barLabel(cur,T,meta)}</span><button className="iconbtn" data-ob="contents" aria-label={T.contents} onClick={() => setToc(true)}><Icon name="contents"/></button><LangToggle lang={lang} setLang={setLang}/><ThemeToggle theme={theme} setTheme={setTheme} lang={lang}/></header>
      <main className="pb-workspace"><div className="pb-book" onPointerDown={e => {
        if (e.pointerType === 'mouse' || e.target.closest('button,select,[data-mechanism],.pb-text')) return;
        swipe.current={x:e.clientX,y:e.clientY};
      }} onPointerUp={e => { if (!swipe.current) return; const dx=e.clientX-swipe.current.x,dy=e.clientY-swipe.current.y; swipe.current=null; if (Math.abs(dx)>40 && Math.abs(dx)>Math.abs(dy)*1.4) go(active+(dx<0?1:-1)); }} onPointerCancel={() => { swipe.current=null; }}>
        <div className="pb-spread" ref={spread} data-route={sectionRoute(cur)} data-turning={!!turn}>
          <article className="pb-text" ref={text} tabIndex={0} aria-label={barLabel(cur,T,meta)}><TextPage key={sectionRoute(cur)} s={cur} T={T} meta={meta} lang={lang} onBegin={() => go(active+1)} onExit={onExit}/></article>
          <div className="pb-picture">
            {['cover','end'].includes(cur.type) ? <div className="pb-cover" style={cur.type === 'end' ? {transform:'rotateY(12deg)'} : undefined}><img src={pages[0].image} alt=""/><strong>{cur.type === 'end' ? T.endLabel : meta.title}</strong><span>FABLE · {meta.subtitle}</span></div> : <div className="pb-plate"><Installation key={`${variant}-${sectionRoute(cur)}`} s={cur} variant={variant} pages={pages} T={T} reduced={reduced}/></div>}
            <span className="pb-caption">{variants.find(v=>v[0]===variant)[1]} · {active+1} / {sections.length}</span>
          </div>
        </div>
        {turn && <div className={`pb-leaf ${turn.dir<0?'pb-backward':''}`} ref={leaf} aria-hidden="true" inert=""><div className="pb-leaf-face pb-leaf-front"><img src={sections[turn.from].image} alt=""/></div><div className="pb-leaf-face pb-leaf-back"><div className="pb-text"><TextPage s={sections[turn.to]} T={T} meta={meta} lang={lang}/></div></div></div>}
        <button className="pb-edge prev" aria-label={T.prev} disabled={active===0||!!turn} onClick={() => go(active-1)}>←</button><button className="pb-edge next" aria-label={T.next} disabled={active===sections.length-1||!!turn} onClick={() => go(active+1)}>→</button>
      </div></main>
      <footer className="pb-bottom"><div className="pb-mobile-nav"><button disabled={active===0||!!turn} onClick={() => go(active-1)}>{T.prev}</button><button disabled={active===sections.length-1||!!turn} onClick={() => go(active+1)}>{T.next}</button></div><nav className="pb-switch" aria-label="Mock readers"><span>Mock</span>{variants.map(([v,label])=><a key={v} href={switchUrl(v)} aria-current={variant===v?'page':undefined}>{label}</a>)}<select aria-label="Mock reader" value={variant} onChange={e=>{location.href=switchUrl(e.target.value);}}>{variants.map(([v,label])=><option key={v} value={v}>{label}</option>)}</select></nav><span className="pb-count" aria-live="polite">{active+1} / {sections.length}</span></footer>
      {toc && <Contents sections={sections} active={active} T={T} meta={meta} onPick={i=>{setToc(false);go(i);}} onClose={()=>setToc(false)}/>}
    </div>;
  }
  window.PopupStageReader = props => <BookReader {...props} variant="popup"/>;
  window.TunnelBookReader = props => <BookReader {...props} variant="tunnel"/>;
  window.PaperMechanicsReader = props => <BookReader {...props} variant="mechanics"/>;
})();
