# Fable local design study — 3 October 2026

Historical prototype notes: homepage 5 and ending A were subsequently selected for production. The production implementation now uses server-owned D1/Workflow/R2 persistence; see the current README. Claims below about deployment and missing backend features describe the original local-only study.

The goal is an immediately understandable homepage, with very little text: learn through illustrated stories, read a sample, or create a fable. All five options reuse Fable’s artwork, literary typography, parchment, ink and muted gold. The existing production homepage and three experimental paper readers are preserved.

Start with `npm run dev:mocks`, then open [the playground](http://127.0.0.1:8788/mocks/). Use the top review bar to switch homepages and endings. The review bar is prototype tooling, not proposed product UI. After QA captures are generated, `node scripts/make-home-gallery.mjs` creates [the visual comparison](http://127.0.0.1:8788/mocks/compare.html).

| Homepage | Approach | Tradeoff |
| --- | --- | --- |
| [1 · The open book](http://127.0.0.1:8788/mocks/?home=1) | Spare parchment layout, short promise, arched artwork entry | Calm and elegant; one click before entering an idea |
| [2 · Lantern light](http://127.0.0.1:8788/mocks/?home=2) | Existing cinematic identity, much less copy, compact sample entry | Closest to today; creation attracts more attention than the sample |
| [3 · One line](http://127.0.0.1:8788/mocks/?home=3) | Direct “Learn through stories” headline, one input, horizontal sample | Best balance of clarity and simplicity; recommended |
| [4 · The little library](http://127.0.0.1:8788/mocks/?home=4) | A book-like sample leads; create sits beside it | Strong reading invitation; more text than 3 |
| [5 · A question](http://127.0.0.1:8788/mocks/?home=5) | A question and input beside an immersive illustrated sample | Expressive and inviting; taller on mobile |

| Ending | Approach | Tradeoff |
| --- | --- | --- |
| [A · Quiet colophon](http://127.0.0.1:8788/mocks/?home=3&ending=1&view=end) | Short closing, Download / Share, create another | Simplest; recommended |
| [B · Bookplate](http://127.0.0.1:8788/mocks/?home=3&ending=2&view=end) | A keepsake cover above the same actions | More collectible, more vertical space |
| [C · Reading rail](http://127.0.0.1:8788/mocks/?home=3&ending=3&view=end) | Keeps the final illustration and separates actions below | Preserves the reading mood; actions are less prominent |

## What works and what is mocked

- All homepages: sample opens; create opens the same concise form; entered ideas carry over; world selections work; back/home, theme switching and ending selection work.
- Create: explicitly uses the curated sample, regardless of topic/world. This tests the flow without pretending the model generated a new story. Each submitted demo receives its own persisted story ID.
- Sample: the full existing English chapter and explanation are saved once per local browser, then reused. The prototype reader displays this sample content intentionally.
- Download: the illustrated HTML book is self-contained and works offline. PDF opens the browser print view; the user chooses “Save as PDF.”
- Share: a copyable local sample link and recipient preview. No remote publication, public backend endpoint, or user story exposure is implemented. The final public-link behavior remains a design decision.
- Draft UI is English only; the existing app’s four languages and readers are unaffected.

## Persistence implementation

`POST /api/stories` stores a complete snapshot; `GET /api/stories/:id` retrieves it for the same browser owner. Both are enabled only by the explicit local configuration and a loopback hostname. Production configuration is unchanged. The bucket is emulated locally and is not a Cloudflare resource created by this work.

The snapshot includes ID, title, topic, setting, locale, full Markdown, illustration, state and timestamps. A random HttpOnly, SameSite=Strict cookie supplies private ownership. Storage keys use its SHA-256 digest. The story ID alone is not sufficient to read a story. No public listing or automatic sharing exists. Storage survives app/runtime restarts. Clearing the cookie loses that browser’s access; cross-device accounts and recovery are outside this prototype.

R2 conditional writes provide idempotent retries and prevent stale partial responses overwriting completed results. This uses [Cloudflare’s documented R2 Workers API](https://developers.cloudflare.com/r2/api/workers/workers-api-reference/). Completed records are immutable; different content for the same completed ID returns 409. Failed writes return an error instead of a success state.

The existing generation adapter saves partial content before its read-early callback and saves completed content before returning the book. Full Markdown is persisted independently of the reader’s scene construction. API/model values remain empty; generation routes still fail closed. When a generation backend is implemented later, its server job must also await `saveStory` before reporting completion, so closing the browser cannot lose server-generated output.

Requests are capped at 1 MiB; Markdown at 200,000 characters. Illustrations must be curated `/art/*.png` assets or embedded PNG/JPEG/WebP bytes. Arbitrary external URLs are rejected to avoid storing expiring links or fetching untrusted destinations. Provider integration will need to persist larger image files separately and add identity/quotas before enabling cloud writes. No remote bucket or public storage API is enabled now.

## Verification

- Seven automated tests: private retrieval; repeated saves; partial-to-final concurrency; stale partial protection; immutable completed story; origin, payload and image validation; error handling; generation-save ordering; original Worker behavior.
- Real local Miniflare/R2 runtime disposed and recreated: full story, embedded illustration and complete state survived; ownership and retry behavior preserved.
- Browser flow QA: five homepages × 1440 / 390 / 320 px; three endings at each width; both themes; entered topic and world; actual backend snapshot; reload; finish; start again; dialogs; independent recipient preview; unauthorized reads rejected.
- Downloaded HTML opened from disk with embedded illustrations and complete story/explanation. `node scripts/qa-home-exports.mjs` checks the clipboard/recipient flow and PDF print request; a headless print-to-PDF render verifies the resulting document. This does not automate the OS print dialog.
- Captured desktop/mobile visual evidence under ignored `.gstack/homepage-study-2026-10-03/` and reviewed rendered layouts.
- `npm run check`: tests, production build and Worker dry-run. No deployment. `git diff --check`: clean.

## Diff summary

New files add the isolated prototype, local build/config, story store/client and focused QA. Small changes to the Worker route and generation client connect persistence. The production homepage markup changes only to load the persistence client. Production `wrangler.jsonc` is unchanged. Existing local pop-up readers are preserved. No commit, push, GitHub mutation or Cloudflare deployment was performed.
