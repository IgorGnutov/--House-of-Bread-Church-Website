import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { PROJECT_ROOT, readHobGlobals } from './lib/legacy-source.mjs';

// Стабільна серіалізація: два пробіли й перенос у кінці. Інакше повторний
// запуск скрипта дає diff із самих лапок і ховає справжні зміни контенту.
export const writeJson = (relPath, value) => {
  const target = fileURLToPath(new URL(relPath, PROJECT_ROOT));
  mkdirSync(fileURLToPath(new URL(relPath.replace(/\/[^/]+$/, '/'), PROJECT_ROOT)), {
    recursive: true,
  });
  writeFileSync(target, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
};

// SEO-поля ще ніде не заповнені: на легасі-сторінках немає жодного <title>.
// Кладемо явні null, щоб Етап 3 бачив порожнечу як дані, а не як відсутнє поле.
const emptySeo = () => ({
  metaTitle: null,
  metaDescription: null,
  ogImage: null,
  noindex: false,
});

function extractMinistries(window) {
  for (const m of window.HOB_MINISTRIES) {
    writeJson(`src/content/ministries/${m.id}.json`, {
      slug: m.id,
      icon: m.ic,
      leader: m.leader,
      phone: m.phone,
      name: { uk: m.uk[0], en: m.en[0] },
      summary: { uk: m.uk[1], en: m.en[1] },
      body: { uk: m.body, en: m.bodyEn },
      // Галерея служінь у легасі генерується функцією на льоту. У Storyblok
      // функції не буде, тому «заморожуємо» результат у дані як є.
      media: window.HOB_ministryMedia(m),
      seo: emptySeo(),
    });
  }
}

// --- виклики ---

const window = readHobGlobals([
  'ministries-data.js',
  'churches-data.js',
  'projects-data.js',
  'testimonies-data.js',
]);

extractMinistries(window);
console.log('ministries: 18');
