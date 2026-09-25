import { byOrder } from './collections.mjs';
import { storyPath } from './storyblok/convert.mjs';
import { COLLECTIONS } from './storyblok/model.mjs';

// Єдиний вхід шаблонів до даних. Статична збірка наповнює його з колекцій
// Astro (site-data.ts), прев'ю-стенд — з чернетки Storyblok на кожен запит
// (src/preview/middleware.mjs). Шаблони не знають, звідки дані.
export function makeSite(entries, editables = new Map()) {
  const by = new Map();
  for (const entry of entries) {
    if (!by.has(entry.collection)) by.set(entry.collection, []);
    by.get(entry.collection).push(entry);
  }
  const expect = (name, kind) => {
    if (COLLECTIONS[name]?.kind !== kind) throw new Error(`site: «${name}» — не ${kind}`);
  };
  return {
    // Те саме сортування, що sortedData: order, потім slug.
    list(name) {
      expect(name, 'collection');
      return (by.get(name) ?? []).map((e) => e.data).sort(byOrder);
    },
    one(name) {
      expect(name, 'singleton');
      const found = by.get(name)?.[0];
      if (!found) throw new Error(`site: немає одиночки «${name}»`);
      return found.data;
    },
    page(id) {
      const found = (by.get('pages') ?? []).find((e) => e.slug === id);
      if (!found) throw new Error(`site: немає сторінки «${id}»`);
      return found.data;
    },
    // Атрибути Visual Editor для блоку історії. Поза прев'ю — {}: у
    // продакшн-HTML не додається нічого.
    edit(collection, slug = null, field = '') {
      if (editables.size === 0) return {};
      return editables.get(`${storyPath(collection, slug ?? COLLECTIONS[collection].slug)}#${field}`) ?? {};
    },
  };
}
