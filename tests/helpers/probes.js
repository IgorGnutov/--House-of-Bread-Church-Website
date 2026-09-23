// Мінімальні валідні записи кожної колекції для пробних збірок. Самодостатні:
// не копіюють справжній контент, тож видалення чи зміна будь-якого реального
// запису в адмінці ці тести не ламає.
const pair = (uk, en = uk) => ({ uk, en });
const seo = { metaTitle: null, metaDescription: null, ogImage: null, noindex: false };
export const image = (name) => ({ type: 'image', src: `https://example.test/${name}.jpg`, alt: `Проба ${name}` });
export const video = (id = 'ScMzIvxBSi4') => ({ type: 'video', src: id, alt: 'Проба відео' });

export const ministry = (slug, extra = {}) => ({
  slug, order: 0, icon: 'book', leader: 'Проба', phone: '+380 00 000-00-00',
  name: pair(`Служіння ${slug}`, `Ministry ${slug}`), summary: pair('Коротко'), body: pair('Текст'),
  media: [image(slug)], seo, ...extra,
});

export const church = (slug, extra = {}) => ({
  slug, order: 0, pastor: 'Проба', geo: null,
  name: pair(`Церква ${slug}`, `Church ${slug}`), city: pair(`Місто ${slug}`, `City ${slug}`),
  role: pair('Роль'), address: pair('Адреса'), times: pair('Нд 10:00'), lead: pair('Лід'), body: pair('Текст'),
  media: [image(slug)], seo, ...extra,
});

export const project = (slug, extra = {}) => ({
  slug, order: 0, date: '2026-01-10', progress: null, ctaUrl: null,
  title: pair(`Проєкт ${slug}`, `Project ${slug}`), category: pair('Категорія'), status: pair('Триває'),
  period: pair('2026'), lead: pair('Лід'), body: pair('Текст'), stats: [], ctaLabel: pair('Долучитися'),
  media: [image(slug)], seo, ...extra,
});

export const textTestimony = (slug, extra = {}) => ({
  slug, order: 0, type: 'text', name: `Проба ${slug}`, role: pair('Роль'), text: pair('Свідчення'), ...extra,
});

export const videoTestimony = (slug, extra = {}) => ({
  slug, order: 0, type: 'video', name: `Проба ${slug}`, role: pair('Роль'),
  videoUrl: 'https://youtu.be/ScMzIvxBSi4', poster: 'https://example.test/poster.jpg', ...extra,
});

export const person = (slug, group, extra = {}) => ({
  slug, name: `Проба ${slug}`, photo: `https://example.test/${slug}.jpg`, order: 0, group,
  email: null, phone: null, role: pair('Роль'), subtitle: null, bio: pair('Опис'), ...extra,
});

export const documentResource = (slug, extra = {}) => ({
  slug, kind: 'document', order: 0, url: null, format: 'pdf', icon: null,
  title: pair(`Документ ${slug}`), description: pair('Опис'), meta: null, ...extra,
});

export const linkResource = (slug, extra = {}) => ({
  slug, kind: 'link', order: 0, url: null, format: null, icon: 'book',
  title: pair(`Посилання ${slug}`), description: pair('Опис'), meta: null, ...extra,
});
