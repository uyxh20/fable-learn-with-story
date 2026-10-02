/* FABLE — self-onboarding tour
   A pragmatic, screen-aware guided tour. Spotlights real controls on the
   create / generate / reader screens, persists "seen" locally so returning
   users aren't interrupted, and leaves a "Guide me" button to replay it.
   Renders into its own root so it composes over the live React app. */
(function () {
  const { useState, useEffect, useRef } = React;

  // ---- tour content (English; tone: minimal + practical) ----------------
  const SEGMENTS = {
    create: [
      { key: "concept", target: "concept", title: "Start with a concept",
        body: ["Type the idea you want turned into a fable — a question, a system, or a concept you’re trying to understand."] },
      { key: "setting", target: "setting", title: "Choose a setting",
        body: ["Pick the world the fable is told in — classical, myth, fairy tale, or present-day. It shapes both the voice and the artwork."] },
      { key: "sample", target: "sample", finish: true, title: "Explore the sample book",
        body: ["New story and image generation are not available yet. Use the sample-book link to read the illustrated stories."] },
    ],
    generate: [
      { key: "open", target: "open", action: "Press “Open the book” to start reading.", title: "Open the book",
        body: ["This button appears the moment your fable is ready."] },
    ],
    reader: [
      { key: "read", target: null, title: "Read by scrolling",
        body: ["Scroll down to move through the story. Each scene rises over its own cinematic backdrop."] },
      { key: "nav", target: "contents", title: "Find your place",
        body: ["The rail on the right tracks your progress — tap a dot to jump. Contents lists every chapter."] },
      { key: "decode", target: "contents", title: "After the story",
        body: ["Past the final scene comes the decode — a plain-language explanation of what the fable was really teaching."] },
      { key: "shelf", target: "shelf", finish: true, title: "Back to the shelf",
        body: ["Use the shelf button to return to the home screen.",
               "You can replay this guide anytime from “Guide me”."] },
    ],
  };
  const ORDER = ["create", "generate", "reader"];
  const DONE_KEY = "fable-tour-v1-done";

  const findEl = (key) => (key ? document.querySelector('[data-ob="' + key + '"]') : null);
  const visibleSteps = (seg) =>
    (SEGMENTS[seg] || []).filter((s) => !s.optional || findEl(s.target));

  // Bring a target comfortably into view by scrolling its scrollable ancestor
  // directly (not scrollIntoView, which can disrupt the app's own scrollers).
  function scrollIntoViewSafe(el) {
    if (!el) return;
    const vh = window.innerHeight;
    const r = el.getBoundingClientRect();
    if (r.top >= 64 && r.bottom <= vh - 64) return;
    let p = el.parentElement;
    while (p && p !== document.body) {
      const s = getComputedStyle(p);
      if (/(auto|scroll)/.test(s.overflowY + " " + s.overflow) && p.scrollHeight > p.clientHeight + 2) break;
      p = p.parentElement;
    }
    const delta = Math.round(r.top - vh * 0.4);
    if (p && p !== document.body && p !== document.documentElement) p.scrollTop += delta;
    else window.scrollBy(0, delta);
  }

  const STYLE = `
    .ob-veil{position:fixed;inset:0;z-index:9000;pointer-events:none;}
    .ob-dim{position:absolute;inset:0;background:rgba(8,6,3,.66);}
    .ob-spot{position:fixed;border-radius:6px;
      border:1px solid color-mix(in srgb,var(--accent) 72%,transparent);
      box-shadow:0 0 0 9999px rgba(8,6,3,.66),0 0 26px -2px var(--glow);
      transition:top .26s var(--ease),left .26s var(--ease),width .26s var(--ease),height .26s var(--ease);}
    .ob-card{position:fixed;width:var(--obw,340px);max-width:calc(100vw - 24px);pointer-events:auto;
      background:var(--bg-2);border:1px solid var(--line-2);border-radius:4px;
      box-shadow:var(--shadow);padding:22px 22px 16px;color:var(--ink);}
    .ob-card .ob-x{position:absolute;top:11px;right:11px;width:30px;height:30px;display:grid;
      place-items:center;border:0;background:none;color:var(--ink-3);border-radius:2px;cursor:pointer;}
    .ob-card .ob-x:hover{color:var(--ink);background:color-mix(in srgb,var(--ink) 8%,transparent);}
    .ob-card .ob-x svg{width:16px;height:16px;}
    .ob-title{font-family:var(--font-display);font-weight:600;font-size:24px;line-height:1.08;
      letter-spacing:-.01em;margin:6px 44px 0 0;color:var(--ink);}
    .ob-body{margin:11px 0 0;}
    .ob-body p{margin:0 0 .55em;font-family:var(--font-body),serif;font-size:15px;line-height:1.62;color:var(--ink-2);}
    .ob-body p:last-child{margin-bottom:0;}
    .ob-bul{list-style:none;margin:13px 0 0;padding:0;display:grid;gap:10px;}
    .ob-bul li{position:relative;padding-left:18px;font-family:var(--font-body),serif;
      font-size:14px;line-height:1.5;color:var(--ink-2);}
    .ob-bul li::before{content:"";position:absolute;left:1px;top:8px;width:5px;height:5px;
      border-radius:50%;background:var(--accent);}
    .ob-bul li b{color:var(--ink);font-weight:600;}
    .ob-foot{display:flex;align-items:center;gap:12px;margin-top:19px;}
    .ob-count{font-family:var(--font-mono);font-size:11px;letter-spacing:.14em;color:var(--ink-3);}
    .ob-skip{background:none;border:0;padding:0;cursor:pointer;font-family:var(--font-mono);
      font-size:10.5px;letter-spacing:.1em;text-transform:uppercase;color:var(--ink-3);}
    .ob-skip:hover{color:var(--ink-2);text-decoration:underline;}
    .ob-foot-r{margin-left:auto;display:flex;align-items:center;gap:8px;}
    .ob-b{font-family:var(--font-mono);font-size:11px;letter-spacing:.1em;text-transform:uppercase;
      padding:.62em 1.05em;border-radius:2px;border:1px solid transparent;cursor:pointer;
      transition:all .2s var(--ease);}
    .ob-b.next{background:var(--accent);color:#1a1208;}
    .ob-b.next:hover{filter:brightness(1.08);box-shadow:0 0 26px -6px var(--glow);}
    .ob-b.ghost{border-color:var(--line-2);color:var(--ink-2);}
    .ob-b.ghost:hover{color:var(--ink);border-color:var(--accent);}
    .ob-action{display:inline-flex;align-items:center;gap:9px;font-family:var(--font-body),serif;
      font-style:italic;font-size:13.5px;line-height:1.4;color:var(--accent);text-align:right;}
    .ob-dot{flex:0 0 auto;width:7px;height:7px;border-radius:50%;background:var(--accent);
      box-shadow:0 0 8px var(--glow);animation:obPulse 1.5s var(--ease) infinite;}
    @keyframes obPulse{0%,100%{opacity:.45;transform:scale(.8);}50%{opacity:1;transform:scale(1.12);}}
    .ob-guide{position:fixed;left:16px;bottom:16px;z-index:8500;display:inline-flex;align-items:center;
      gap:9px;padding:9px 15px 9px 12px;border-radius:999px;border:1px solid var(--line-2);
      background:color-mix(in srgb,var(--bg-2) 84%,transparent);
      -webkit-backdrop-filter:blur(9px);backdrop-filter:blur(9px);color:var(--ink-2);cursor:pointer;
      font-family:var(--font-mono);font-size:11px;letter-spacing:.13em;text-transform:uppercase;
      box-shadow:var(--shadow-soft);transition:all .2s var(--ease);}
    .ob-guide:hover{color:var(--ink);border-color:var(--accent);}
    .ob-guide svg{width:15px;height:15px;color:var(--accent);}
    @media (max-width:560px){ .ob-guide span{display:none;} .ob-guide{padding:10px;} }
  `;

  const CloseIcon = () => (
    React.createElement("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor",
      strokeWidth: 1.6, strokeLinecap: "round" },
      React.createElement("path", { d: "M6 6l12 12M18 6L6 18" })));

  const CompassIcon = () => (
    React.createElement("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor",
      strokeWidth: 1.5, strokeLinecap: "round", strokeLinejoin: "round" },
      React.createElement("circle", { cx: 12, cy: 12, r: 9 }),
      React.createElement("path", { d: "M15.5 8.5l-2 5-5 2 2-5z" })));

  function Coach({ step, idx, len, onNext, onBack, onEnd }) {
    const [, setTick] = useState(0);
    const lastRef = useRef(null);

    // Re-measure continuously. rAF gives smooth tracking when the tab is
    // visible; a setInterval + scroll/resize listeners keep it correct even
    // when rAF is throttled (e.g. an offscreen preview iframe).
    useEffect(() => {
      let raf;
      // bring the step's target into view once when the step opens
      const el0 = step && step.target ? findEl(step.target) : null;
      if (el0) scrollIntoViewSafe(el0);
      const bump = () => setTick((t) => t + 1);
      const loop = () => {
        const el = step && step.target ? findEl(step.target) : null;
        const r = el ? el.getBoundingClientRect() : null;
        const nr = r ? { x: r.left, y: r.top, w: r.width, h: r.height } : null;
        const last = lastRef.current;
        const changed = (!!nr !== !!last) || (nr && last &&
          ["x", "y", "w", "h"].some((k) => Math.abs(nr[k] - last[k]) > 0.5));
        if (changed) { lastRef.current = nr; bump(); }
        raf = requestAnimationFrame(loop);
      };
      loop();
      const iv = setInterval(bump, 200);
      window.addEventListener("resize", bump);
      window.addEventListener("scroll", bump, true);
      return () => {
        cancelAnimationFrame(raf); clearInterval(iv);
        window.removeEventListener("resize", bump);
        window.removeEventListener("scroll", bump, true);
      };
    }, [step]);

    const vp = { w: window.innerWidth, h: window.innerHeight };
    const tEl = step && step.target ? findEl(step.target) : null;
    const tr = tEl ? tEl.getBoundingClientRect() : null;
    const rect = tr ? { x: tr.left, y: tr.top, w: tr.width, h: tr.height } : null;
    const CARDW = Math.min(340, vp.w - 24);

    // measure the card so a tall card can be clamped inside the viewport
    const cardRef = useRef(null);
    const [cardH, setCardH] = useState(0);
    useEffect(() => {
      const previous = document.activeElement;
      cardRef.current?.focus();
      const onKey = (event) => {
        if (event.key === "Escape") { event.preventDefault(); onEnd(); }
      };
      document.addEventListener("keydown", onKey);
      return () => {
        document.removeEventListener("keydown", onKey);
        if (previous?.isConnected) previous.focus();
      };
    }, []);
    React.useLayoutEffect(() => {
      const h = cardRef.current ? cardRef.current.offsetHeight : 0;
      if (h && Math.abs(h - cardH) > 1) setCardH(h);
    });
    const isAction = !!step.action;
    const isFinish = !!step.finish;

    // spotlight box (padded around the target)
    let spot = null;
    if (rect) {
      const pad = 7;
      spot = React.createElement("div", { className: "ob-spot", style: {
        top: rect.y - pad, left: rect.x - pad, width: rect.w + pad * 2, height: rect.h + pad * 2,
      } });
    }

    // card placement
    let cardStyle = { ["--obw"]: CARDW + "px" };
    if (rect) {
      const below = rect.y + rect.h / 2 < vp.h / 2;
      const left = Math.max(12, Math.min(rect.x + rect.w / 2 - CARDW / 2, vp.w - CARDW - 12));
      cardStyle.left = left;
      let top = below ? rect.y + rect.h + 14 : rect.y - cardH - 14;
      const maxTop = Math.max(12, vp.h - cardH - 12);
      top = Math.max(12, Math.min(top, maxTop));
      cardStyle.top = Math.round(top);
    } else {
      cardStyle.left = Math.round((vp.w - CARDW) / 2);
      cardStyle.top = Math.round(Math.max(12, (vp.h - cardH) / 2));
    }

    return React.createElement("div", { className: "ob-veil" },
      rect ? spot : React.createElement("div", { className: "ob-dim" }),
      React.createElement("div", { className: "ob-card", style: cardStyle, ref: cardRef, role: "dialog", "aria-labelledby": "guide-title", tabIndex: -1 },
        React.createElement("button", { className: "ob-x", "aria-label": "Close guide", onClick: onEnd },
          React.createElement(CloseIcon)),
        React.createElement("h3", { className: "ob-title", id: "guide-title" }, step.title),
        step.bullets
          ? React.createElement(React.Fragment, null,
              step.lead && React.createElement("div", { className: "ob-body" },
                React.createElement("p", null, step.lead)),
              React.createElement("ul", { className: "ob-bul" },
                step.bullets.map((b, k) => React.createElement("li", { key: k }, b))))
          : React.createElement("div", { className: "ob-body" },
              step.body.map((p, k) => React.createElement("p", { key: k }, p))),
        React.createElement("div", { className: "ob-foot" },
          React.createElement("span", { className: "ob-count" }, (idx + 1) + " / " + len),
          React.createElement("button", { className: "ob-skip", onClick: onEnd }, "Skip"),
          React.createElement("div", { className: "ob-foot-r" },
            isAction
              ? React.createElement("span", { className: "ob-action" },
                  React.createElement("i", { className: "ob-dot" }), step.action)
              : [
                  idx > 0 && React.createElement("button", { key: "b", className: "ob-b ghost", onClick: onBack }, "Back"),
                  isFinish
                    ? React.createElement("button", { key: "f", className: "ob-b next", onClick: onEnd }, "Finish")
                    : React.createElement("button", { key: "n", className: "ob-b next", onClick: onNext }, "Next"),
                ]
          )
        )
      )
    );
  }

  function Onboarding() {
    const [active, setActive] = useState(false);
    const [seg, setSeg] = useState("create");
    const [i, setI] = useState(0);
    const [screen, setScreen] = useState(() => window.__fableScreen || "create");
    const completed = useRef({});

    // track which screen the app is on
    useEffect(() => {
      const onScreen = (e) => setScreen(e.detail || window.__fableScreen || "create");
      window.addEventListener("fable:screen", onScreen);
      return () => window.removeEventListener("fable:screen", onScreen);
    }, []);

    const end = () => {
      try { localStorage.setItem(DONE_KEY, "1"); } catch (e) {}
      setActive(false);
    };
    const startAt = (s) => { completed.current = {}; setSeg(s); setI(0); setActive(true); };

    // auto-start once, on first visit
    useEffect(() => {
      let done = false;
      try { done = localStorage.getItem(DONE_KEY) === "1"; } catch (e) {}
      if (done) return;
      try { localStorage.setItem(DONE_KEY, "1"); } catch (e) {}
      const t = setTimeout(() => startAt(window.__fableScreen || "create"), 850);
      return () => clearTimeout(t);
    }, []);

    // when the app changes screen mid-tour, advance to that screen's segment
    useEffect(() => {
      if (!active || seg === screen) return;
      completed.current[seg] = true;
      if (!completed.current[screen]) { setSeg(screen); setI(0); }
      else if (ORDER.every((s) => completed.current[s])) end();
    }, [screen, active, seg]);

    const steps = visibleSteps(seg);
    const idx = Math.max(0, Math.min(i, steps.length - 1));
    const showStep = active && seg === screen && steps.length > 0 ? steps[idx] : null;

    const next = () => setI(Math.min(idx + 1, steps.length - 1));
    const back = () => setI(Math.max(idx - 1, 0));

    return React.createElement(React.Fragment, null,
      React.createElement("style", null, STYLE),
      React.createElement("button", { className: "ob-guide", onClick: () => startAt(screen),
        title: "Replay the guided tour" },
        React.createElement(CompassIcon),
        React.createElement("span", null, "Guide me")),
      showStep && React.createElement(Coach, {
        step: showStep, idx, len: steps.length,
        onNext: next, onBack: back, onEnd: end,
      })
    );
  }

  const host = document.createElement("div");
  host.id = "ob-root";
  document.body.appendChild(host);
  ReactDOM.createRoot(host).render(React.createElement(Onboarding));
})();
