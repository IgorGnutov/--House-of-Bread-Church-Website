import { defineConfig } from 'astro/config';

// Єдині два місця в проєкті, де живе адреса сайту.
// Доки домену немає — зарезервований .invalid: випадковий витік буде видно одразу.
const SITE_URL = process.env.SITE_URL ?? 'https://dim-hliba.invalid';

// GitHub Pages віддає сторінки проєкту з підшляху, власний домен — з кореня.
const BASE_PATH = process.env.BASE_PATH ?? '/';

export default defineConfig({
  site: SITE_URL,
  base: BASE_PATH,
  trailingSlash: 'always',
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
});
