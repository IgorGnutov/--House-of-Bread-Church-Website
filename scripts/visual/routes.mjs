import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const slugs = (collection) =>
  readdirSync(fileURLToPath(new URL(`../../src/content/${collection}`, import.meta.url)))
    .filter((f) => f.endsWith('.json') && !f.startsWith('__'))
    .map((f) => f.slice(0, -'.json'.length))
    .sort();

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

// рішення 21: той самий баг, що й рішення 20, але на деталці служіння —
// applyLang('en') заповнює UI-мітки й викликає renderMinistry('en'), та одразу
// після цього безумовний виклик renderMinistry('uk') скидає назву, опис і
// картки «Інші служіння» назад на українську (мітки з data-i18n лишаються
// англійськими). Нова збірка показує повністю англійську; довжина тексту
// різних мов зсуває висоту всієї сторінки, тож секційна маска не рятує —
// уся сторінка позначена як відома відмінність.
const MINISTRY_DETAIL_KNOWN = {
  'page:en': 'рішення 21: applyLang(en) → безумовний renderMinistry(uk) скидає контент назад на українську',
};

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
      name: 'ministries', legacy: 'ministries.dc.html', next: 'ministries/', mask: [CARD_IMAGE],
      // рішення 20: баг легасі — після applyLang('en') безумовний render('uk')
      // перемальовує картки й лічильник українською. Нова збірка показує
      // англійську — маскуємо лише блоки з неперекладеним у легасі текстом
      // (їхні розміри залежать від довжини рядка); зовнішні межі карток,
      // іконки й сітка порівнюються.
      maskEn: ['.hero-count', '.min-body'],
    },
    { name: 'churches', legacy: 'churches.dc.html', next: 'churches/' },
    { name: 'projects', legacy: 'projects.dc.html', next: 'projects/' },
    { name: 'testimonies', legacy: 'testimonies.dc.html', next: 'testimonies/' },
    { name: 'pastors', legacy: 'pastors.dc.html', next: 'pastors/' },
    { name: 'leaders', legacy: 'leaders.dc.html', next: 'leaders/' },
    ...slugs('ministries').map((s) => ({
      name: `ministry-${s}`, legacy: `ministry.dc.html?id=${s}`, next: `ministries/${s}/`, mask: [MORE_IMAGE, VIDEO_THUMB],
      known: MINISTRY_DETAIL_KNOWN,
    })),
    ...slugs('churches').map((s) => ({
      name: `church-${s}`, legacy: `church.dc.html?id=${s}`, next: `churches/${s}/`, mask: [VIDEO_THUMB],
    })),
    ...slugs('projects').map((s) => ({
      name: `project-${s}`, legacy: `project.dc.html?id=${s}`, next: `projects/${s}/`, mask: [VIDEO_THUMB],
    })),
  ];
}
