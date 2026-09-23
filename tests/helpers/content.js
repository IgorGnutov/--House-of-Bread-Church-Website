import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const contentDir = (name) =>
  fileURLToPath(new URL(`../../src/content/${name}`, import.meta.url));

// __probe* — тимчасові записи тесту схем; до «справжнього» контенту не входять.
export const readCollection = (name) =>
  readdirSync(contentDir(name))
    .filter((f) => f.endsWith('.json') && !f.startsWith('__probe'))
    .map((f) => ({ file: f, data: JSON.parse(readFileSync(`${contentDir(name)}/${f}`, 'utf8')) }));

export const readSingleton = (name) =>
  JSON.parse(readFileSync(contentDir(`singletons/${name}.json`), 'utf8')).main;

export const readPages = () =>
  JSON.parse(readFileSync(contentDir('singletons/pages.json'), 'utf8'));

// Рекурсивно знаходить кожну пару {uk, en} — щоб перевіряти повноту
// перекладу, не перелічуючи поля кожної колекції окремо.
export function* localizedPairs(value, path = '') {
  if (value === null || typeof value !== 'object') return;
  if (typeof value.uk === 'string' && 'en' in value) {
    yield [path, value];
    return;
  }
  for (const [k, v] of Object.entries(value)) yield* localizedPairs(v, `${path}.${k}`);
}
