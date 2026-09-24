import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { glob, file, type Loader } from 'astro/loaders';
import { defineCollection } from 'astro:content';
import { assertUniqueSlugs } from './lib/collections.mjs';
import { PAGE_IDS, schemas } from './lib/schema.mjs';

// Правила даних — у src/lib/schema.mjs: їх читають і збірка, і скрипти
// Storyblok (scripts/cms), і тести. Тут лише завантажувачі.

// Тести збирають сайт із тимчасової копії контенту (порожні колекції, дірки
// в order тощо), не чіпаючи src/content. У звичайній збірці змінної немає.
const CONTENT_DIR = process.env.HOB_CONTENT_DIR
  ? `${pathToFileURL(resolve(process.env.HOB_CONTENT_DIR)).href}/`
  : './src/content/';

// Обгортка над glob():
// - id — імʼя файлу, а не slug. Типовий generateId бере data.slug, і два
//   файли з однаковим slug мовчки зливалися в один запис — служіння просто
//   зникало з сайту. Тепер обидва доходять до перевірки й збірка падає з
//   поясненням.
// - store.clear(): коли в колекції не лишилося жодного файлу, glob()
//   виходить раніше, ніж прибирає старі записи, і локальна повторна збірка
//   (кеш node_modules/.astro) показувала б уже видалене.
function collectionLoader(name: string): Loader {
  const inner = glob({
    pattern: '**/*.json',
    base: `${CONTENT_DIR}${name}`,
    generateId: ({ entry }) => entry.replace(/\.json$/, ''),
  });
  return {
    name: 'hob-collection',
    load: async (context) => {
      context.store.clear();
      await inner.load(context);
      assertUniqueSlugs(name, context.store.entries().map(([id, entry]) => ({ id, slug: entry.data.slug as string })));
    },
  };
}

// Обгортка над file(): шаблони читають записи-одиночки за id (main,
// pages.ministries, …). Без перевірки видалений запис проходив схему і
// валив шаблон на «Cannot read properties of undefined».
function singletonLoader(fileName: string, ids: string[]): Loader {
  const inner = file(`${CONTENT_DIR}singletons/${fileName}`);
  return {
    name: 'hob-singleton',
    load: async (context) => {
      await inner.load(context);
      const missing = ids.filter((id) => !context.store.has(id));
      if (missing.length > 0) {
        throw new Error(`${fileName}: бракує записів ${missing.map((id) => `«${id}»`).join(', ')} — їх читають шаблони сторінок`);
      }
    },
  };
}

export const collections = {
  ministries: defineCollection({ loader: collectionLoader('ministries'), schema: schemas.ministries }),
  churches: defineCollection({ loader: collectionLoader('churches'), schema: schemas.churches }),
  projects: defineCollection({ loader: collectionLoader('projects'), schema: schemas.projects }),
  testimonies: defineCollection({ loader: collectionLoader('testimonies'), schema: schemas.testimonies }),
  pastors: defineCollection({ loader: collectionLoader('pastors'), schema: schemas.pastors }),
  'leader-resources': defineCollection({ loader: collectionLoader('leader-resources'), schema: schemas['leader-resources'] }),
  // Одиночка = один запис із id "main". file() робить ключі верхнього рівня
  // ідентифікаторами, тож обгортка {"main": …} — це ціна того, щоб одиночка
  // теж валідувалася схемою на збірці, а не читалася як сирий JSON.
  'site-settings': defineCollection({ loader: singletonLoader('site-settings.json', ['main']), schema: schemas['site-settings'] }),
  'contact-info': defineCollection({ loader: singletonLoader('contact-info.json', ['main']), schema: schemas['contact-info'] }),
  'donate-settings': defineCollection({ loader: singletonLoader('donate-settings.json', ['main']), schema: schemas['donate-settings'] }),
  homepage: defineCollection({ loader: singletonLoader('homepage.json', ['main']), schema: schemas.homepage }),
  // Сторінки — маршрути в коді, тож набір id фіксований: без запису сторінка
  // не має навіть заголовка.
  pages: defineCollection({ loader: singletonLoader('pages.json', PAGE_IDS), schema: schemas.pages }),
};
