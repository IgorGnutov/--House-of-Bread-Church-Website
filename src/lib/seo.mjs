import { pick } from './i18n.mjs';
import { paragraphs } from './format.mjs';
import { assetUrl, localePath, otherLang } from './paths.mjs';

// Google показує в видачі близько 155–160 символів опису. Обрізаємо самі й
// по слову — інакше фразу обріже пошуковик посеред слова.
export const DESCRIPTION_MAX = 160;

export function truncate(text, max = DESCRIPTION_MAX) {
  const flat = text.replace(/\s+/g, ' ').trim();
  if (flat.length <= max) return flat;
  const cut = flat.slice(0, max - 1);
  const space = cut.lastIndexOf(' ');
  // Одне надовге слово без пробілів ріжемо по символу, а не лишаємо порожнім.
  const words = space > max / 2 ? cut.slice(0, space) : cut;
  return `${words.replace(/[\s,.;:—–-]+$/, '')}…`;
}

// Рішення 1: бренд у кінці заголовка, але без дубля, коли назва вже там
// («Дім Хліба — Кривий Ріг»).
export const fullTitle = (title, siteName) => (title.includes(siteName) ? title : `${title} — ${siteName}`);

// Опис сторінки з pages.*: лід, інакше перший абзац прози. undefined —
// сигнал Seo.astro взяти загальний опис сайту.
export function pageDescription(page, lang) {
  if (page.lead) return pick(page.lead, lang);
  if (page.body) return paragraphs(pick(page.body, lang))[0];
  return undefined;
}

// Пошуковики й Facebook приймають лише абсолютні адреси.
export const absoluteUrl = (site, base, src) => new URL(assetUrl(base, src), site).href;

// Спека 2: hreflang мають бути взаємними. Обидва боки будуються з того
// самого шляху без локалі, тож розійтися не можуть.
export const alternates = (site, base, path) => {
  const uk = new URL(localePath(base, 'uk', path), site).href;
  return [
    { hreflang: 'uk', href: uk },
    { hreflang: 'en', href: new URL(localePath(base, 'en', path), site).href },
    { hreflang: 'x-default', href: uk },
  ];
};

// Рішення 3: defaultOgImage зараз null — картка без картинки гірша за фото
// героя, єдине справжнє фото сайту.
export const siteFallbackImage = (settings, homepage) => settings.defaultOgImage ?? homepage.heroImage.src;

const OG_LOCALE = { uk: 'uk_UA', en: 'en_US' };

// Увесь ланцюжок фолбеків Спеки 2 в одному місці: редактор додасть запис і
// не заповнить SEO — сторінка однаково вийде з заголовком, описом і картинкою.
// Те, що редактор заповнив сам, іде дослівно.
export function resolveMeta({
  site, base, lang, path, title, description, seo, image, siteName, defaultDescription, fallbackImage, noindex = false,
}) {
  return {
    title: seo?.metaTitle ? pick(seo.metaTitle, lang) : fullTitle(title, siteName),
    description: seo?.metaDescription ? pick(seo.metaDescription, lang) : truncate(description ?? defaultDescription),
    canonical: new URL(localePath(base, lang, path), site).href,
    alternates: alternates(site, base, path),
    image: absoluteUrl(site, base, seo?.ogImage ?? image ?? fallbackImage),
    noindex: noindex || Boolean(seo?.noindex),
    locale: OG_LOCALE[lang],
    localeAlternate: OG_LOCALE[otherLang(lang)],
    siteName,
  };
}
