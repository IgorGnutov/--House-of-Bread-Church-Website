import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { BASE_PATH } from '../astro.config.mjs';
import { distPath } from './helpers/dist.js';
import { readPages } from './helpers/content.js';
import { withBuild } from './helpers/build.js';
import { isPageEnabled } from '../src/lib/pages.mjs';

test('наявність /about/, /contacts/, /donate/ у збірці й футері збігається з isPageEnabled', () => {
  // Знахідка 1: раніше тест жорстко очікував «нема ніде» — щойно замовник
  // вписав би прозу в pages.json, CI ламався б на самій ознаці роботи.
  // Тепер очікування рахуються з тих самих даних, що й сама збірка.
  const pages = readPages();
  const footer = readFileSync(distPath('index.html'), 'utf8');
  for (const id of ['about', 'contacts', 'donate']) {
    const enabled = isPageEnabled(pages[id]);
    assert.equal(existsSync(distPath(`${id}/index.html`)), enabled, `/${id}/: наявність сторінки не збігається з isPageEnabled`);
    assert.equal(existsSync(distPath(`en/${id}/index.html`)), enabled, `/en/${id}/: наявність сторінки не збігається з isPageEnabled`);
    assert.equal(new RegExp(`href="[^"]*/${id}/"`).test(footer), enabled, `футер: посилання на /${id}/ не збігається з isPageEnabled`);
  }
});

test('текст вмикає сторінку обома мовами і посилання у футері, а його відсутність — вимикає', { timeout: 180_000 }, () => {
  // Пробна збірка з копії контенту (helpers/build.js): справжній pages.json
  // не змінюється навіть на мить. Обидва стани задаємо явно — тест не
  // залежить від того, чи замовник уже заповнив якусь зі сторінок.
  withBuild((content) => content.editSingleton('pages', (pages) => {
    pages.about.body = { uk: 'Перший абзац.\n\nДругий абзац.', en: 'First paragraph.\n\nSecond.' };
    pages.contacts.body = null;
  }), ({ failed, output, outDir, page, fixture }) => {
    assert.equal(failed, false, output);
    const pages = JSON.parse(readFileSync(fixture.path('singletons', 'pages.json'), 'utf8'));
    for (const [lang, prefix] of [['uk', ''], ['en', 'en/']]) {
      const about = page(`${prefix}about/index.html`);
      assert.equal(about.querySelector('h1').text, pages.about.title[lang]);
      assert.equal(about.querySelectorAll('.prose p').length, 2, `${lang}: абзаци не розділені`);
      const home = page(`${prefix}index.html`);
      assert.equal(home.querySelectorAll('.footer-col')[0].querySelector('a').getAttribute('href'), `${BASE_PATH}${prefix}about/`);
      // Сторінка без тексту не генерується, а пункт футера веде на секцію головної.
      assert.equal(existsSync(join(outDir, `${prefix}contacts/index.html`)), false);
      assert.equal(home.querySelectorAll('.footer-col')[1].querySelectorAll('a')[2].getAttribute('href'), '#contacts');
    }
  });
});
