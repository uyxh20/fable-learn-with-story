import { storyResponse } from './story-store.js';
import { creationResponse, generationEnabled } from './creation-api.js';

const securityHeaders = {
  'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'X-Frame-Options': 'DENY',
  'Strict-Transport-Security': 'max-age=31536000',
};

function json(data, status = 200) {
  return Response.json(data, { status, headers: { ...securityHeaders, 'Cache-Control': 'no-store' } });
}

export default {
  async fetch(request, env) {
    const path = new URL(request.url).pathname;
    if (path === '/healthz' && ['GET', 'HEAD'].includes(request.method)) {
      return json({ status: 'ok', generation_enabled: generationEnabled(env), storage_enabled: !!(env.DB && env.STORIES) });
    }
    if (path.startsWith('/api/') && (env.DB || path === '/api/config')) {
      try { return await creationResponse(request, env, json); }
      catch { return json({ error: 'service_unavailable', detail: 'Please try again shortly.' }, 503); }
    }
    if (path === '/api/stories' || path.startsWith('/api/stories/')) return storyResponse(request, env, json);
    // Deliberately fail closed. Supplying credentials alone must not enable billed requests.
    if (path === '/api' || path.startsWith('/api/')) {
      return json({ error: 'generation_unavailable', detail: 'New story generation is not configured yet. Please explore the sample book.' }, 503);
    }
    // Static assets are normally served ahead of this Worker (run_worker_first lists only the API);
    // this path remains for local configurations that still route everything here.
    if (!['GET', 'HEAD'].includes(request.method)) return json({ error: 'method_not_allowed' }, 405);
    const upstream = await env.ASSETS.fetch(request);
    const response = new Response(upstream.body, upstream);
    for (const [name, value] of Object.entries(securityHeaders)) response.headers.set(name, value);
    return response;
  },
};
