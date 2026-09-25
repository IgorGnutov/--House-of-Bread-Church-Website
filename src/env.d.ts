// Підставляє vite.define з astro.config.mjs (режим прев'ю, SITE_NOINDEX).
declare const __HOB_NOINDEX__: boolean;

declare namespace App {
  interface Locals {
    // Прев'ю-стенд: дані чернетки Storyblok на цей запит (src/preview/middleware.mjs).
    site?: import('./lib/site-data').Site;
    // Сторінку відкрив редактор у Visual Editor: підключити Bridge.
    preview?: boolean;
  }
}
