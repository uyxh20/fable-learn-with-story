# Fable (Learn with Story)

[Open Fable](https://fable-learn-with-story.ulysse-ha-19.workers.dev)

Learn an idea through an illustrated fable. Choose a story world, enter an idea, or read the curated sample. English, French, Danish and Chinese are supported, with light and dark themes.

## Current release

The homepage pairs a chat-bubble composer (idea, story world, tappable example ideas) with the illustrated sample. The theme follows the system preference until the reader chooses one. The quiet colophon offers an offline HTML book (including illustrations), a browser print view for PDF, and explicit sharing with a revocable link.

Creation uses OpenRouter: `PLAN_MODEL` (`anthropic/claude-sonnet-5.5`, medium reasoning effort) writes the storyboard, `LLM_MODEL` (`anthropic/claude-opus-5.5`, low effort) writes the prose, and `bytedance-seed/seedream-5-0-flash` paints three 1K, 16:9 scene illustrations. `PLAN_EFFORT` and `TEXT_EFFORT` (`low`, `medium`, `high`) tune thinking depth without a code change. The reader is inferred from the idea itself: “for my six-year-old” or “for a new hire” changes vocabulary, length and the explanation. The API key is stored only as an encrypted Cloudflare secret.

## Saved creations

Cloudflare D1 records every accepted request before generation begins. A Cloudflare Workflow continues independently of the browser. Full story text, explanation, source idea, setting, language, model identifiers and provider usage are saved in private R2 storage; each generated illustration is stored as image bytes, with its prompt and metadata separately. The story has three sequential scenes with matching illustration prompts and shared character descriptions. Images crossfade as their corresponding text enters the reading area. A short storyboard fixes the characters and scene actions first. One streamed prose request and all three image requests then run concurrently. Complete sentences of the scene being written are saved at most every 1.2 seconds and open in the reader within seconds; half sentences, unfinished JSON and the explanation stay private until whole. Later scenes and pictures appear without resetting reading position. The status endpoint reports the title, the stage (`planning`, `writing`, `illustrating`, `complete`, `failed`) and progress counts, which drive the generation screen. Sharing and the final download controls appear after generation finishes. Finished scenes and images are retained if another step fails. Older one-image creations remain readable.

A random HttpOnly, Secure, SameSite=Strict cookie owns the creation. “Your fables” shows the latest 30 creations for that browser, including unfinished jobs. There are no accounts or cross-device recovery: clearing the cookie loses private access, although the backend retains the creation. Download a copy or create a share link to keep access elsewhere.

Stories are private by default. Only the owner can create or revoke an unguessable share link. Anyone holding an active link can read and download the story and illustration; the original input, provider details and usage are not exposed. Revoking the link stops future access, but cannot recall downloaded copies.

## Local development and checks

Requires Node.js 22 or newer and Chrome for browser QA.

```sh
npm ci
npm run check
npx wrangler d1 migrations apply fable-creations --local
npm run dev
```

`npm run check` runs focused unit tests, builds the frontend and validates the Worker bundle. `node scripts/qa-creation.mjs` runs actual local Workflow, D1 and R2 bindings with stubbed OpenRouter responses, including failure retention, duplicate requests, concurrent quotas, ownership, share revocation, downloads and persistence across a runtime restart. It makes no paid provider calls. To run one real production creation, explicitly opt in with `FABLE_PAID_SMOKE=1 node scripts/qa-live-creation.mjs`. This uses the configured models and checks persistence, download, sharing and revocation. Browser QA uses the installed Chrome channel; set `FABLE_CHROME=/path/to/chromium` to use another binary.

The build (`scripts/build.mjs`) emits one hashed React file, one hashed application bundle and a tiny theme bootstrap, inlines the stylesheet and the self-hosted Latin font faces, and keeps design-time tooling out of `dist/`. Static assets are served ahead of the Worker (`run_worker_first` lists only `/api/*` and `/healthz`); `public/_headers` carries the security and cache headers for them. Master illustrations live in `art-src/`; `python3 scripts/optimize-art.py` regenerates the 1600 px and 800 px WebP renditions and blur placeholders in `public/art/`, and `node scripts/fetch-fonts.mjs` refreshes the font files under `public/fonts/`.

`node scripts/qa-regression.mjs` checks the homepage and sample reader without creating a story. `node scripts/qa-exports.mjs` checks offline downloads, PDF rendering, sample share links and production security boundaries. Set `FABLE_TEST_URL` to check a deployed site. Evidence belongs under ignored `.gstack/`, never in the public asset directory.

The five original homepage mocks and three endings remain available through `npm run dev:mocks` at `http://127.0.0.1:8788/mocks/compare`. These are local English prototypes and use sample content. They build separately under ignored `.local-preview/`. See [the original design study](docs/local-design-study.md). Experimental paper readers remain confined to localhost.

## OpenRouter setup

In Cloudflare, open the Worker’s Settings → Variables and Secrets and add `OPENROUTER_API_KEY` as a **Secret**. Alternatively use `npx wrangler secret put OPENROUTER_API_KEY` with an authenticated CLI. Never put a real key into Git, chat, frontend code, or plain-text variables.

Set the owner-selected `LLM_MODEL` and `IMAGE_MODEL` IDs in `wrangler.jsonc`, verify each model’s capabilities, then set `GENERATION_ENABLED` to `true` and deploy. All three values and all storage/workflow bindings are required before creation is available. Text uses OpenRouter chat completions; image generation uses its dedicated images endpoint. The current image adapter supports Seedream 5.0 Flash and Google image models with 1K resolution, and other compatible models with medium quality; verify parameters before changing providers.

For local paid testing only, put the key in ignored `.dev.vars` using `.dev.vars.example`. Normal QA needs no real key. Configure an OpenRouter key credit limit as an additional budget boundary.

Requests are limited to 2,000 input characters, 2,500 combined reasoning/output tokens for the storyboard, 12,000 for prose, and three images (two text requests and three image requests per creation). D1 atomically enforces one active creation per browser, three creations per browser/day, five per IP/day and 20 globally/day (UTC). Failed attempts count toward limits. A refused request says which boundary was hit (`creation_active` with the story to reopen, `daily_limit_browser`, `daily_limit_network`, `daily_limit_global`) so the interface can explain it in the reader’s language. Provider requests have timeouts and are not automatically retried; storage writes can retry without making another paid request. These are bounded public-preview limits, not user authentication or comprehensive bot protection.

## Deployment

```sh
npx wrangler login
npx wrangler d1 migrations apply fable-creations --remote
npm run deploy
```

The configured D1 database, private R2 bucket and Workflow must exist. `dist/` is the only public asset directory. Secrets remain in Cloudflare across deployments. The optional GitHub Actions check is in `docs/github-actions-check.yml`; automatic deployments are not configured.

## Privacy and security

The backend sends the entered idea, language and setting to OpenRouter for story generation, and sends the fixed storyboard to the prose writer and each scene’s illustration prompt to the image model concurrently. It retains finished content and failed-request status. It does not log API keys or provider response bodies. There is no analytics integration. UI preferences use local storage; reading position and the draft idea use session storage. Latin typography is self-hosted; Google Fonts supplies the Chinese serif only when Chinese is selected.

The app uses same-origin write checks, private bucket access, escaped Markdown, bounded request/output sizes, and browser security headers on both Worker and static responses. Public asset builds exclude source audits, local records, secrets and logs. Private backend data is not uploaded to GitHub.

Public visibility does not grant an open-source license. No license has been selected for the original app or artwork. React’s license notice is retained in the built bundle.
