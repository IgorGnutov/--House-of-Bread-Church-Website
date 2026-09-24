// <head> сторінки у вигляді, зручному для порівнянь. node-html-parser
// повертає атрибути вже розкодованими («&amp;» → «&»), тож порівнюємо з
// текстом даних напряму.
export function head(root) {
  const meta = (attr, key) => root.querySelector(`meta[${attr}="${key}"]`)?.getAttribute('content');
  return {
    title: root.querySelector('title')?.text,
    description: meta('name', 'description'),
    robots: meta('name', 'robots'),
    canonical: root.querySelector('link[rel="canonical"]')?.getAttribute('href'),
    alternates: Object.fromEntries(
      root.querySelectorAll('link[rel="alternate"][hreflang]').map((l) => [l.getAttribute('hreflang'), l.getAttribute('href')]),
    ),
    og: Object.fromEntries(
      root.querySelectorAll('meta[property^="og:"]').map((m) => [m.getAttribute('property'), m.getAttribute('content')]),
    ),
    twitterCard: meta('name', 'twitter:card'),
  };
}

// Сирий вміст JSON-LD: перевіряємо і те, що він парситься, і те, що в ньому
// немає «<», який закрив би <script>.
export const jsonLdScripts = (root) =>
  root.querySelectorAll('script[type="application/ld+json"]').map((script) => script.rawText);

export const jsonLd = (root) => jsonLdScripts(root).flatMap((raw) => JSON.parse(raw)['@graph']);

// sitemap.xml пише наш власний генератор з фіксованою розміткою, тож
// регулярних виразів досить — XML-парсер тут не потрібен.
export function parseSitemap(xml) {
  return [...xml.matchAll(/<url>([\s\S]*?)<\/url>/g)].map(([, body]) => ({
    loc: body.match(/<loc>([^<]+)<\/loc>/)[1],
    alternates: Object.fromEntries(
      [...body.matchAll(/<xhtml:link rel="alternate" hreflang="([^"]+)" href="([^"]+)"\/>/g)].map(([, lang, href]) => [lang, href]),
    ),
  }));
}
