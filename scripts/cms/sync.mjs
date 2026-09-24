import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { basename, extname, join } from 'node:path';
import { buildComponents, buildFolders } from '../../src/lib/storyblok/components.mjs';
import { fingerprint, fromStory, toStory } from '../../src/lib/storyblok/convert.mjs';
import { COLLECTIONS, FINGERPRINT_FIELD, FOLDERS } from '../../src/lib/storyblok/model.mjs';
import { assetRefs, missingAssets, readContent, validateContent } from './content.mjs';

// Імпорт файлів у Storyblok (Спека 3, Етап 4): план «створити / оновити /
// видалити», сухий прогін за замовчуванням, відбиток проти перезапису правок
// редактора. Ідемпотентний: повторний прогін без змін у файлах — «0 змін».

// Демо-вміст нового простору. Прибирається першим --apply; наші назви з ним
// не збігаються (tests/cms-components.test.js).
export const DEMO = { components: ['page', 'teaser', 'grid', 'feature'], stories: ['home'] };

export const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
// Storyblok «параметризує» імʼя файлу: крапки, крім останньої, стають «_».
export const storyblokName = (file) => basename(file).replace(/\.(?=.*\.)/g, '_');
// MAPI віддає адресу файлу і як s3.amazonaws.com/a.storyblok.com/…, і як
// //a.storyblok.com/… — в історію пишемо публічну https-адресу CDN.
export const publicUrl = (url) => url
  .replace(/^https?:\/\/s3\.amazonaws\.com\/a\.storyblok\.com\//, 'https://a.storyblok.com/')
  .replace(/^\/\//, 'https://');

const MIME = {
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp',
  '.gif': 'image/gif', '.svg': 'image/svg+xml',
};

// «Наше ⊆ їхнє»: API дописує до компонента id, created_at, id полів — це не
// зміна. Хибні прапорці ми не пишемо (components.mjs), тож їхня відсутність
// у відповіді теж не зміна.
function subset(want, have) {
  if (want === have) return true;
  if (want === null || typeof want !== 'object' || have === null || typeof have !== 'object') return false;
  if (Array.isArray(want)) return Array.isArray(have) && want.length === have.length && want.every((w, i) => subset(w, have[i]));
  return Object.entries(want).every(([key, value]) => subset(value, have[key]));
}

export function sameComponent(want, have) {
  const wantKeys = Object.keys(want.schema).sort().join();
  const haveKeys = Object.keys(have.schema ?? {}).sort().join();
  return want.display_name === have.display_name
    && want.is_root === Boolean(have.is_root)
    && want.is_nestable === Boolean(have.is_nestable)
    && wantKeys === haveKeys
    && subset(want.schema, have.schema);
}

const sameFolder = (want, have) => want.name === have.name
  && want.default_root === have.default_root
  && [...(have.content?.content_types ?? [])].sort().join() === [...want.content_types].sort().join();

const folderStory = (folder) => ({
  name: folder.name, slug: folder.slug, parent_id: 0, is_folder: true, default_root: folder.default_root,
  content: { content_types: folder.content_types, lock_subfolders_content_types: false },
});

const isDemoStory = (story) => DEMO.stories.includes(story.full_slug) && story.content?.component === 'page';

// Список історій приходить без content — кожну нашу читаємо окремо
// (78 запитів ≈ 26 с на 3 запити/с).
export async function readSpace(client) {
  const { components } = await client.get('/components');
  const list = await client.all('/stories', 'stories');
  const ours = new Set(Object.keys(FOLDERS));
  const folders = [];
  const stories = [];
  for (const item of list) {
    const top = item.full_slug.split('/')[0];
    const rootFolder = item.is_folder && !item.full_slug.includes('/') && ours.has(top);
    const inOurFolder = !item.is_folder && ours.has(top) && item.full_slug.includes('/');
    // Список ще не має content, тож демо-кандидата (slug «home» у корені)
    // впізнаємо лише за slug тут — за component вирішимо нижче, прочитавши
    // історію: чужа історія «home» (рішення 5) нізвідки, крім наших тек, не
    // потрапляє далі — жодних тек, жодного демо-статусу.
    const demoCandidate = !item.is_folder && DEMO.stories.includes(item.full_slug);
    if (!rootFolder && !inOurFolder && !demoCandidate) continue;
    const { story } = await client.get(`/stories/${item.id}`);
    if (rootFolder) { folders.push(story); continue; }
    if (inOurFolder) { stories.push(story); continue; }
    // Кандидат «home», але не наш демо-вміст (component !== 'page') — це не
    // наша історія й поза нашими теками: не чіпаємо її взагалі.
    if (isDemoStory(story)) stories.push(story);
  }
  const assets = await client.all('/assets', 'assets');
  return { components, folders, stories, assets };
}

// Позначка «не вдалося завантажити» в кеші хешів: недовантажений asset
// (підпис є, файлу в сховищі нема — обірваний попередній --apply) не мусить
// зупиняти імпорт — просто не кандидат на збіг.
const UNREADABLE = Symbol('unreadable-remote-asset');

// Той самий файл удруге не завантажується: збіг імені й SHA-256 вмісту.
async function resolveAssets(client, refs, publicDir, remoteAssets) {
  const byPath = new Map();
  const uploads = [];
  const warnings = [];
  const remoteHash = new Map();
  for (const ref of refs) {
    const bytes = readFileSync(join(publicDir, ref));
    const hash = sha256(bytes);
    const name = storyblokName(ref);
    let found;
    for (const asset of remoteAssets.filter((a) => basename(a.filename ?? '') === name)) {
      const url = publicUrl(asset.filename);
      if (!remoteHash.has(url)) {
        try {
          remoteHash.set(url, sha256(await client.download(url)));
        } catch {
          remoteHash.set(url, UNREADABLE);
          warnings.push(`asset «${name}» (id ${asset.id}) у Storyblok не вдалося завантажити для звірки — пропущено`);
        }
      }
      if (remoteHash.get(url) === hash) {
        found = { id: asset.id, filename: url };
        break;
      }
    }
    if (found) byPath.set(ref, found);
    else uploads.push({ action: 'upload', ref, name, bytes, contentType: MIME[extname(ref).toLowerCase()] ?? 'application/octet-stream' });
  }
  return { byPath, uploads, warnings };
}

export async function makePlan({ client, entries, publicDir, prune = false, force = false }) {
  const space = await readSpace(client);
  const plan = {
    components: [], folders: [], assets: [], stories: [], demo: [], conflicts: [], warnings: [], unchanged: 0,
    folderIds: new Map(space.folders.map((f) => [f.slug, f.id])), byPath: new Map(),
  };

  const wanted = buildComponents();
  const remoteByName = new Map(space.components.map((c) => [c.name, c]));
  for (const component of wanted) {
    const remote = remoteByName.get(component.name);
    if (!remote) plan.components.push({ action: 'create', component });
    else if (!sameComponent(component, remote)) plan.components.push({ action: 'update', id: remote.id, component });
  }
  // Вкладені — першими: тип контенту посилається на них у component_whitelist.
  plan.components.sort((a, b) => Number(a.component.is_root) - Number(b.component.is_root));
  const wantedNames = new Set(wanted.map((c) => c.name));
  for (const remote of space.components) {
    if (wantedNames.has(remote.name)) continue;
    if (DEMO.components.includes(remote.name)) plan.demo.push({ action: 'delete-component', id: remote.id, name: remote.name });
    else if (prune) plan.components.push({ action: 'delete', id: remote.id, component: remote });
    else plan.warnings.push(`компонент «${remote.name}» є в Storyblok, але не в моделі (видалить --prune)`);
  }
  for (const story of space.stories.filter(isDemoStory)) plan.demo.push({ action: 'delete-story', id: story.id, name: story.full_slug });

  const remoteFolders = new Map(space.folders.map((f) => [f.slug, f]));
  for (const folder of buildFolders()) {
    const remote = remoteFolders.get(folder.slug);
    if (!remote) plan.folders.push({ action: 'create', folder });
    else if (!sameFolder(folder, remote)) plan.folders.push({ action: 'update', id: remote.id, folder });
  }

  const { byPath, uploads, warnings: assetWarnings } = await resolveAssets(client, assetRefs(entries), publicDir, space.assets);
  plan.byPath = byPath;
  plan.assets = uploads;
  plan.warnings.push(...assetWarnings);

  // Ще не завантажений файл отримує тимчасову адресу: відбиток від неї
  // інший, тож історія з новим файлом чесно потрапляє в «оновити».
  const planAsset = (src) => byPath.get(src) ?? { id: null, filename: `pending:${src}` };
  const remoteByPath = new Map(space.stories.filter((s) => !isDemoStory(s)).map((s) => [s.full_slug, s]));
  for (const entry of entries) {
    const want = toStory(entry.collection, entry.slug, entry.data, { asset: planAsset }).content[FINGERPRINT_FIELD];
    const remote = remoteByPath.get(entry.path);
    if (!remote) {
      plan.stories.push({ action: 'create', entry });
      continue;
    }
    remoteByPath.delete(entry.path);
    let actual;
    try {
      actual = fingerprint(fromStory(entry.collection, remote));
    } catch {
      actual = 'нечитабельна';
    }
    const stored = remote.content?.[FINGERPRINT_FIELD];
    if (actual === want) {
      // Дані ті самі; лишається хіба оновити відбиток чи опублікувати.
      if (stored !== want) plan.stories.push({ action: 'update', entry, remote });
      else if (!remote.published || remote.unpublished_changes) plan.stories.push({ action: 'publish', entry, remote });
      else plan.unchanged++;
      continue;
    }
    // Відбиток не збігається з даними — історію правили після імпорту.
    const edited = stored !== actual;
    if (edited && !force) plan.conflicts.push({ entry, remote });
    else plan.stories.push({ action: 'update', entry, remote, forced: edited });
  }
  for (const remote of remoteByPath.values()) {
    if (prune) plan.stories.push({ action: 'delete', remote });
    else plan.warnings.push(`історія «${remote.full_slug}» є в Storyblok, але не у файлах (видалить --prune)`);
  }
  return plan;
}

export const countChanges = (plan) =>
  plan.components.length + plan.folders.length + plan.assets.length + plan.stories.length + plan.demo.length;

function printPlan(plan, log) {
  const sign = { create: '+', update: '~', delete: '-', upload: '↑', publish: '✓', 'delete-story': '-', 'delete-component': '-' };
  for (const d of plan.demo) log(`${sign[d.action]} демо: ${d.action === 'delete-story' ? 'історія' : 'компонент'} ${d.name}`);
  for (const c of plan.components) log(`${sign[c.action]} компонент ${c.component.name}`);
  for (const f of plan.folders) log(`${sign[f.action]} папка ${f.folder.slug}`);
  for (const a of plan.assets) log(`${sign.upload} файл ${a.ref}`);
  for (const s of plan.stories) {
    const path = s.entry?.path ?? s.remote.full_slug;
    log(`${sign[s.action]} історія ${path}${s.forced ? ' (перезапис правок у Storyblok, --force)' : ''}`);
  }
  for (const c of plan.conflicts) log(`! ${c.entry.path}: змінено в Storyblok після імпорту — не перезаписую (перезаписати: --force)`);
  for (const w of plan.warnings) log(`! ${w}`);
  const n = countChanges(plan);
  log(n === 0
    ? `0 змін (${plan.unchanged} історій збігаються з файлами).`
    : `Разом змін: ${n} — компоненти ${plan.components.length}, папки ${plan.folders.length}, файли ${plan.assets.length}, історії ${plan.stories.length}, демо ${plan.demo.length}; без змін ${plan.unchanged}.`);
}

export async function applyPlan(client, plan) {
  for (const d of plan.demo.filter((x) => x.action === 'delete-story')) await client.delete(`/stories/${d.id}`);
  for (const c of plan.components) {
    if (c.action === 'create') await client.post('/components/', { component: c.component });
    if (c.action === 'update') await client.put(`/components/${c.id}`, { component: c.component });
    if (c.action === 'delete') await client.delete(`/components/${c.id}`);
  }
  // Демо-компоненти — після демо-історії, яка на них посилається.
  for (const d of plan.demo.filter((x) => x.action === 'delete-component')) await client.delete(`/components/${d.id}`);

  const folderIds = new Map(plan.folderIds);
  for (const f of plan.folders) {
    if (f.action === 'create') {
      const { story } = await client.post('/stories/', { story: folderStory(f.folder) });
      folderIds.set(f.folder.slug, story.id);
    } else {
      await client.put(`/stories/${f.id}`, { story: folderStory(f.folder) });
    }
  }

  const byPath = new Map(plan.byPath);
  for (const a of plan.assets) {
    const asset = await client.upload(a.name, a.bytes, a.contentType);
    byPath.set(a.ref, { id: asset.id, filename: publicUrl(asset.filename) });
  }

  for (const s of plan.stories) {
    if (s.action === 'delete') {
      await client.delete(`/stories/${s.remote.id}`);
      continue;
    }
    if (s.action === 'publish') {
      await client.get(`/stories/${s.remote.id}/publish`);
      continue;
    }
    const story = {
      ...toStory(s.entry.collection, s.entry.slug, s.entry.data, { asset: (src) => byPath.get(src) }),
      parent_id: folderIds.get(COLLECTIONS[s.entry.collection].folder),
    };
    // Кожна історія публікується: Етап 5 читатиме опубліковану версію.
    if (s.action === 'create') await client.post('/stories/', { story, publish: 1 });
    else await client.put(`/stories/${s.remote.id}`, { story, publish: 1, force_update: 1 });
  }
}

export async function runImport({ client, contentDir, publicDir, apply = false, prune = false, force = false, log = console.log }) {
  // Валідація спершу і без мережі: API Storyblok обовʼязковості полів не
  // перевіряє, тож невалідні дані не мусять дійти до нього взагалі.
  const entries = readContent(contentDir);
  const errors = [...validateContent(entries), ...missingAssets(entries, publicDir)];
  if (errors.length > 0) {
    log('Контент не проходить перевірку — у Storyblok нічого не надіслано:');
    for (const error of errors) log(`  ✗ ${error}`);
    return { exitCode: 1, errors };
  }
  const plan = await makePlan({ client, entries, publicDir, prune, force });
  printPlan(plan, log);
  const exitCode = plan.conflicts.length > 0 ? 1 : 0;
  if (!apply) {
    if (countChanges(plan) > 0) log('Сухий прогін: у Storyblok нічого не змінено. Застосувати: npm run cms:import -- --apply');
    return { exitCode, plan };
  }
  await applyPlan(client, plan);
  if (countChanges(plan) > 0) log('Застосовано.');
  return { exitCode, plan };
}
