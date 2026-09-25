import { writeFileSync } from 'node:fs';

// Прев'ю-стенд (Спека 3): лише в режимі HOB_PREVIEW. Статична збірка цієї
// інтеграції не має — ні middleware, ні маршрутів у dist/ не зʼявляється.
export default function preview() {
  return {
    name: 'hob-preview',
    hooks: {
      'astro:config:setup': ({ addMiddleware, injectRoute }) => {
        // URL, а не рядок './src/…': рядок Rollup розвʼязує як імʼя модуля
        // і не знаходить його (збірка прев'ю, 2026-09-25).
        addMiddleware({ entrypoint: new URL('../preview/middleware.mjs', import.meta.url), order: 'pre' });
        // Вебхук публікації (Задача 9): лише на стенді, у статичній збірці маршруту немає.
        injectRoute({ pattern: '/api/storyblok-publish', entrypoint: new URL('../preview/publish-hook.mjs', import.meta.url), prerender: false });
      },
      // Стенд — Cloudflare Worker зі статичними файлами (wrangler.jsonc):
      // assets.directory = dist, де лежить і сам воркер. Без цього списку
      // wrangler виклав би серверний код публічним файлом. _routes.json —
      // формат Pages, воркеру не потрібен.
      'astro:build:done': ({ dir }) => {
        writeFileSync(new URL('.assetsignore', dir), '_worker.js\n_routes.json\n');
      },
    },
  };
}
