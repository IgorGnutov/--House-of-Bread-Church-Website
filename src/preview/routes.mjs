import { localePath } from '../lib/paths.mjs';
import { PAGE_IDS } from '../lib/schema.mjs';

// Visual Editor відкриває історію за адресою «<прев'ю>/<full_slug>», а
// адреси сайту інші: pages/about → /about/, settings/* → /, у свідчень,
// пасторів і ресурсів лідерів власних сторінок немає.
const LIST_ONLY = { testimonies: '/testimonies/', pastors: '/pastors/', 'leader-resources': '/leaders/' };
const DETAIL = new Set(['ministries', 'churches', 'projects']);

export function sitePathForStory(fullSlug) {
  const [folder, slug, ...rest] = fullSlug.replace(/^\/+|\/+$/g, '').split('/');
  if (!folder || !slug || rest.length > 0) return null;
  if (folder === 'settings') return '/';
  if (folder === 'pages') return PAGE_IDS.includes(slug) ? `/${slug}/` : null;
  if (LIST_ONLY[folder]) return LIST_ONLY[folder];
  if (DETAIL.has(folder)) return `/${folder}/${slug}/`;
  return null;
}

// Адреса для 302 або null, якщо адреса вже є сторінкою сайту. Адреса без
// кінцевого «/» (так її дає Storyblok) отримує його: маршрути сайту — з ним.
export function storyRedirect(url, base) {
  if (!url.pathname.startsWith(base)) return null;
  let rest = url.pathname.slice(base.length);
  let lang = 'uk';
  if (rest === 'en' || rest.startsWith('en/')) {
    lang = 'en';
    rest = rest.slice(2).replace(/^\//, '');
  }
  if (/\.[a-z0-9]+$/i.test(rest)) return null; // файли (/_astro/…, /fonts/…) — не історії
  const path = sitePathForStory(rest) ?? (rest === '' ? '/' : `/${rest.replace(/\/?$/, '/')}`);
  const href = localePath(base, lang, path);
  return href === url.pathname ? null : `${href}${url.search}`;
}
