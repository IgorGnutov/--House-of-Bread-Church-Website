import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parse } from 'node-html-parser';
import { BASE_PATH } from '../../astro.config.mjs';

export const distDir = fileURLToPath(new URL('../../dist/', import.meta.url));
export const distPath = (rel) => fileURLToPath(new URL(`../../dist/${rel}`, import.meta.url));
export const loadPage = (rel) => parse(readFileSync(distPath(rel), 'utf8'));
// Спека 5: стрічка Facebook — чужий текст на нашій сторінці. Правила про
// нашу розмітку (легасі-адреси, Storyblok, інлайн-шрифти, підшлях,
// localStorage) його не стосуються: інакше пост зі словом чи посиланням
// «…/index.html» зупинив би деплой. Картинки стрічки й далі перевіряє
// findBrokenLinks — він читає сторінку цілком.
export function ownMarkup(html) {
  const root = parse(typeof html === 'string' ? html : html.toString());
  for (const feed of root.querySelectorAll('[data-fb-track]')) feed.remove();
  return root;
}
// Очікуваний href — з того самого BASE_PATH, що пішов у збірку.
export const href = (path) => `${BASE_PATH}${path.replace(/^\//, '')}`;
