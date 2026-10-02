# Fable (Learn with Story)

A cinematic, illustrated storybook for learning complex ideas through fables. Includes sample stories, English/Chinese/Danish/French content, light and dark themes, and a scrolling reader.

## Current release

Cloudflare Workers hosts the existing Fable Cinema interface and sample artwork. **New story and image generation are disabled**, both in the UI and at every API route. No AI provider requests can be made by this Worker. API URLs, API keys, and model names are intentionally empty.

This is an isolated public export of the app. The original Google Cloud backend, private project history, operational notes, account identifiers, logs, and credentials are excluded. That backend has not been ported to Workers. Adding keys alone will not enable generation: the provider integration and its public-use controls are a follow-up once the providers are selected.

## Local development

Requires Node.js 22 or newer.

```sh
npm ci
npm run dev
```

Open the local URL printed by Wrangler. `npm run check` runs API tests, builds the frontend, and validates the Worker bundle. Frontend JSX is compiled during the build, and React is bundled locally; no runtime Babel or third-party script CDN is used.

## Deploy

```sh
npx wrangler login
npm run deploy
```

The `dist/` directory is the only public asset directory. Cloudflare credentials stay outside this repository. Wrangler uses the authenticated account and deploys the Worker named in `wrangler.jsonc`.

The optional GitHub Actions check workflow is provided at `docs/github-actions-check.yml`. To activate it, place it at `.github/workflows/check.yml` using a GitHub login with workflow permission. Automated deployments are not configured.

## Later AI setup

`.dev.vars.example` lists empty placeholders for `LLM_API_URL`, `LLM_API_KEY`, `LLM_MODEL`, `IMAGE_API_URL`, `IMAGE_API_KEY`, and `IMAGE_MODEL`. Copy it to ignored `.dev.vars` for local secrets when needed. Use Wrangler secrets for production API keys; never put keys in browser code, Git, or plain-text Wrangler variables.

Before enabling generation, implement the selected providers on the server, input limits, bot protection, per-user/network quotas, idempotency, bounded jobs/timeouts, and provider spending caps. Keep the current fail-closed behavior until those are tested.

## Privacy and security

The preview makes no AI calls and has no analytics. UI preferences use browser local storage. Fonts are loaded from Google Fonts. Security headers restrict scripts and connections to this site's origin. Only the app sources and curated sample illustrations are tracked; local secrets and generated build output are ignored.

Public visibility does not grant an open-source license. No license has been selected for the original application or artwork. React's license notice is retained in the built bundle.
