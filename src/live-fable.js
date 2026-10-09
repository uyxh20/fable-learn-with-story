(function () {
  const FALLBACK_IMAGE = "art/cover-1600.webp";

  function params() {
    return new URLSearchParams(window.location.search);
  }

  function mode() {
    const explicit = params().get("mode") || localStorage.getItem("fable-mode");
    if (explicit) return explicit;
    return window.location.protocol === "file:" ? "mock" : "live";
  }

  function isLive() {
    return true;
  }

  async function api(path, options) {
    const res = await fetch(path, options);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(data.detail || data.error || `${path} failed with ${res.status}`);
      err.status = res.status;
      err.code = data.error || (res.status >= 500 ? "service_unavailable" : "request_failed");
      err.storyId = data.story_id || null;
      throw err;
    }
    return data;
  }

  function stripFences(md) {
    md = String(md || "").trim();
    md = md.replace(/^```(?:markdown|md)?\s*/i, "").replace(/\s*```$/i, "");
    const firstHeading = md.search(/^#{1,3}\s+/m);
    if (firstHeading > 0) md = md.slice(firstHeading);
    return md.trim();
  }

  function splitStory(md, lang) {
    md = stripFences(md);
    const marker = lang === "zh"
      ? /###\s*(?:故事之后|故事之后：它讲的到底是什么|寓意|解释)[^\n]*/i
      : lang === "da"
        ? /###\s*(?:Efter historien|Fortolkning|Hvad historien egentlig siger|Forklaring)[^\n]*/i
        : lang === "fr"
          ? /###\s*(?:Après l'histoire|Apres l'histoire|Interprétation|Ce que l'histoire dit vraiment|Explication)[^\n]*/i
          : /###\s*(?:After the story|Decoded|What it really says|Explanation)[^\n]*/i;
    const match = md.match(marker);
    if (!match || match.index == null) {
      const fallbackLesson = lang === "zh"
        ? "### 故事之后\n\n模型没有返回解释段。"
        : lang === "da"
          ? "### Efter historien\n\nModellen returnerede ikke et forklarende afsnit."
          : lang === "fr"
            ? "### Après l'histoire\n\nLe modèle n'a pas renvoyé de section explicative."
            : "### After the story\n\nThe model did not return a decoded section.";
      return { story: md, lesson: fallbackLesson };
    }
    return {
      story: md.slice(0, match.index).trim(),
      lesson: md.slice(match.index).trim(),
    };
  }

  function titleFor(concept, lang) {
    const clean = String(concept || "").trim();
    if (!clean) {
      if (lang === "zh") return "一则寓言";
      if (lang === "da") return "En fabel";
      if (lang === "fr") return "Une fable";
      return "A Fable";
    }
    const short = clean.length > 70 ? `${clean.slice(0, 67)}...` : clean;
    if (lang === "zh") return `关于「${short}」的寓言`;
    if (lang === "da") return `En fabel om ${short}`;
    if (lang === "fr") return `Une fable sur ${short}`;
    return `A fable about ${short}`;
  }

  function paragraphs(story) {
    return String(story || "")
      .split(/\n\s*\n/)
      .map((x) => x.trim())
      .filter(Boolean)
      .filter((x) => !/^#{1,3}\s+/.test(x));
  }

  function chunk(blocks, budget) {
    const scenes = [];
    let cur = "";
    blocks.forEach((b) => {
      if (cur && cur.length + b.length > budget) {
        scenes.push(cur);
        cur = b;
      } else {
        cur = cur ? `${cur}\n\n${b}` : b;
      }
    });
    if (cur) scenes.push(cur);
    return scenes;
  }

  function dataUrl(image) {
    if (!image) return FALLBACK_IMAGE;
    return image.url || FALLBACK_IMAGE;
  }

  const copyFor = (lang) => (window.FABLE_HOME_COPY && window.FABLE_HOME_COPY[lang]) || {};

  function buildPages(opts) {
    const lang = ["zh", "da", "fr"].includes(opts.lang) ? opts.lang : "en";
    const concept = opts.concept || "";
    const title = opts.title || titleFor(concept, lang);
    const image = opts.imageSrc ?? FALLBACK_IMAGE;
    const split = splitStory(opts.markdown || "", lang);
    const budget = lang === "zh" ? 300 : 520;
    const legacyScenes = chunk(paragraphs(split.story), budget);
    const usedScenes = opts.scenes?.length
      ? opts.scenes.flatMap((scene, sceneIndex) => {
        const parts = chunk(paragraphs(scene.text), budget);
        if (!parts.length && scene.partial) parts.push("");
        return parts.map((raw, i) => ({ raw, image: scene.image?.url || (opts.text_complete !== undefined ? "" : image), writing: !!scene.partial && i === parts.length - 1, sceneNumber: sceneIndex + 1 }));
      })
      : (legacyScenes.length ? legacyScenes : [split.story || concept || title]).map((raw) => ({ raw, image }));
    const C = copyFor(lang);
    const chapterTitle = C.theFable || (lang === "zh" ? "寓言" : (lang === "da" ? "Fablen" : (lang === "fr" ? "La fable" : "The fable")));
    const deck = concept ? "" : (C.sharedDeck || "");
    const pages = [{
      kind: "Cover",
      nav: "Cover",
      chapterIndex: -1,
      sceneIndex: 0,
      sceneCount: 1,
      title,
      titleEn: "Live fable",
      subtitle: C.coverSub || "An illustrated fable",
      concept,
      image,
      prompt: "",
      live: true,
      meta: {
        title,
        alt: C.coverAlt || "Fable",
        subtitle: C.coverSub || "An illustrated fable",
        trilogy: C.coverKicker || "A fable",
        concept,
      },
      chapters: [{
        main: chapterTitle,
        sub: opts.setting || "",
        idea: concept,
      }],
    }];
    usedScenes.forEach((scene, i) => {
      pages.push({
        kind: "Story",
        chapterIndex: 0,
        sceneIndex: i,
        sceneCount: usedScenes.length,
        title: chapterTitle,
        titleEn: opts.setting || "",
        deck,
        concept,
        setting: opts.setting || "",
        live: true,
        image: scene.image,
        prompt: "",
        pan: usedScenes.length > 1 ? Math.round((i / (usedScenes.length - 1)) * 100) : 50,
        nav: `${chapterTitle} · ${i + 1}/${usedScenes.length}`,
        raw: scene.raw,
        writing: scene.writing,
        sceneNumber: scene.sceneNumber,
      });
    });
    if (opts.text_complete !== false) pages.push({
      kind: "Lesson",
      nav: lang === "zh" ? "寓言 - 释义" : (lang === "da" ? "Fablen - Fortolket" : (lang === "fr" ? "La fable - Interprétée" : "The Fable - Decoded")),
      chapterIndex: 0,
      sceneIndex: 0,
      sceneCount: 1,
      title: chapterTitle,
      titleEn: lang === "fr" ? "La fable · interprétée" : (lang === "zh" ? "The Fable · decoded" : "The Fable · decoded"),
      pan: 50,
      deck: lang === "zh" ? "故事之后。" : (lang === "da" ? "Efter historien." : (lang === "fr" ? "Après l'histoire." : "After the story.")),
      raw: split.lesson,
      image: usedScenes[usedScenes.length - 1].image,
      prompt: "",
      live: true,
    });
    return pages;
  }

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function toBook(result, id, shareURL, partial = false, generating = false, state = null) {
    const lang = result.lang || "en", src = result.text_complete !== undefined ? (result.image?.url || "") : dataUrl(result.image);
    return { lang, storyId: id, shareURL, partial, generating, markdown: result.markdown, title: result.title,
      progress: state?.progress || null, stage: state?.stage || null,
      pages: buildPages({ ...result, imageSrc: src }),
      run: { images: (result.scenes?.map((s) => s.image).filter(Boolean) || [result.image]).filter(Boolean).map((image) => ({ src: image.url, prompt: "" })), total_cost_usd: 0 } };
  }
  async function pollJob(id, onStatus, onPartial, active = () => true, share = "") {
    const started = Date.now(); let lastPartial = "";
    while (active() && Date.now() - started < 600000) {
      const state = await api(share ? `/api/shared/${encodeURIComponent(share)}` : `/api/generations/${encodeURIComponent(id)}`);
      onStatus?.(state);
      if (state.status === "completed") return toBook(state.result, state.story_id, state.share_url, false, false, state);
      if (state.status === "failed") {
        if (state.partial_result) return toBook(state.partial_result, state.story_id, state.share_url, true, false, state);
        const err = new Error(state.error || "This fable could not be created. Please try again later.");
        err.code = state.error_code || "generation_failed";
        throw err;
      }
      if (state.partial_result) {
        const snapshot = JSON.stringify(state.partial_result);
        if (snapshot !== lastPartial) { lastPartial = snapshot; onPartial?.(toBook(state.partial_result, state.story_id, null, true, true, state)); }
      }
      await sleep(state.progress?.text_complete ? 2000 : 1200);
    }
    if (!active()) return null;
    const err = new Error("Your fable is still being created. You can reopen it from Your fables.");
    err.code = "still_working";
    throw err;
  }
  async function generate({ request, lang, onStatus, onPartial, active }) {
    await api("/api/session", { method: "POST" });
    const created = await api("/api/generations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ concept: request.concept, setting: request.setting, lang, idempotency_token: crypto.randomUUID() }) });
    history.replaceState(null, "", `/?story=${created.story_id}#read/cover`);
    return pollJob(created.job_id, onStatus, onPartial, active);
  }
  async function load(id, share, active, onUpdate, onStatus) { return pollJob(id, onStatus, onUpdate, active, share); }
  window.FABLE_LIVE = { isLive, mode, generate, buildPages, load };
})();
