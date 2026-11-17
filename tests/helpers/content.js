import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { isDoc, richPlain } from '../../src/lib/richtext.mjs';

export const contentDir = (name) =>
  fileURLToPath(new URL(`../../src/content/${name}`, import.meta.url));

// Пробні записи тестів живуть у тимчасовій копії контенту (helpers/build.js),
// тож тут — лише справжні дані.
// Git не зберігає порожніх тек: видалив в адмінці останній запис — у CI
// теки колекції немає зовсім. Це порожня колекція, а не помилка.
export const readCollection = (name) =>
  existsSync(contentDir(name))
    ? readdirSync(contentDir(name))
      .filter((f) => f.endsWith('.json'))
      .map((f) => ({ file: f, data: JSON.parse(readFileSync(`${contentDir(name)}/${f}`, 'utf8')) }))
    : [];

// Те саме сортування, що й у шаблонах (order, потім slug): очікування тестів
// не можуть розійтися зі сторінкою на рівних order.
export { sortedData } from '../../src/lib/collections.mjs';

export const readSingleton = (name) =>
  JSON.parse(readFileSync(contentDir(`singletons/${name}.json`), 'utf8')).main;

export const readPages = () =>
  JSON.parse(readFileSync(contentDir('singletons/pages.json'), 'utf8'));

// Рекурсивно знаходить кожну пару {uk, en} — щоб перевіряти повноту
// перекладу, не перелічуючи поля кожної колекції окремо.
export function* localizedPairs(value, path = '') {
  if (value === null || typeof value !== 'object') return;
  // Пара форматованого тексту має документи (isDoc), а не рядки.
  if ((typeof value.uk === 'string' || isDoc(value.uk)) && 'en' in value) {
    yield [path, value];
    return;
  }
  for (const [k, v] of Object.entries(value)) yield* localizedPairs(v, `${path}.${k}`);
}

// Усі `text` документа підряд — так бачить вміст `node-html-parser .text`
// (без роздільників між абзацами). Рядок лишається як є.
export function domText(value) {
  if (!isDoc(value)) return value;
  const walk = (n) => (typeof n?.text === 'string' ? n.text : (n?.content ?? []).map(walk).join(''));
  return walk(value);
}

// Простий текст для порівняння з мета-описом: richPlain для документа.
export const textOf = (value) => (isDoc(value) ? richPlain(value) : value);
