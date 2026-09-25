import cloudflare from '@astrojs/cloudflare';
import { defineConfig } from 'astro/config';
import preview from './src/integrations/preview.mjs';
import seoFiles from './src/integrations/seo-files.mjs';

// Єдині два місця в проєкті, де живе адреса сайту. Тести імпортують саме ці
// константи (а не читають process.env повторно й не хардкодять домен/підшлях),
// щоб перевіряти те, що реально дійшло до збірки, а не повторювати фолбек.
// Доки домену немає — зарезервований .invalid: випадковий витік буде видно одразу.
export const SITE_URL = process.env.SITE_URL ?? 'https://dim-hliba.invalid';

// GitHub Pages віддає сторінки проєкту з підшляху, власний домен — з кореня.
// Нормалізуємо рівно тут, в одному місці: завжди провідний і рівно один кінцевий
// слеш. Це і йде в Astro-конфіг нижче, і в тести — так конкатенація деінде не
// може забути слеш (без підшляху 404 не видно локально) чи здублювати його.
const normalizeBasePath = (raw) => {
  const withLeadingSlash = raw.startsWith('/') ? raw : `/${raw}`;
  return withLeadingSlash.endsWith('/') ? withLeadingSlash : `${withLeadingSlash}/`;
};

export const BASE_PATH = normalizeBasePath(process.env.BASE_PATH ?? '/');

// Прев'ю-стенд (Спека 3): серверний режим на Cloudflare Pages, кожен запит
// рендериться з чернетки Storyblok. Продакшн лишається статичним.
export const PREVIEW = process.env.HOB_PREVIEW === 'true';

// Прев'ю-стенди закриті від індексації: noindex на кожній сторінці
// (рішення 5 плану Етапу 3). Вмикає рівно 'true' або режим прев'ю — стенд
// Cloudflare закритий, навіть якщо SITE_NOINDEX забули задати. Продакшн-збірка
// без змінної індексується.
export const NOINDEX = PREVIEW || process.env.SITE_NOINDEX === 'true';

export default defineConfig({
  site: SITE_URL,
  base: BASE_PATH,
  // У прев'ю адреси історій Storyblok приходять без «/», і їх має побачити
  // middleware (storyRedirect), а не відсікти маршрутизатор.
  trailingSlash: PREVIEW ? 'ignore' : 'always',
  // sitemap/robots/.htaccess будуються з HTML статичної збірки — у
  // серверного режиму прев'ю його немає.
  integrations: PREVIEW ? [preview()] : [seoFiles({ site: SITE_URL, base: BASE_PATH, noindex: NOINDEX })],
  // platformProxy вимкнено: змінні в dev дає process.env (src/preview/env.mjs).
  // passthrough — бо astro:assets сайт не використовує.
  ...(PREVIEW && { output: 'server', adapter: cloudflare({ platformProxy: { enabled: false }, imageService: 'passthrough' }) }),
  build: {
    format: 'directory',
    // Спека 1 хоче CSS, що кешується один раз на весь сайт.
    // Дефолтний 'auto' інлайнив би дрібні бандли назад у HTML — саме те, від чого йдемо.
    inlineStylesheets: 'never',
  },
  i18n: {
    defaultLocale: 'uk',
    locales: ['uk', 'en'],
    routing: { prefixDefaultLocale: false },
  },
  vite: {
    // Константа для Seo.astro: той самий NOINDEX, що бачать тести.
    define: { __HOB_NOINDEX__: JSON.stringify(NOINDEX) },
  },
});
