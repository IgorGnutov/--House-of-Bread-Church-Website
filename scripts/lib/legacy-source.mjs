import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { parse } from 'node-html-parser';

export const PROJECT_ROOT = new URL('../../', import.meta.url);

export const legacyPath = (name) => fileURLToPath(new URL(name, PROJECT_ROOT));

// Git на Windows (core.autocrlf=true) перезаписує \n на \r\n щоразу, коли
// файл матеріалізується заново (свіжий чекаут, worktree, мердж) — той самий
// блоб може мати різні символи кінця рядка на диску залежно від того, коли й
// де саме він був вичитаний. Нормалізуємо тут, у єдиній точці читання, щоб
// витягнутий контент (зокрема innerHTML із внутрішнім переносом рядка) не
// залежав від цієї випадковості й побайтова звірка була детермінованою.
export const readLegacy = (name) =>
  readFileSync(legacyPath(name), 'utf8').replace(/\r\n?/g, '\n');

// Файли даних — це присвоєння у window, а не модулі. Виконуємо їх у пісочниці
// зі спільним window: HOB_ministryMedia посилається на той самий обʼєкт, тому
// розкладати кожен файл у власний контекст не можна.
export function readHobGlobals(fileNames) {
  const windowObject = {};
  const context = vm.createContext({ window: windowObject });

  for (const name of fileNames) {
    vm.runInContext(readLegacy(name), context, { filename: name });
  }

  return windowObject;
}

export const LEGACY_PAGES = [
  'index.html',
  'church.dc.html',
  'churches.dc.html',
  'leaders.dc.html',
  'ministries.dc.html',
  'ministry.dc.html',
  'pastors.dc.html',
  'project.dc.html',
  'projects.dc.html',
  'testimonies.dc.html',
];

// Англійський словник лежить інлайн як `const EN = { … };` (на .dc.html
// трапляється й EN_UI). Беремо найдовший такий літерал: на головній поруч
// є менші обʼєкти, і перший збіг був би не тим.
const readEnglishDictionary = (source) => {
  const literals = [...source.matchAll(/const\s+EN(?:_UI)?\s*=\s*(\{[\s\S]*?\n\s*\};)/g)]
    .map((m) => m[1].replace(/;$/, ''));

  if (literals.length === 0) return {};

  const widest = literals.reduce((a, b) => (b.length > a.length ? b : a));
  return vm.runInNewContext(`(${widest})`);
};

export function readPageStrings(pageFile) {
  const source = readLegacy(pageFile);
  const english = readEnglishDictionary(source);
  const root = parse(source);
  const pairs = new Map();

  for (const el of root.querySelectorAll('[data-i18n]')) {
    const key = el.getAttribute('data-i18n');
    // Перше входження в порядку документа — детермінований вибір. Той самий
    // ключ трапляється на кількох елементах з РІЗНИМ текстом (напр. con.addr
    // на головній: контакти й підвал) — останній перезапис у циклі був би
    // недетермінованим вибором одного з двох легасі-текстів; ці розбіжності
    // ловить окремо readDuplicateVariants.
    if (pairs.has(key)) continue;
    // Саме innerHTML, а не текст: значення офіційно містять розмітку
    // (див. data-i18n-html на головній), і вона є частиною контенту.
    pairs.set(key, { uk: el.innerHTML.trim(), en: english[key] ?? '' });
  }

  for (const el of root.querySelectorAll('[data-i18n-title]')) {
    const key = el.getAttribute('data-i18n-title');
    if (pairs.has(key)) continue;
    pairs.set(key, { uk: el.getAttribute('title').trim(), en: english[key] ?? '' });
  }

  return pairs;
}

// readPageStrings лишає лише перше входження ключа, тож розбіжний дублікат
// (той самий data-i18n з різним українським текстом на кількох елементах
// однієї сторінки) інакше зникає мовчки. Повертає лише ключі, де тексти
// РІЗНІ — однакові повтори (nav.*, res.go тощо) не вважаються розбіжністю.
export function readDuplicateVariants(pageFile) {
  const root = parse(readLegacy(pageFile));
  const seen = new Map();

  for (const el of root.querySelectorAll('[data-i18n]')) {
    const key = el.getAttribute('data-i18n');
    const text = el.innerHTML.trim();
    const variants = seen.get(key) ?? [];
    if (!variants.includes(text)) variants.push(text);
    seen.set(key, variants);
  }

  const duplicates = new Map();
  for (const [key, variants] of seen) {
    if (variants.length > 1) duplicates.set(key, variants);
  }
  return duplicates;
}

// Частина підписів (бейджі карток, «Детальніше», лічильники) у легасі не має
// data-i18n: вона вшита в скрипт як lang==='en' ? '…' : '…'. Літерали
// виконуються у vm, щоб escape-коди (’ в churches.dc.html) стали тими
// символами, які бачить відвідувач. Тернарник локалі дати ('en-US' : 'uk-UA')
// — параметр форматування, а не текст, тому відкидається.
export function readScriptTernaries(pageFile) {
  const ternary = /lang\s*===?\s*'en'\s*\?\s*('(?:[^'\\]|\\.)*')\s*:\s*('(?:[^'\\]|\\.)*')/g;

  return [...readLegacy(pageFile).matchAll(ternary)]
    .map(([, en, uk]) => ({ en: vm.runInNewContext(en), uk: vm.runInNewContext(uk) }))
    .filter(({ en }) => en !== 'en-US');
}

// Таблиця задана явно, бо localeCompare/normalize дають різні результати
// в різних збірках Node, а slug має бути стабільним назавжди: він стане URL.
const TRANSLIT = {
  а: 'a', б: 'b', в: 'v', г: 'h', ґ: 'g', д: 'd', е: 'e', є: 'ie', ж: 'zh', з: 'z',
  и: 'y', і: 'i', ї: 'i', й: 'i', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p',
  р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'kh', ц: 'ts', ч: 'ch', ш: 'sh',
  щ: 'shch', ь: '', ю: 'iu', я: 'ia', "'": '', '’': '',
};

export const slugifyName = (name) =>
  name
    .toLowerCase()
    .split('')
    .map((ch) => (ch in TRANSLIT ? TRANSLIT[ch] : ch))
    .join('')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
