import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { PAGE_IDS } from '../../src/lib/schema.mjs';
import { storyPath, toStory } from '../../src/lib/storyblok/convert.mjs';
import { COLLECTIONS } from '../../src/lib/storyblok/model.mjs';

const readJson = (file) => JSON.parse(readFileSync(file, 'utf8'));

// Ті самі файли, що читає збірка (content.config.ts): запис колекції —
// файл у теці, сторінка — ключ pages.json, одиночка — ключ main.
export function readContent(dir) {
  const entries = [];
  for (const [collection, entry] of Object.entries(COLLECTIONS)) {
    if (entry.kind === 'collection') {
      const folder = join(dir, collection);
      // Git не зберігає порожніх тек: колекція без записів — це відсутня тека.
      if (!existsSync(folder)) continue;
      for (const file of readdirSync(folder).filter((f) => f.endsWith('.json')).sort()) {
        const data = readJson(join(folder, file));
        entries.push({ collection, slug: data.slug, source: `${collection}/${file}`, data });
      }
    } else if (entry.kind === 'pages') {
      for (const [id, data] of Object.entries(readJson(join(dir, 'singletons', 'pages.json')))) {
        entries.push({ collection, slug: id, source: `singletons/pages.json#${id}`, data });
      }
    } else {
      const data = readJson(join(dir, 'singletons', `${collection}.json`)).main;
      entries.push({ collection, slug: entry.slug, source: `singletons/${collection}.json`, data });
    }
  }
  return entries.map((e) => ({ ...e, path: storyPath(e.collection, e.slug) }));
}

// Правила — у src/lib/content-rules.mjs: їх перевіряє й прев'ю-стенд, де fs немає.
export { validateContent } from '../../src/lib/content-rules.mjs';

// Відносні шляхи з полів-картинок і файлів. Збираються тим самим toStory,
// яким імпорт їх записуватиме, — окремого обходу моделі немає.
export function assetRefs(entries) {
  const refs = new Set();
  const record = (src) => {
    refs.add(src);
    return { id: 0, filename: src };
  };
  for (const e of entries) {
    if (e.data === undefined) continue;
    // Запис із побитим дискримінатором (type/kind) не має відповідного
    // варіанта — toStory впаде. validateContent уже назве цей запис і
    // поле, тож тут його просто пропускаємо, а не валимо весь імпорт.
    try {
      toStory(e.collection, e.slug, e.data, { asset: record });
    } catch {
      continue;
    }
  }
  return [...refs].sort();
}

// Бите посилання на файл схема не бачить (виняток у CLAUDE.md), але
// завантажити в медіатеку неіснуючий файл не можна — зупиняємося до запитів.
export function missingAssets(entries, publicDir) {
  return assetRefs(entries)
    .filter((ref) => !existsSync(join(publicDir, ref)))
    .map((ref) => `${ref}: файлу немає в public/ — на нього посилається контент`);
}

// Обернення readContent: той самий розклад файлів, що читає збірка. Теки
// колекцій створюються заново — запис, видалений чи знятий з публікації в
// Storyblok, не лишається з минулого прогону (Review Focus 3).
export function writeContent(dir, entries) {
  const json = (value) => `${JSON.stringify(value, null, 2)}\n`;
  for (const [collection, entry] of Object.entries(COLLECTIONS)) {
    if (entry.kind === 'collection') rmSync(join(dir, collection), { recursive: true, force: true });
  }
  mkdirSync(join(dir, 'singletons'), { recursive: true });
  const pages = {};
  for (const e of entries) {
    const entry = COLLECTIONS[e.collection];
    if (entry.kind === 'collection') {
      mkdirSync(join(dir, e.collection), { recursive: true });
      writeFileSync(join(dir, e.collection, `${e.slug}.json`), json(e.data));
    } else if (entry.kind === 'pages') {
      pages[e.slug] = e.data;
    } else {
      writeFileSync(join(dir, 'singletons', `${e.collection}.json`), json({ main: e.data }));
    }
  }
  // Порядок сторінок як у PAGE_IDS: diff знімка в git показує зміни, а не перестановки.
  const ordered = Object.fromEntries(Object.entries(pages).sort(([a], [b]) => PAGE_IDS.indexOf(a) - PAGE_IDS.indexOf(b)));
  writeFileSync(join(dir, 'singletons', 'pages.json'), json(ordered));
}
