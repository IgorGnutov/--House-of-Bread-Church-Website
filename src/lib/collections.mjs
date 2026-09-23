import { ytId, ytThumb } from './youtube.mjs';

export const byOrder = (a, b) => a.order - b.order;

// Glob-завантажувач порядку не гарантує; вигляд залежить від order
// (значок «Головна церква», перші три служіння на головній).
export const sortedData = (entries) => entries.map((entry) => entry.data).sort(byOrder);

export function nextCyclic(list, index, count) {
  const n = Math.min(count, list.length - 1);
  return Array.from({ length: n }, (_, i) => list[(index + 1 + i) % list.length]);
}

export const othersFirst = (list, slug, count) =>
  list.filter((item) => item.slug !== slug).slice(0, count);

export function coverImage(media) {
  const image = media.find((item) => item.type === 'image');
  if (image) return { src: image.src, alt: image.alt };
  const id = ytId(media[0]?.src);
  if (!id) throw new Error(`галерея без фото і без відео YouTube: ${JSON.stringify(media)}`);
  return { src: ytThumb(id), alt: media[0].alt };
}
