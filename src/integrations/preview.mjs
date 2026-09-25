// Прев'ю-стенд (Спека 3): лише в режимі HOB_PREVIEW. Статична збірка цієї
// інтеграції не має — ні middleware, ні маршрутів у dist/ не зʼявляється.
export default function preview() {
  return {
    name: 'hob-preview',
    hooks: {
      'astro:config:setup': ({ addMiddleware }) => {
        // URL, а не рядок './src/…': рядок Rollup розвʼязує як імʼя модуля
        // і не знаходить його (збірка прев'ю, 2026-09-25).
        addMiddleware({ entrypoint: new URL('../preview/middleware.mjs', import.meta.url), order: 'pre' });
      },
    },
  };
}
