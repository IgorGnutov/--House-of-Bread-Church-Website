import { createHash } from 'node:crypto';
import { COLLECTIONS, COMPONENTS, FINGERPRINT_FIELD } from './model.mjs';

// Чисті перетворення між записом схеми (src/lib/schema.mjs) і історією
// Storyblok. На Етапі 5 fromStory без змін стає завантажувачем Astro,
// тож тут немає ні мережі, ні файлової системи.

const EMPTY = (value) => value === undefined || value === null || value === '';

export const storyPath = (collection, slug) => `${COLLECTIONS[collection].folder}/${slug}`;

// Детермінований uuid: той самий запис дає ті самі _uid блоків, і
// повторний імпорт не бачить змін там, де їх немає.
export function stableUuid(seed) {
  const h = createHash('sha256').update(seed).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
}

const stable = (value) => {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    return `{${Object.keys(value).filter((k) => value[k] !== undefined).sort()
      .map((k) => `${JSON.stringify(k)}:${stable(value[k])}`).join(',')}}`;
  }
  return JSON.stringify(value);
};

// Відбиток даних (а не сирого JSON історії): ключі, які Storyblok дописує
// сам (alt: null у asset, meta_data), і назва історії правкою не є.
export const fingerprint = (value) => createHash('sha256').update(stable(value)).digest('hex');

function variantFor(variants, data, where) {
  const name = variants.find((v) =>
    Object.entries(COMPONENTS[v].fixed ?? {}).every(([key, value]) => data?.[key] === value));
  if (!name) throw new Error(`${where}: жоден тип (${variants.join(', ')}) не підходить до запису`);
  return name;
}

function storyName(collection, slug, data) {
  const entry = COLLECTIONS[collection];
  if (entry.name) return entry.name;
  const label = data.title?.uk ?? data.name?.uk ?? (typeof data.name === 'string' ? data.name : '');
  return label.trim() || slug;
}

// ---- файли → Storyblok

function assetValue(src, resolve) {
  if (EMPTY(src)) return { id: null, filename: '', fieldtype: 'asset' };
  if (/^https?:\/\//.test(src)) return { id: null, filename: src, fieldtype: 'asset', is_external_url: true };
  const found = resolve(src);
  if (!found) throw new Error(`toStory: «${src}» ще не завантажено в медіатеку`);
  return { id: found.id, filename: found.filename, fieldtype: 'asset', is_external_url: false };
}

function writeScalar(kind, value, ctx) {
  switch (kind) {
    case 'text': case 'textarea': case 'option': return value ?? '';
    case 'number': return EMPTY(value) ? '' : String(value);
    case 'boolean': return value === true;
    case 'image': return assetValue(value, ctx.asset);
    default: throw new Error(`невідомий тип поля: ${kind}`);
  }
}

function writeBlok(name, data, ctx, path) {
  const blok = { component: name, _uid: stableUuid(`${ctx.seed}#${path}`) };
  for (const [key, field] of Object.entries(COMPONENTS[name].fields)) {
    const value = data[key];
    const at = path ? `${path}.${key}` : key;
    if (field.kind === 'pair') {
      blok[`${key}_uk`] = writeScalar(field.item, value?.uk, ctx);
      blok[`${key}_en`] = writeScalar(field.item, value?.en, ctx);
    } else if (field.kind === 'group') {
      blok[key] = value == null ? [] : [writeBlok(field.component, value, ctx, at)];
    } else if (field.kind === 'list') {
      blok[key] = (value ?? []).map((item, i) => (field.unwrap
        ? writeBlok(field.components[0], { [field.unwrap]: item }, ctx, `${at}.${i}`)
        : writeBlok(variantFor(field.components, item, at), item, ctx, `${at}.${i}`)));
    } else {
      blok[key] = writeScalar(field.kind, value, ctx);
    }
  }
  return blok;
}

export function toStory(collection, slug, data, { asset = () => undefined } = {}) {
  const entry = COLLECTIONS[collection];
  const component = variantFor(entry.variants, data, `${collection}/${slug}`);
  const content = writeBlok(component, data, { asset, seed: `${collection}/${slug}` }, '');
  const story = { name: storyName(collection, slug, data), slug, content };
  // Відбиток рахується тією ж функцією, що перевіряє історію перед
  // оновленням (scripts/cms/sync.mjs): з даних, які ця історія дасть.
  content[FINGERPRINT_FIELD] = fingerprint(fromStory(collection, story));
  return story;
}

// ---- Storyblok → дані

function readScalar(kind, value, ctx) {
  switch (kind) {
    case 'text': case 'textarea': case 'option': return typeof value === 'string' ? value : '';
    case 'number':
      if (typeof value === 'number') return value;
      if (EMPTY(value)) return '';
      // Нечислове значення лишається як є: схема назве поле, а не мовчки 0.
      return typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value)) ? Number(value) : value;
    case 'boolean': return value === true;
    case 'image': return value?.filename ? ctx.assetPath(value) : '';
    default: throw new Error(`невідомий тип поля: ${kind}`);
  }
}

