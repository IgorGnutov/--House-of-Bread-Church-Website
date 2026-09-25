import { assertUniqueSlugs } from './collections.mjs';
import { PAGE_IDS, schemas } from './schema.mjs';
import { COLLECTIONS } from './storyblok/model.mjs';

// Ті самі перевірки, що й збірка (схема, унікальність slug, id сторінок,
// одиночки), для записів, прочитаних не завантажувачем Astro: імпорт
// (файли), cms:pull і прев'ю (Storyblok). Без fs — працює і у воркері
// прев'ю-стенду. API Storyblok обовʼязковості полів не перевіряє, тож
// невалідні дані мусять зупинитися тут.
export function validateContent(entries) {
  const errors = [];
  for (const { collection, source, data } of entries) {
    if (data === undefined) {
      errors.push(`${source}: бракує запису «main»`);
      continue;
    }
    const result = schemas[collection].safeParse(data);
    if (!result.success) {
      for (const issue of result.error.issues) errors.push(`${source} → ${issue.path.join('.') || '(запис)'}: ${issue.message}`);
    }
  }
  for (const [collection, entry] of Object.entries(COLLECTIONS)) {
    if (entry.kind === 'collection') {
      try {
        assertUniqueSlugs(collection, entries.filter((e) => e.collection === collection).map((e) => ({ id: e.source, slug: e.slug })));
      } catch (error) {
        errors.push(error.message);
      }
    }
    // Одиночку шаблони читають завжди: без неї сторінка впала б на «Cannot
    // read properties of undefined» (content.config.ts, singletonLoader).
    if (entry.kind === 'singleton' && !entries.some((e) => e.collection === collection)) {
      errors.push(`${entry.folder}/${entry.slug}: історії немає — її читають шаблони`);
    }
  }
  const pageIds = new Set(entries.filter((e) => e.collection === 'pages').map((e) => e.slug));
  const missing = PAGE_IDS.filter((id) => !pageIds.has(id));
  if (missing.length > 0) errors.push(`singletons/pages.json: бракує сторінок ${missing.map((id) => `«${id}»`).join(', ')} — їх читають шаблони`);
  return errors;
}
