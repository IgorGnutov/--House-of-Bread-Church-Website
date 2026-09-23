import { ytId, ytThumb } from './youtube.mjs';

// order редактор вводить руками: дірки (0, 5, 99) і дублікати — звичайна
// справа. Tie-break за slug робить порядок однаковим на кожній збірці —
// інакше при рівних order він залежав би від порядку файлів на диску.
export const byOrder = (a, b) => a.order - b.order || (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0);

// Glob-завантажувач порядку не гарантує; вигляд залежить від order
// (значок «Головна церква», перші три служіння на головній).
export const sortedData = (entries) => entries.map((entry) => entry.data).sort(byOrder);

// Дублікат slug означав би дві сторінки на одному URL: одна мовчки
// перетерла б іншу. Перевірка тут, а не в схемі, бо схема бачить лише один
// запис; викликає її завантажувач колекції (content.config.ts).
export function assertUniqueSlugs(collection, items) {
  const seen = new Map();
  for (const { id, slug } of items) {
    if (seen.has(slug)) {
      throw new Error(
        `${collection}: slug «${slug}» уже зайнятий записом «${seen.get(slug)}» — дайте запису «${id}» інший slug`,
      );
    }
    seen.set(slug, id);
  }
}

export function nextCyclic(list, index, count) {
  const n = Math.max(0, Math.min(count, list.length - 1));
  return Array.from({ length: n }, (_, i) => list[(index + 1 + i) % list.length]);
}

export const othersFirst = (list, slug, count) =>
  list.filter((item) => item.slug !== slug).slice(0, count);

// Схема гарантує непорожню галерею і YouTube для кожного відео, тож throw —
// друга лінія на випадок виклику не з даних колекції.
export function coverImage(media) {
  const image = media.find((item) => item.type === 'image');
  if (image) return { src: image.src, alt: image.alt };
  const id = ytId(media[0]?.src);
  if (!id) throw new Error(`галерея без фото і без відео YouTube: ${JSON.stringify(media)}`);
  return { src: ytThumb(id), alt: media[0].alt };
}
