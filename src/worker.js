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
      return json({ status: 'ok', generation_enabled: false });
    }
    // Deliberately fail closed. Supplying credentials alone must not enable billed requests.
    if (path === '/api' || path.startsWith('/api/')) {
      return json({ error: 'generation_unavailable', detail: 'New story generation is not configured yet. Please explore the sample book.' }, 503);
    }
    if (!['GET', 'HEAD'].includes(request.method)) return json({ error: 'method_not_allowed' }, 405);
    const upstream = await env.ASSETS.fetch(request);
    const response = new Response(upstream.body, upstream);
    for (const [name, value] of Object.entries(securityHeaders)) response.headers.set(name, value);
    return response;
  },
};
