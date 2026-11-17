import { docFromText } from '../src/lib/richtext.mjs';
import { mapRichPairs } from '../src/lib/storyblok/walk.mjs';
import { readContent, writeContent } from './cms/content.mjs';

// ТИМЧАСОВО: одноразова міграція файлів контенту — рядок у richtext-полі стає документом.
// Видаляється в Задачі 12, коли міграція виконана для всіх полів.
// Використання: node scripts/migrate-richtext.mjs [тека, типово src/content]
const dir = process.argv[2] ?? 'src/content';
const toDoc = (value) => (typeof value === 'string' ? docFromText(value) : value);

const entries = readContent(dir).map((e) => ({
  ...e,
  data: mapRichPairs(e.collection, e.data, (pair) => ({ ...pair, uk: toDoc(pair.uk), en: toDoc(pair.en) })),
}));
writeContent(dir, entries);
console.log(`Записів: ${entries.length}.`);
