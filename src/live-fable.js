(function () {
  const FALLBACK_IMAGE = "art/cover.png";

  function params() {
    return new URLSearchParams(window.location.search);
  }

  function mode() {
    const explicit = params().get("mode") || localStorage.getItem("fable-mode");
    if (explicit) return explicit;
    return window.location.protocol === "file:" ? "mock" : "live";
  }

  function isLive() {
    return mode() === "live";
  }

  function sessionId() {
    const key = "fable-public-session";
    let value = localStorage.getItem(key);
    if (!value) {
      value = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
      localStorage.setItem(key, value);
    }
    return value;
  }

  async function api(path, options) {
    const res = await fetch(path, options);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(data.detail || data.error || `${path} failed with ${res.status}`);
      err.status = res.status;
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
    return scenes.slice(0, 4);
  }

  function dataUrl(image) {
    if (!image) return FALLBACK_IMAGE;
    return image.url || FALLBACK_IMAGE;
  }

  function buildPages(opts) {
    const lang = ["zh", "da", "fr"].includes(opts.lang) ? opts.lang : "en";
    const concept = opts.concept || "";
    const title = titleFor(concept, lang);
    const image = opts.imageSrc || FALLBACK_IMAGE;
    const split = splitStory(opts.markdown || "", lang);
    const scenes = chunk(paragraphs(split.story), lang === "zh" ? 300 : 520);
    const usedScenes = scenes.length ? scenes : [split.story || concept || title];
    const chapterTitle = lang === "zh" ? "《寓言》" : (lang === "da" ? "Fablen" : (lang === "fr" ? "La fable" : "The Fable"));
    const deck = lang === "zh" ? "由你的概念临场生成。" : (lang === "da" ? "Genereret live ud fra dit koncept." : (lang === "fr" ? "Générée en direct à partir de votre concept." : "Generated live from your concept."));
    const pages = [{
      kind: "Cover",
      nav: "Cover",
      chapterIndex: -1,
      sceneIndex: 0,
      sceneCount: 1,
      title,
      titleEn: "Live fable",
      subtitle: lang === "zh" ? "临场生成的插画寓言" : (lang === "da" ? "En live-genereret illustreret fabel" : (lang === "fr" ? "Une fable illustrée générée en direct" : "A live illustrated fable")),
      concept,
      image,
      prompt: "",
      meta: {
        title,
        alt: lang === "zh" ? "Live fable" : (lang === "da" ? "Live fabel" : (lang === "fr" ? "Fable en direct" : "临场寓言")),
        subtitle: lang === "zh" ? "临场生成的插画寓言" : (lang === "da" ? "En live-genereret illustreret fabel" : (lang === "fr" ? "Une fable illustrée générée en direct" : "A live illustrated fable")),
        trilogy: lang === "zh" ? "临场寓言" : (lang === "da" ? "Live fabel" : (lang === "fr" ? "Fable en direct" : "Live fable")),
        concept,
      },
      chapters: [{
        main: chapterTitle,
        sub: opts.setting || "",
        idea: deck,
      }],
    }];
    usedScenes.forEach((raw, i) => {
      pages.push({
        kind: "Story",
        chapterIndex: 0,
        sceneIndex: i,
        sceneCount: usedScenes.length,
        title: chapterTitle,
        titleEn: opts.setting || "",
        deck,
        image,
        prompt: "",
        pan: usedScenes.length > 1 ? Math.round((i / (usedScenes.length - 1)) * 100) : 50,
        nav: `${chapterTitle} · ${i + 1}/${usedScenes.length}`,
        raw,
      });
    });
    pages.push({
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
      image,
      prompt: "",
    });
    return pages;
  }

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async function pollJob(jobId, onStage, onPartial) {
    const started = Date.now();
    let storySeen = false;
    let transientFailures = 0;
    while (Date.now() - started < 360000) {
      let status;
      try {
        status = await api(`/api/generations/${encodeURIComponent(jobId)}`, { method: "GET" });
        transientFailures = 0;
      } catch (err) {
        if ([429, 500, 502, 503, 504].includes(err.status) && transientFailures < 8) {
          transientFailures += 1;
          await sleep(Math.min(30000, 4000 * transientFailures));
          continue;
        }
        throw err;
      }
      if (status.partial_result) {
        storySeen = true;
        onPartial && onPartial(status.partial_result);
      }
      if (status.stage === "story_call_completed") onStage && onStage(2);
      if (status.stage === "image_call_started") onStage && onStage(3);
      if (status.status === "completed") {
        onStage && onStage(4);
        return status;
      }
      if (status.status === "failed" || status.status === "needs_reconciliation") {
        throw new Error(status.error || "Generation failed.");
      }
      await sleep(storySeen ? 12000 : 5000);
    }
    throw new Error("Generation timed out.");
  }

  async function generate({ request, lang, onStage, onPartial }) {
    if (!request || !request.concept) throw new Error("Missing concept.");
    onStage && onStage(1);
    const idempotency = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
    const created = await api("/api/generations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Fable-Session": sessionId(),
      },
      body: JSON.stringify({
        concept: request.concept,
        lang,
        setting: request.setting,
        idempotency_token: idempotency,
        human_proof: "browser-session",
      }),
    });
    const toBook = (result) => {
      const image = result.image || {};
      const src = dataUrl(image);
      const pages = buildPages({
        markdown: result.markdown || "",
        lang,
        concept: request.concept,
        setting: request.setting,
        imageSrc: src,
      });
      const run = {
        ts: new Date().toISOString(),
        lang,
        setting: request.setting,
        concept: request.concept,
        images: [{ plate: 1, register: "story/decoded", prompt: "", src }],
        total_cost_usd: 0,
      };
      return { lang, pages, run, markdown: result.markdown || "", partial: !result.image };
    };
    const completed = await pollJob(created.job_id, onStage, (partial) => {
      onPartial && onPartial(toBook(partial || {}));
    });
    const result = completed.result || {};
    return toBook(result);
  }

  window.FABLE_LIVE = { isLive, mode, generate, buildPages };
})();
