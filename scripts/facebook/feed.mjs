import { existsSync, mkdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { schemas } from '../../src/lib/schema.mjs';

// npm run fb:pull (Спека 5): 12 останніх постів сторінки Facebook → по
// JSON на пост у src/content/facebook/ і картинки в public/uploads/facebook/.
// Посилання fbcdn підписані (oe=) і з часом перестають працювати, тому
// картинки лежать поруч із сайтом.

// Meta вимикає версію Graph API приблизно через 2 роки — тоді цю константу
// підіймають вручну.
export const GRAPH_VERSION = 'v23.0';
export const GRAPH_URL = 'https://graph.facebook.com';
export const POST_LIMIT = 12;
export const FB_CONTENT = 'facebook';
export const FB_UPLOADS = 'uploads/facebook';
const FIELDS = 'message,created_time,permalink_url,full_picture,attachments{media_type,media,subattachments{media}}';

export const EXIT = { ok: 0, failed: 1, rejected: 2 };

export function postsUrl(graphUrl, pageId, token) {
  const url = new URL(`${graphUrl.replace(/\/+$/, '')}/${GRAPH_VERSION}/${encodeURIComponent(pageId)}/posts`);
  url.searchParams.set('limit', String(POST_LIMIT));
  url.searchParams.set('fields', FIELDS);
  url.searchParams.set('access_token', token);
  return url.href;
}

// paging.next і тексти помилок Graph API містять токен — жодне
// повідомлення не виходить у лог CI, не пройшовши цю заміну.
export function redactor(token) {
  const forms = token ? [...new Set([token, encodeURIComponent(token)])] : [];
  return (message) => forms.reduce((out, form) => out.split(form).join('<TOKEN>'), String(message));
}

// Розміри медіа: у фото й відео — media.image, в альбомі — перша
// підкартинка (саме її Facebook віддає як full_picture).
function mediaSize(attachment) {
  const image = attachment?.media?.image ?? attachment?.subattachments?.data?.[0]?.media?.image;
  return image?.width > 0 && image?.height > 0 ? { width: image.width, height: image.height } : null;
}

// Перевірено на iPhone 2026-09-30: застосунок Facebook, куди телефон
// перекидає будь-яке посилання facebook.com, не відкриває permalink_url
// звичайного поста (/<число>/posts/<пост>; число там — не id сторінки) —
// «This isn't available», хоча пост публічний. permalink.php з id сторінки
// й поста відкривається і в застосунку, і в браузері. Відео (/videos/) і
// reels (/reel/) відкриваються як є.
const POST_PERMALINK = /^https:\/\/www\.facebook\.com\/[^/?#]+\/posts\/\d+\/?$/;

function postUrl(post) {
  const ids = typeof post.id === 'string' ? post.id.match(/^(\d+)_(\d+)$/) : null;
  if (!ids || !POST_PERMALINK.test(post.permalink_url ?? '')) return post.permalink_url;
  return `https://www.facebook.com/permalink.php?story_fbid=${ids[2]}&id=${ids[1]}`;
}

// Сирий пост Graph API → запис колекції. Без розмірів шаблон не знає, як
// поставити картинку в рамку, тож такий пост — без картинки.
export function toRecord(post) {
  const attachment = post.attachments?.data?.[0];
  const size = mediaSize(attachment);
  return {
    id: post.id,
    date: post.created_time,
    url: postUrl(post),
    text: post.message ?? '',
    video: /video/i.test(attachment?.media_type ?? ''),
    image: post.full_picture && size ? { src: `${FB_UPLOADS}/${post.id}.jpg`, ...size } : null,
  };
}

const describe = (issues) => issues.map((i) => `${i.path.join('.') || '(запис)'}: ${i.message}`).join('; ');

async function download(url, fetch) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

// Ціль замінюється зібраною поруч текою лише наприкінці: при помилці
// старий знімок лишається цілим, а застарілі пости не переживають прогону.
function swap(stage, target) {
  rmSync(target, { recursive: true, force: true });
  renameSync(stage, target);
}

export async function runFeedPull({
  pageId, token, graphUrl = GRAPH_URL, contentDir, publicDir,
  fetch = globalThis.fetch, log = console.log, error = console.error,
}) {
  const redact = redactor(token);
  const say = (message) => log(redact(message));
  const target = { content: join(contentDir, FB_CONTENT), images: join(publicDir, ...FB_UPLOADS.split('/')) };
  // Сусідні теки: rename у межах однієї теки, а збірка їх не читає.
  const stage = { content: `${target.content}.new`, images: `${target.images}.new` };
  const clean = () => Object.values(stage).forEach((dir) => rmSync(dir, { recursive: true, force: true }));
  try {
    const missing = [!pageId && 'FACEBOOK_PAGE_ID', !token && 'FACEBOOK_PAGE_TOKEN'].filter(Boolean);
    if (missing.length > 0) throw new Error(`не задано ${missing.join(', ')} (у CI — змінна й секрет репозиторію, локально — .env)`);

    const res = await fetch(postsUrl(graphUrl, pageId, token));
    const body = await res.json().catch(() => null);
    if (!res.ok) throw new Error(`Graph API ${res.status}: ${body?.error?.message ?? 'без опису помилки'}`);
    if (!Array.isArray(body?.data)) throw new Error('Graph API: у відповіді немає списку постів (data)');

    // Залишки перерваного прогону не мають потрапити в новий знімок.
    clean();
    mkdirSync(stage.content, { recursive: true });
    mkdirSync(stage.images, { recursive: true });

    const seen = new Set();
    let rejected = 0;
    let images = 0;
    for (const raw of body.data.slice(0, POST_LIMIT)) {
      const record = toRecord(raw ?? {});
      // Та сама схема, що в збірці: невалідний пост не доходить до astro
      // build. Перевірка — до завантаження, бо id стає імʼям файлу.
      const result = schemas.facebook.safeParse(record);
      if (!result.success || seen.has(record.id)) {
        rejected++;
        say(`! пост ${record.id ?? '(без id)'} відкинуто: ${result.success ? 'id повторюється' : describe(result.error.issues)}`);
        continue;
      }
      seen.add(record.id);
      if (record.image) {
        try {
          writeFileSync(join(stage.images, `${record.id}.jpg`), await download(raw.full_picture, fetch));
          images++;
        } catch (e) {
          say(`! пост ${record.id}: картинку не завантажено (${e.message}) — картка буде без картинки`);
          record.image = null;
        }
      }
      writeFileSync(join(stage.content, `${record.id}.json`), `${JSON.stringify(record, null, 2)}\n`);
    }

    swap(stage.images, target.images);
    swap(stage.content, target.content);
    say(`Стрічка Facebook: записано постів ${seen.size}, картинок ${images}${rejected > 0 ? `, відкинуто ${rejected}` : ''}.`);
    if (rejected > 0) say('Частину постів відкинула схема — схоже, формат відповіді Facebook змінився.');
    return { exitCode: rejected > 0 ? EXIT.rejected : EXIT.ok };
  } catch (e) {
    error(redact(`✗ ${e.message}${e.cause?.message ? ` (${e.cause.message})` : ''}`));
    error(redact(existsSync(target.content) ? 'Знімок стрічки не змінено.' : 'Знімка стрічки немає — сайт покаже ручні картки новин.'));
    return { exitCode: EXIT.failed };
  } finally {
    clean();
  }
}
