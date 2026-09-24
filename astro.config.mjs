import { defineConfig } from 'astro/config';
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

// Прев'ю-стенд (GitHub Pages зараз, Cloudflare Pages у Спеці 3) закритий від
// індексації: noindex на кожній сторінці (рішення 5 плану Етапу 3). Вмикає
// лише рівно 'true': продакшн-збірка без змінної індексується.
export const NOINDEX = process.env.SITE_NOINDEX === 'true';

export default defineConfig({
  site: SITE_URL,
  base: BASE_PATH,
  trailingSlash: 'always',
  integrations: [seoFiles({ site: SITE_URL, base: BASE_PATH, noindex: NOINDEX })],
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
