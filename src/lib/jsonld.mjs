// Дні тижня у форматі schema.org openingHours. Розбираємо англійський текст:
// схема вимагає обидві мови, а англійські назви днів передбачувані.
const DAYS = [
  ['monday', 'Mo'], ['tuesday', 'Tu'], ['wednesday', 'We'], ['thursday', 'Th'],
  ['friday', 'Fr'], ['saturday', 'Sa'], ['sunday', 'Su'],
];
const TIME_RANGE = /\b(\d{1,2}):(\d{2})\s*[–—-]\s*(\d{1,2}):(\d{2})\b/;
const hhmm = (h, m) => (Number(h) <= 23 && Number(m) <= 59 ? `${h.padStart(2, '0')}:${m}` : null);
// «Monday–Friday» тощо: діапазон днів, а не окремий день — код нижче наївно
// парує кожен знайдений день з першим діапазоном часу, тому такий текст
// вигадав би службу на дні всередині діапазону.
const DAY_RANGE = new RegExp(`\\b(?:${DAYS.map(([name]) => name).join('|')})s?\\s*[–—-]\\s*(?:${DAYS.map(([name]) => name).join('|')})s?\\b`, 'i');

// Рішення 9: без дня чи без часу закінчення — null. Вигадана година
// закінчення в картці пошуку гірша за її відсутність. Так само гірша за
// відсутність — вигаданий збіг: текст із діапазоном днів («Monday–Friday»)
// або з більш ніж однією парою часу («Sunday 10:00–12:00, Wednesday
// 18:00–20:00») описує розклад складніший, ніж «один день — один діапазон»,
// тож замість вгадувати повертаємо null.
export function openingHours(text) {
  if (DAY_RANGE.test(text)) return null;
  const times = text.match(/\d{1,2}:\d{2}/g) ?? [];
  if (times.length !== 2) return null;
  const days = DAYS.filter(([name]) => new RegExp(`\\b${name}s?\\b`, 'i').test(text)).map(([, code]) => code);
  const range = text.match(TIME_RANGE);
  if (days.length === 0 || !range) return null;
  const from = hhmm(range[1], range[2]);
  const to = hhmm(range[3], range[4]);
  return from && to ? `${days.join(',')} ${from}-${to}` : null;
}

// undefined, а не null: JSON.stringify пропускає властивість зовсім, а
// «"geo": null» валідатори schema.org вважають помилкою.
const optional = (value) =>
  value === null || value === undefined || (Array.isArray(value) && value.length === 0) ? undefined : value;

export function churchNode({ id, url, name, image, street, city, geo = null, hours = null, telephone, email, sameAs }) {
  return {
    '@type': 'Church',
    '@id': id,
    name,
    url,
    image: optional(image),
    // Рішення 10: усі церкви обʼєднання — в Україні; поля країни в даних немає.
    address: { '@type': 'PostalAddress', streetAddress: street, addressLocality: city, addressCountry: 'UA' },
    geo: geo ? { '@type': 'GeoCoordinates', latitude: geo.lat, longitude: geo.lng } : undefined,
    openingHours: optional(hours),
    telephone: optional(telephone),
    email: optional(email),
    sameAs: optional(sameAs),
  };
}

export function organizationNode({ id, url, name, logo, telephone, email, sameAs }) {
  return {
    '@type': 'Organization',
    '@id': id,
    name,
    url,
    logo,
    telephone: optional(telephone),
    email: optional(email),
    sameAs: optional(sameAs),
  };
}

export const breadcrumbNode = (items) => ({
  '@type': 'BreadcrumbList',
  itemListElement: items.map(({ name, url }, index) => ({ '@type': 'ListItem', position: index + 1, name, item: url })),
});

// Вміст <script> браузер не екранує: «</script>» у назві з адмінки закрив би
// тег і решта пішла б у сторінку як HTML. < — той самий «<» для JSON.
export const jsonLdScript = (nodes) =>
  JSON.stringify({ '@context': 'https://schema.org', '@graph': nodes }).replace(/</g, '\\u003c');
