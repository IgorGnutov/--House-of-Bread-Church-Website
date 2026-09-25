import { createHash } from 'node:crypto';
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, extname, join, relative, sep } from 'node:path';
import { publicUrl } from './sync.mjs';

// Спека 3: картинки з медіатеки завантажуються на збірці й лежать поруч із
// сайтом — браузер відвідувача не звертається до Storyblok. Будь-яка адреса
// файлів Storyblok стає локальним файлом: і в полі-картинці, і вставлена
// редактором як «зовнішня», і в полі-посиланні.
export const CMS_UPLOADS = 'uploads/cms';
const ASSET_HOST = /^(?:https?:)?\/\/(?:s3\.amazonaws\.com\/)?a(?:-[a-z]{2})?\.storyblok\.com\//i;

export const isStoryblokAsset = (value) => typeof value === 'string' && ASSET_HOST.test(value);

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

// Імʼя детерміноване (та сама адреса — той самий файл на кожній збірці) і
// безпечне для URL. Storyblok імʼя вже параметризує, але «Фото 1.JPG» лишає
// кирилицю й пробіли.
export function localAssetName(url) {
  const href = publicUrl(url);
  const file = decodeURIComponent(new URL(href).pathname.split('/').pop() || '');
  const ext = extname(file).toLowerCase().replace(/[^.a-z0-9]/g, '');
  const stem = file.slice(0, file.length - extname(file).length).toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'file';
  return `${CMS_UPLOADS}/${sha256(href).slice(0, 12)}-${stem}${ext}`;
}

export async function downloadAsset(url, fetch = globalThis.fetch) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`не вдалося завантажити ${url}: ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

function filesUnder(dir) {
  try {
    return readdirSync(dir, { withFileTypes: true })
      .flatMap((e) => (e.isDirectory() ? filesUnder(join(dir, e.name)) : [join(dir, e.name)]));
  } catch {
    return [];
  }
}

function mapStrings(value, fn) {
  if (typeof value === 'string') return fn(value);
  if (Array.isArray(value)) return value.map((v) => mapStrings(v, fn));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, mapStrings(v, fn)]));
  return value;
}

// Файл, байт у байт такий самий, як наявний у public/uploads (картинки,
// залиті імпортом Етапу 4), отримує той самий шлях. Тоді збірка зі Storyblok
// не відрізняється від збірки з файлів, і public/ не росте дублікатами.
// uploads/cms очищається щоразу: видалена з контенту картинка не лишиться в dist.
// Файл, стягнутий туди минулого разу, повертається під своїм шляхом: знімок
// src/content уже веде на нього, і повторний pull (чи імпорт цього знімка й
// pull назад) дає ті самі дані, а не нову копію під іншим імʼям.
export async function localizeAssets(entries, { publicDir, download, isAsset = isStoryblokAsset }) {
  const cmsDir = join(publicDir, ...CMS_UPLOADS.split('/'));
  const toRel = (file) => relative(publicDir, file).split(sep).join('/');
  const previous = new Map(filesUnder(cmsDir).map((file) => [sha256(readFileSync(file)), toRel(file)]));
  rmSync(cmsDir, { recursive: true, force: true });
  const known = new Map();
  for (const file of filesUnder(join(publicDir, 'uploads'))) known.set(sha256(readFileSync(file)), toRel(file));
  const urls = new Set();
  for (const e of entries) mapStrings(e.data, (s) => (isAsset(s) && urls.add(s), s));
  const local = new Map();
  let downloaded = 0;
  let reused = 0;
  for (const url of [...urls].sort()) {
    const bytes = await download(publicUrl(url));
    const hash = sha256(bytes);
    if (known.has(hash)) {
      local.set(url, known.get(hash));
      reused++;
      continue;
    }
    const rel = previous.get(hash) ?? localAssetName(url);
    mkdirSync(dirname(join(publicDir, rel)), { recursive: true });
    writeFileSync(join(publicDir, rel), bytes);
    known.set(hash, rel);
    local.set(url, rel);
    downloaded++;
  }
  return { entries: entries.map((e) => ({ ...e, data: mapStrings(e.data, (s) => local.get(s) ?? s) })), downloaded, reused };
}
