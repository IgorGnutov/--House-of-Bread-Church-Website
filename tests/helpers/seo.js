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
