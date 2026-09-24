import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { PAGE_IDS, schemas } from '../src/lib/schema.mjs';
import { readCollection, readPages, readSingleton } from './helpers/content.js';
import { ministry } from './helpers/probes.js';

// Схема одна на трьох: збірка Astro, скрипти Storyblok (scripts/cms) і
// тести. Якщо правило живе лише в content.config.ts, імпорт у Storyblok
// пропустив би дані, які потім валять збірку.
const COLLECTIONS = ['ministries', 'churches', 'projects', 'testimonies', 'pastors', 'leader-resources'];
const SINGLETONS = ['site-settings', 'contact-info', 'donate-settings', 'homepage'];

const assertValid = (schema, data, where) => {
  const result = schema.safeParse(data);
  assert.ok(result.success, `${where}: ${JSON.stringify(result.error?.issues)}`);
};

test('кожен справжній запис проходить схему і поза Astro', () => {
  for (const collection of COLLECTIONS) {
    for (const { file, data } of readCollection(collection)) assertValid(schemas[collection], data, `${collection}/${file}`);
  }
  for (const name of SINGLETONS) assertValid(schemas[name], readSingleton(name), name);
  for (const [id, data] of Object.entries(readPages())) assertValid(schemas.pages, data, `pages.${id}`);
});

test('PAGE_IDS — рівно ті сторінки, що є в pages.json', () => {
  assert.deepEqual([...PAGE_IDS].sort(), Object.keys(readPages()).sort());
});

test('схема з plain Node ловить ті самі помилки, що й збірка', () => {
  assert.equal(schemas.ministries.safeParse(ministry('probe', { icon: 'rocket' })).success, false);
  assert.equal(schemas.ministries.safeParse(ministry('probe')).success, true);
});

test('content.config.ts не тримає власних правил — лише завантажувачі', () => {
  const source = readFileSync(fileURLToPath(new URL('../src/content.config.ts', import.meta.url)), 'utf8');
  assert.doesNotMatch(source, /\bz\./, 'правило схеми в content.config.ts: перенести в src/lib/schema.mjs');
});
