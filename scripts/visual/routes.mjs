import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const slugs = (collection) =>
  readdirSync(fileURLToPath(new URL(`../../src/content/${collection}`, import.meta.url)))
    .filter((f) => f.endsWith('.json') && !f.startsWith('__'))
    .map((f) => f.slice(0, -'.json'.length))
    .sort();

const readContent = (collection, slug) =>
  JSON.parse(readFileSync(fileURLToPath(new URL(`../../src/content/${collection}/${slug}.json`, import.meta.url)), 'utf8'));

export const LANGS = ['uk', 'en'];
export const VIEWPORTS = [
  { name: 'desktop', size: { width: 1440, height: 900 } },
  { name: 'mobile', size: { width: 390, height: 844 } },
];

// Маска — лише для навмисної відмінності з таблиці рішень плану Етапу 2.
// Маска «щоб пройшло» — прихована регресія: кожен рядок несе причину.
export const GLOBAL_MASK = [
  'iframe', // карта Google, відео YouTube — сторонній вміст, що змінюється сам
  '.fb-page', // стрічка Facebook — те саме
];
const CARD_IMAGE = '.min-thumb img'; // рішення 7: фото картки з media[], а не окремий URL picsum
const MORE_IMAGE = '.more-card img'; // те саме для «Інші служіння»
const VIDEO_THUMB = '.thumbs button:has(.play) img'; // рішення 6: мініатюра відео з YouTube

// Головна порівнюється по секціях: навмисна зміна висоти однієї секції
// (рішення 11, <cite> на англійській) інакше «зсунула» б усе нижче.
const HOME_SECTIONS = [
  ['header', '.site-header'], ['hero', '#home'], ['about', '#about'], ['media', '#media'],
  ['union', '#union'], ['testimonies', 'section.testimonies'], ['ministries', '#ministries'],
  ['pastors', '#pastors'], ['contacts', '#contacts'], ['donate', '#donate'], ['footer', '.site-footer'],
];

export function routes() {
  return [
    {
      name: 'home', legacy: 'index.html', next: '', sections: HOME_SECTIONS, mask: [CARD_IMAGE],
      maskEn: [
        '.news-more', // рішення 11: стрілка тепер і на англійській
        '.tst-avatar', // англійська літера імені (Olena → O), легасі лишав кириличну
        '.tst-card:has(.tst-video) .tst-person', // рішення 14: англійська роль відеосвідчення
        '.tst-video .vlabel', // англійський підпис «Video Testimony» (у легасі — лише в testimonies.dc.html)
      ],
      known: { 'donate:en': 'рішення 11: англійська секція отримала <cite> вірша, якого легасі не показував' },
    },
    {
      // рішення 20: легасі-баг (applyLang('en') → безумовний render('uk')
      // одразу після mount) виправляє клік по .lang-toggle в load() —
      // клік ще раз викликає applyLang('en') останнім, тож маска більше не
      // потрібна: картки й лічильник порівнюються по пікселях як є.
      name: 'ministries', legacy: 'ministries.dc.html', next: 'ministries/', mask: [CARD_IMAGE],
    },
    { name: 'churches', legacy: 'churches.dc.html', next: 'churches/' },
    { name: 'projects', legacy: 'projects.dc.html', next: 'projects/' },
    { name: 'testimonies', legacy: 'testimonies.dc.html', next: 'testimonies/' },
    { name: 'pastors', legacy: 'pastors.dc.html', next: 'pastors/' },
    { name: 'leaders', legacy: 'leaders.dc.html', next: 'leaders/' },
    ...slugs('ministries').map((s) => ({
      // рішення 21: той самий баг на деталці служіння — той самий клік у
      // load() дає легасі-сторінці реально англійський контент, тож жодних
      // додаткових масок чи `known` не потрібно.
      name: `ministry-${s}`, legacy: `ministry.dc.html?id=${s}`, next: `ministries/${s}/`, mask: [MORE_IMAGE, VIDEO_THUMB],
    })),
    ...slugs('churches').map((s) => ({
      name: `church-${s}`, legacy: `church.dc.html?id=${s}`, next: `churches/${s}/`, mask: [VIDEO_THUMB],
    })),
    ...slugs('projects').map((s) => {
      const route = { name: `project-${s}`, legacy: `project.dc.html?id=${s}`, next: `projects/${s}/`, mask: [VIDEO_THUMB] };
      // Задача 7, знайдено поза таблицею рішень плану: у легасі
      // `<div data-progress-wrap hidden>` втрачає атрибут `hidden` під час
      // компіляції шаблону x-dc (перевірено getComputedStyle на живій
      // сторінці: display:block, висота 16px) — порожній прогрес-бар
      // рендериться суцільною смугою var(--accent) для будь-якого проєкту
      // без progress, додаючи висоту й зсуваючи CTA вниз. Нова сторінка
      // блок узагалі не рендерить (тест Задачі 7: «проєкт без прогресу не
      // має порожнього (схованого) блока») — це навмисна відмінність від
      // легасі-бага, а не регресія, тож `known`, а не маска (різниця — у
      // фактичній висоті сторінки, яку піксельна маска не виправляє).
      if (readContent('projects', s).progress === null) {
        const reason = 'легасі-баг: x-dc губить hidden на .info-progress, звідси зайва висота порожнього прогрес-бара';
        route.known = { 'page:uk': reason, 'page:en': reason };
      }
      return route;
    }),
  ];
}