function readBlok(blok, ctx) {
  const def = COMPONENTS[blok?.component];
  if (!def) throw new Error(`невідомий компонент «${blok?.component}»`);
  const data = { ...(def.fixed ?? {}) };
  for (const [key, field] of Object.entries(def.fields)) {
    if (field.kind === 'pair') {
      const uk = readScalar(field.item, blok[`${key}_uk`], ctx);
      const en = readScalar(field.item, blok[`${key}_en`], ctx);
      // Обидва порожні — «поля немає». Одне порожнє — лишається порожнім:
      // схема завалить збірку, а не покаже українське на англійській.
      if (EMPTY(uk) && EMPTY(en) && (field.nullable || field.optional)) {
        if (field.nullable) data[key] = null;
      } else {
        data[key] = { uk, en };
      }
    } else if (field.kind === 'group') {
      const bloks = Array.isArray(blok[key]) ? blok[key] : [];
      if (bloks.length === 0) {
        if (field.nullable) data[key] = null;
        // optional — ключа немає; обовʼязковий — теж немає, і схема скаже «Required».
      } else {
        // Два блоки там, де дозволено один, — масив: схема відкине, а не
        // мовчки візьме перший.
        data[key] = bloks.length === 1 ? readBlok(bloks[0], ctx) : bloks.map((b) => readBlok(b, ctx));
      }
    } else if (field.kind === 'list') {
      const bloks = Array.isArray(blok[key]) ? blok[key] : [];
      data[key] = bloks.map((b) => (field.unwrap ? readBlok(b, ctx)[field.unwrap] : readBlok(b, ctx)));
    } else {
      const value = readScalar(field.kind, blok[key], ctx);
      if (EMPTY(value) && field.nullable) data[key] = null;
      else if (!(EMPTY(value) && field.optional)) data[key] = value;
    }
  }
  return data;
}

export function fromStory(collection, story, { assetPath = (asset) => asset.filename } = {}) {
  const entry = COLLECTIONS[collection];
  const component = story.content?.component;
  if (!entry.variants.includes(component)) {
    throw new Error(`${story.full_slug ?? story.slug}: тип «${component}» не належить колекції ${collection} (${entry.variants.join(', ')})`);
  }
  const data = readBlok(story.content, { assetPath });
  return entry.kind === 'collection' ? { slug: story.slug, ...data } : data;
}

// Схема дозволяє в pages.*.body і відсутність ключа, і null, а Storyblok їх
// не розрізняє. Для порівняння «немає» ≡ null (Спека 3).
export function canonical(collection, data) {
  return fillNulls(variantFor(COLLECTIONS[collection].variants, data, collection), data);
}

function fillNulls(name, data) {
  const out = { ...data };
  for (const [key, field] of Object.entries(COMPONENTS[name].fields)) {
    const value = out[key];
    if (value === undefined) {
      if (field.optional && field.nullable) out[key] = null;
    } else if (field.kind === 'group' && value !== null) {
      out[key] = fillNulls(field.component, value);
    } else if (field.kind === 'list' && !field.unwrap) {
      out[key] = value.map((item) => fillNulls(variantFor(field.components, item, key), item));
    }
  }
  return out;
}
