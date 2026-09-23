// Усі внутрішні адреси будуються тут. base — import.meta.env.BASE_URL, його
// astro.config.mjs нормалізує до «/…/». Жодна сторінка не пише «/» руками:
// під підшляхом GitHub Pages це дає 404, якого локально не видно.
export const LOCALES = ['uk', 'en'];

export const otherLang = (lang) => (lang === 'uk' ? 'en' : 'uk');

export const isExternal = (url) => /^https?:\/\//.test(url);

export function localePath(base, lang, path = '/') {
  if (!LOCALES.includes(lang)) throw new Error(`невідома локаль: ${lang}`);
  if (!path.startsWith('/')) throw new Error(`шлях має починатися з «/»: ${path}`);
  return `${base}${lang === 'en' ? 'en/' : ''}${path.slice(1)}`;
}

export function assetUrl(base, src) {
  return isExternal(src) ? src : `${base}${src.replace(/^\/+/, '')}`;
}

// Посилання з даних (напр. ctaUrl проєкту): або чужий сайт, або шлях сайту,
// що має лишитися в мові поточної сторінки.
export function linkHref(base, lang, url) {
  if (isExternal(url)) return url;
  if (url.startsWith('/')) return localePath(base, lang, url);
  throw new Error(`посилання має бути https://… або /…: ${url}`);
}

// Rest-параметр [...lang]: undefined дає корінь (uk), 'en' — префікс /en/.
// Один файл маршруту — обидві локалі (Спека 1).
export const localeParams = () => [
  { params: { lang: undefined }, props: { lang: 'uk' } },
  { params: { lang: 'en' }, props: { lang: 'en' } },
];
