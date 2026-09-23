import { glob } from 'astro/loaders';
import { defineCollection, z } from 'astro:content';

// Обидві мови обовʼязкові й непорожні. Якщо дозволити лише uk, англійська
// сторінка мовчки покаже українську — а це гірше за впалу збірку.
export const localized = z.object({
  uk: z.string().min(1),
  en: z.string().min(1),
});

// alt обовʼязкове: воно потрібне і для доступності, і для SEO (Спека 1).
// src приймає і повний YouTube-URL, і голий 11-символьний ID — Спека 1
// дозволяє обидва, тому звужувати до URL не можна.
export const mediaItem = z.object({
  type: z.enum(['image', 'video']),
  src: z.string().min(1),
  alt: z.string().min(1),
});

export const seo = z.object({
  metaTitle: localized.nullable(),
  metaDescription: localized.nullable(),
  ogImage: z.string().nullable(),
  noindex: z.boolean(),
});

// Іконки — inline SVG у коді (index.html, `const icons`). Довільне значення
// зламало б картку мовчки, тому список закритий.
export const MINISTRY_ICONS = [
  'book', 'home', 'media', 'worship', 'child', 'youth', 'teen', 'order', 'care',
  'chapel', 'prophetic', 'hospital', 'biz', 'pray', 'mercy', 'prison', 'family', 'globe',
] as const;

const ministries = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/content/ministries' }),
  schema: z.object({
    slug: z.string().min(1),
    icon: z.enum(MINISTRY_ICONS),
    leader: z.string().min(1),
    phone: z.string().min(1),
    name: localized,
    summary: localized,
    body: localized,
    media: z.array(mediaItem).min(1),
    seo,
  }),
});

// Координати нового поля geo немає в жодному легасі-джерелі. Nullable, щоб
// збірка проходила зараз, а Етап 3 (JSON-LD Church) бачив явну порожнечу.
export const geoPoint = z.object({ lat: z.number(), lng: z.number() }).nullable();

const churches = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/content/churches' }),
  schema: z.object({
    slug: z.string().min(1),
    pastor: z.string().min(1),
    geo: geoPoint,
    name: localized,
    city: localized,
    role: localized,
    address: localized,
    times: localized,
    lead: localized,
    body: localized,
    media: z.array(mediaItem).min(1),
    seo,
  }),
});

export const collections = { ministries, churches };
