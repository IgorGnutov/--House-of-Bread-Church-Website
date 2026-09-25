import { hmacHex, safeEqual } from './access.mjs';

// Storyblok → GitHub Actions (рішення 14). Тіло вебхука Storyblok задати
// не можна, а GitHub чекає свій формат і токен — стенд перекладає одне в
// інше. Підпис — HMAC-SHA1 сирого тіла секретом вебхука (заголовок
// webhook-signature): без нього будь-хто міг би ганяти збірки.
export const PUBLISH_HOOK_PATH = 'api/storyblok-publish';
const REBUILD = new Set(['published', 'unpublished', 'deleted', 'moved']);
const REQUIRED = ['STORYBLOK_WEBHOOK_SECRET', 'GITHUB_DISPATCH_TOKEN', 'GITHUB_REPOSITORY'];

const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

export async function handlePublishHook({ body, signature, env, fetch = globalThis.fetch }) {
  const missing = REQUIRED.filter((key) => !env[key]);
  if (missing.length > 0) return json(500, { error: `на стенді не задано ${missing.join(', ')}` });
  if (!safeEqual(signature ?? '', await hmacHex('SHA-1', env.STORYBLOK_WEBHOOK_SECRET, body))) {
    return json(401, { error: 'invalid signature' });
  }
  let event;
  try {
    event = JSON.parse(body);
  } catch {
    return json(400, { error: 'invalid json' });
  }
  if (!REBUILD.has(event.action)) return json(202, { ignored: event.action ?? null });
  const workflow = env.GITHUB_WORKFLOW || 'deploy.yml';
  const res = await fetch(`https://api.github.com/repos/${env.GITHUB_REPOSITORY}/actions/workflows/${workflow}/dispatches`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.GITHUB_DISPATCH_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'dim-hliba-preview',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ ref: env.GITHUB_REF || 'main' }),
  });
  if (!res.ok) return json(502, { error: `GitHub ${res.status}: ${(await res.text()).slice(0, 200)}` });
  return json(202, { dispatched: event.action, story: event.full_slug ?? null });
}
