import { defineMiddleware } from 'astro:middleware';
import { validateContent } from '../lib/content-rules.mjs';
import { makeSite } from '../lib/site.mjs';
import { deliveryUrl, fetchStories } from '../lib/storyblok/delivery.mjs';
import { storiesToEntries } from '../lib/storyblok/entries.mjs';
import { editorAccess } from './access.mjs';
import { previewEnv } from './env.mjs';
import { deniedPage, problemsPage } from './pages.mjs';
import { storyRedirect } from './routes.mjs';

const html = (body, status) => new Response(body, { status, headers: { 'content-type': 'text/html; charset=utf-8' } });

// Кожна відповідь стенду — noindex заголовком (Спека 3, ризики): робот
// бачить його і на 403/500, де <meta robots> може не бути. no-store — щоб
// ні Cloudflare, ні браузер не показали редактору вчорашню чернетку.
// Заголовки відповіді next() можуть бути незмінні — тому копія.
function finish(response, access) {
  const out = new Response(response.body, response);
  out.headers.set('X-Robots-Tag', 'noindex');
  out.headers.set('Cache-Control', 'no-store');
  if (access?.setCookie) out.headers.append('Set-Cookie', access.setCookie);
  return out;
}

export const onRequest = defineMiddleware(async (context, next) => {
  const env = previewEnv(context.locals);
  const access = await editorAccess({
    url: context.url,
    cookieHeader: context.request.headers.get('cookie'),
    spaceId: env.STORYBLOK_SPACE_ID,
    previewToken: env.STORYBLOK_PREVIEW_TOKEN,
    now: Date.now(),
  });
  if (!access.ok) return finish(html(deniedPage(), 403));

  const target = storyRedirect(context.url, import.meta.env.BASE_URL);
  if (target) return finish(new Response(null, { status: 302, headers: { location: target } }), access);

  // Чернетка на кожен запит: ~70 історій — один запит CDN (per_page=100).
  const stories = await fetchStories({ token: env.STORYBLOK_PREVIEW_TOKEN, baseUrl: deliveryUrl(env), version: 'draft' });
  const { entries, errors, editables } = storiesToEntries(stories);
  const problems = [...errors, ...validateContent(entries)];
  if (problems.length > 0) return finish(html(problemsPage(problems), 500), access);

  context.locals.site = makeSite(entries, editables);
  context.locals.preview = true;
  return finish(await next(), access);
});
