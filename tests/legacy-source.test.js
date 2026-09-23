import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  readHobGlobals,
  readPageStrings,
  readDuplicateVariants,
  readLegacy,
  LEGACY_PAGES,
} from '../scripts/lib/legacy-source.mjs';

test('читає window.HOB_* із легасі-файлів даних', () => {
  const w = readHobGlobals([
    'ministries-data.js',
    'churches-data.js',
    'projects-data.js',
    'testimonies-data.js',
  ]);

  assert.equal(w.HOB_MINISTRIES.length, 18);
  assert.equal(w.HOB_CHURCHES.length, 6);
  assert.equal(w.HOB_PROJECTS.length, 4);
  assert.equal(w.HOB_TESTIMONIES.length, 6);
  assert.equal(w.HOB_MINISTRIES[0].id, 'bible-school');
});

test('галерея служінь доступна як функція і дає 4 слайди', () => {
  // Служіння — єдина колекція без media[] у джерелі: галерея генерується
  // функцією. Її треба саме викликати, інакше на Етапі 2 картинок не буде.
  const w = readHobGlobals(['ministries-data.js']);
  const media = w.HOB_ministryMedia(w.HOB_MINISTRIES[0]);

  assert.equal(media.length, 4);
  assert.equal(media[0].type, 'image');
  assert.equal(media[2].type, 'video');
  assert.ok(media[0].alt.length > 0, 'alt порожній — на Етапі 2 це буде картинка без опису');
});

test('читає пари uk/en з головної, зберігаючи розмітку всередині значення', () => {
  const strings = readPageStrings('index.html');

  assert.equal(strings.size, 101, 'очікували 100 data-i18n + cta.liveTitle');
  assert.equal(
    strings.get('hero.title').uk,
    'Церква <em>«Дім Хліба»</em><br>Кривий Ріг',
  );
  assert.equal(strings.get('hero.title').en, 'House of Bread Church<br><em>Kryvyi Rih</em>');
  assert.equal(strings.get('cta.liveTitle').uk, 'Дивитися пряму трансляцію');
});

test('той самий ключ на різних сторінках дає різні значення', () => {
  // page.title має шість різних значень. Плаский словник на 190 ключів
  // їх не вміщує — саме тому ключі перейменовуються, а не копіюються.
  assert.equal(
    readPageStrings('pastors.dc.html').get('page.title').uk,
    'Служителі церкви «Дім Хліба»',
  );
  // Легасі-джерело тут використовує ASCII-апостроф ('), а не типографський
  // (’): контент переноситься побайтово, тож перевіряємо саме той символ,
  // що реально лежить у churches.dc.html, а не "виправлений" варіант.
  assert.equal(
    readPageStrings('churches.dc.html').get('page.title').uk,
    "Церкви об'єднання «Дім Хліба»",
  );
});

test('кожна з десяти легасі-сторінок читається і має англійську для кожного ключа', () => {
  assert.equal(LEGACY_PAGES.length, 10);

  for (const page of LEGACY_PAGES) {
    const strings = readPageStrings(page);
    assert.ok(strings.size > 0, `${page}: жодного ключа`);
    for (const [key, pair] of strings) {
      assert.ok(pair.uk.length > 0, `${page}: ${key} без української`);
      assert.ok(pair.en.length > 0, `${page}: ${key} без англійської`);
    }
  }
});

test('дубльований ключ з різним текстом на сторінці не губиться мовчки', () => {
  // На головній con.addr стоїть на двох елементах з різним українським
  // текстом (контакти й підвал) — Map у readPageStrings лишає лише перше
  // входження, тому цей розбіжний варіант потрібно виявляти окремо, інакше
  // він тихо зникає ще до Етапу 2.
  const duplicates = readDuplicateVariants('index.html');

  assert.equal(duplicates.size, 1, 'очікували рівно один розбіжний ключ на головній');
  assert.deepEqual(duplicates.get('con.addr'), [
    'Кривий Ріг, вул. Федора Караманиць, 33 (Ватутіна)',
    'вул. Федора Караманиця, 33',
  ]);

  for (const page of LEGACY_PAGES) {
    if (page === 'index.html') continue;
    assert.equal(
      readDuplicateVariants(page).size,
      0,
      `${page}: не мало бути розбіжних дублікатів data-i18n`,
    );
  }
});

test('readLegacy нормалізує CRLF і одинокий CR до LF', () => {
  // Git на Windows (core.autocrlf=true) перезаписує \n на \r\n при кожному
  // новому чекауті файлу — worktree, куди легасі-сторінки потрапили одним
  // разом, і основний репозиторій, куди вони колись потрапили окремо, можуть
  // мати той самий блоб з різними символами кінця рядка на диску. Якщо не
  // нормалізувати тут, ця різниця тихо просочується у витягнутий контент
  // (innerHTML із внутрішнім переносом рядка) і ламає побайтову звірку між
  // машинами, хоча текст видимо однаковий.
  const raw = readLegacy('tests/fixtures/eol-fixture.html');

  assert.equal(raw, 'a\nb\nc\nd', 'CRLF і одинокий CR мають звестися до LF');
  assert.ok(!raw.includes('\r'), 'жодного \\r не повинно лишитися після читання');
});
