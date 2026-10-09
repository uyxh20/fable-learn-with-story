// Private story snapshots. Generation remains disabled; local R2 exercises this contract.
export const MAX_STORY_BYTES = 1024 * 1024;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const cookieName = 'fable-owner';

async function digest(value) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, '0')).join('');
}

export function validateStory(data) {
  if (!data || !uuid.test(data.id || '') || !['en', 'fr', 'da', 'zh'].includes(data.lang) ||
      !['partial', 'complete'].includes(data.status)) throw new Error('invalid_story');
  for (const [key, max] of [['title', 200], ['concept', 2000], ['setting', 100], ['markdown', 200000]]) {
    if (typeof data[key] !== 'string' || !data[key].trim() || data[key].length > max) throw new Error('invalid_story');
  }
  // Keep images self-contained or in the curated asset library; never fetch arbitrary URLs.
  const image = data.image || '/art/cover-1600.webp';
  if (typeof image !== 'string' || !(/^\/art\/[a-zA-Z0-9_-]+\.(png|webp)$/.test(image) ||
      /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(image))) throw new Error('invalid_image');
  return { id: data.id, title: data.title.trim(), concept: data.concept.trim(), setting: data.setting.trim(),
    lang: data.lang, markdown: data.markdown, image, status: data.status };
}

async function readBody(request) {
  if (!request.headers.get('Content-Type')?.toLowerCase().startsWith('application/json')) throw new Error('invalid_content_type');
  if (Number(request.headers.get('Content-Length')) > MAX_STORY_BYTES) throw new Error('story_too_large');
  const reader = request.body?.getReader();
  if (!reader) throw new Error('invalid_story');
  const chunks = []; let size = 0;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_STORY_BYTES) { await reader.cancel(); throw new Error('story_too_large'); }
    chunks.push(value);
  }
  const body = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.byteLength; }
  try { return JSON.parse(new TextDecoder().decode(body)); } catch { throw new Error('invalid_json'); }
}

// A completed job must await this write before reporting success. CAS prevents stale
// partial responses and simultaneous retries from replacing a completed story.
export async function saveStory(bucket, owner, story) {
  const value = validateStory(story);
  const key = `stories/${await digest(owner)}/${value.id}.json`;
  const contentHash = await digest(JSON.stringify(value));
  for (let attempt = 0; attempt < 3; attempt++) {
    const existing = await bucket.get(key);
    const previous = existing ? await existing.json() : null;
    if (previous?.content_hash === contentHash || (previous?.status === 'complete' && value.status === 'partial')) return previous;
    if (previous?.status === 'complete') throw new Error('story_already_complete');
    const now = new Date().toISOString();
    const saved = { ...value, created_at: previous?.created_at || now, updated_at: now, content_hash: contentHash };
    const result = await bucket.put(key, JSON.stringify(saved), {
      httpMetadata: { contentType: 'application/json' },
      onlyIf: existing ? { etagMatches: existing.etag } : { etagDoesNotMatch: '*' },
    });
    if (result) return saved;
  }
  throw new Error('save_conflict');
}

export async function storyResponse(request, env, json) {
  const url = new URL(request.url);
  // No public write API until identity, quotas and generation are ready.
  if (!env.STORIES || env.LOCAL_STORY_WRITES !== 'true' || !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) {
    return json({ error: 'story_storage_unavailable' }, 503);
  }
  const match = url.pathname.match(/^\/api\/stories\/([^/]+)$/);
  const cookie = request.headers.get('Cookie')?.split(';').map(x => x.trim()).find(x => x.startsWith(`${cookieName}=`))?.slice(cookieName.length + 1);
  const owner = /^[0-9a-f]{64}$/.test(cookie || '') ? cookie : null;
  if (request.method === 'GET' && match) {
    if (!owner || !uuid.test(match[1])) return json({ error: 'story_not_found' }, 404);
    try {
      const object = await env.STORIES.get(`stories/${await digest(owner)}/${match[1]}.json`);
      if (!object) return json({ error: 'story_not_found' }, 404);
      const { content_hash, ...story } = await object.json();
      return json({ story });
    } catch { return json({ error: 'story_storage_unavailable' }, 503); }
  }
  if (request.method !== 'POST' || url.pathname !== '/api/stories') return json({ error: 'method_not_allowed' }, 405);
  if (request.headers.get('Origin') !== url.origin) return json({ error: 'origin_not_allowed' }, 403);
  try {
    const data = await readBody(request);
    const session = owner || Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2, '0')).join('');
    const saved = await saveStory(env.STORIES, session, data);
    const response = json({ id: saved.id, status: saved.status, saved_at: saved.updated_at, url: `/api/stories/${saved.id}` });
    if (!owner) response.headers.set('Set-Cookie', `${cookieName}=${session}; HttpOnly; SameSite=Strict; Path=/api/stories; Max-Age=31536000${url.protocol === 'https:' ? '; Secure' : ''}`);
    return response;
  } catch (error) {
    const codes = { invalid_story: 400, invalid_image: 400, invalid_json: 400, invalid_content_type: 415, story_too_large: 413, story_already_complete: 409, save_conflict: 409 };
    return json({ error: codes[error.message] ? error.message : 'story_storage_unavailable' }, codes[error.message] || 503);
  }
}
