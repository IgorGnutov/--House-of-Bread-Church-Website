import { docFromText } from '../src/lib/richtext.mjs';
import { mapRichPairs } from '../src/lib/storyblok/walk.mjs';
import { readContent, writeContent } from './cms/content.mjs';

// ТИМЧАСОВО: одноразова міграція файлів контенту — рядок у richtext-полі стає документом.
// Видаляється в Задачі 12, коли міграція виконана для всіх полів.
// Використання: node scripts/migrate-richtext.mjs [тека, типово src/content]
const dir = process.argv[2] ?? 'src/content';
const toDoc = (value) => (typeof value === 'string' ? docFromText(value) : value);

// Адреси кнопок (Задача 9): нового ключа в файлі немає — додається null («як зараз»).
// ??= не чіпає вже заповнене, тож повторний запуск нічого не міняє.
function addButtonUrls({ collection, data }) {
  if (collection === 'ministries') data.ctaUrl ??= null;
  if (collection === 'churches') data.directionsUrl ??= null;
  if (collection === 'projects') data.ctaUrl ??= null;
  if (collection === 'pages' && data.help) data.help.btnUrl ??= null;
  if (collection === 'homepage') {
    data.cta.liveUrl ??= null;
    for (const key of ['watchUrl', 'contactsUrl', 'donateUrl']) data.hero[key] ??= null;
    for (const item of data.news.items) item.url ??= null;
    for (const key of ['testimonies', 'ministries', 'pastors']) data[key].allUrl ??= null;
    data.donate.btnUrl ??= null;
  }
}

const entries = readContent(dir).map((e) => {
  const data = mapRichPairs(e.collection, e.data, (pair) => ({ ...pair, uk: toDoc(pair.uk), en: toDoc(pair.en) }));
  addButtonUrls({ collection: e.collection, data });
  return { ...e, data };
});
writeContent(dir, entries);
console.log(`Записів: ${entries.length}.`);
