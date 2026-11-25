import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { href, loadPage } from './helpers/dist.js';
import { domText, readCollection, readPages, readSingleton, sortedData } from './helpers/content.js';
import { hasBranches, nextCyclic } from '../src/lib/collections.mjs';
import { withBuild } from './helpers/build.js';
import { branch, image, ministry } from './helpers/probes.js';
import { ytId } from '../src/lib/youtube.mjs';
import { fullTitle } from '../src/lib/seo.mjs';
import { plural, t } from './helpers/i18n.js';

// Усе — з даних: адмінка може додати, видалити чи переставити служіння.
const ministries = sortedData(readCollection('ministries'));
const page = readPages().ministries;
const settings = readSingleton('site-settings');
const LOCALES = [['uk', ''], ['en', 'en/']];

test('/ministries/ показує всі служіння в порядку order з посиланнями на деталі', () => {
  for (const [lang, prefix] of LOCALES) {
    const cards = loadPage(`${prefix}ministries/index.html`).querySelectorAll('.min-card');
    assert.equal(cards.length, ministries.length, lang);
    cards.forEach((card, i) => {
      assert.equal(card.getAttribute('href'), href(`${prefix}ministries/${ministries[i].slug}/`));
      assert.equal(card.querySelector('h3').text, ministries[i].name[lang]);
      assert.equal(card.querySelector('.min-body p').text, domText(ministries[i].summary[lang]));
      assert.ok(card.querySelector('.icon svg path, .icon svg circle, .icon svg rect'), `${ministries[i].slug}: без іконки`);
    });
  }
});

test('герой сторінки й лічильник беруться з даних обома мовами', () => {
  for (const [lang, prefix] of LOCALES) {
    const root = loadPage(`${prefix}ministries/index.html`);
    assert.equal(root.querySelector('.page-hero h1').text, page.title[lang]);
    assert.equal(root.querySelector('.page-hero .eyebrow')?.text, page.eyebrow?.[lang]);
    assert.equal(root.querySelector('.hero-count span').text, plural(lang, 'count.ministries', ministries.length));
  }
});

test('«назад» у шапці веде на секцію служінь головної тієї ж мови', () => {
  // Рішення 9: якір замість sessionStorage-повернення легасі.
  assert.equal(loadPage('ministries/index.html').querySelector('.back-link').getAttribute('href'), href('#ministries'));
  assert.equal(loadPage('en/ministries/index.html').querySelector('.back-link').getAttribute('href'), href('en/#ministries'));
  assert.equal(loadPage('en/ministries/index.html').querySelector('.site-footer a').getAttribute('href'), href('en/'));
});

test('кожне служіння має сторінку обома мовами з назвою, фактами й дзвінком', () => {
  for (const m of ministries) {
    for (const [lang, prefix] of LOCALES) {
      const root = loadPage(`${prefix}ministries/${m.slug}/index.html`);
      assert.equal(root.querySelector('h1').text, m.name[lang]);
      assert.equal(root.querySelector('.crumbs span').text, m.name[lang]);
      assert.equal(root.querySelector('.info h2').text, domText(m.summary[lang]));
      assert.equal(root.querySelector('.info .desc').text, domText(m.body[lang]));
      // Основний блок служіння — перший .info; з гілками його контакти не показуються (Спека 6).
      const main = root.querySelector('.info');
      if (hasBranches(m)) {
        assert.equal(main.querySelector('.facts'), null, m.slug);
        assert.equal(main.querySelector('.btn'), null, m.slug);
      } else {
        assert.equal(main.querySelector('.fact .val').text, m.leader);
        assert.equal(main.querySelector('.btn').getAttribute('href'), `tel:${m.phone.replace(/[^+\d]/g, '')}`);
      }
      // Рішення 1 (Етап 3): ручний суфікс «House of Bread Church» зникає — тепер
      // <title> будується SEO-компонентом, суфікс мовою сторінки.
      assert.equal(root.querySelector('title').text, m.seo.metaTitle?.[lang] ?? fullTitle(m.name[lang], settings.name[lang]));
      assert.equal(root.querySelectorAll('.crumbs a')[1].getAttribute('href'), href(`${prefix}ministries/`));
    }
  }
});

test('галерея: слайд на кожне медіа, перший активний, відео — лише ID без iframe', () => {
  for (const m of ministries) {
    // Галерея служіння — перша на сторінці; далі можуть іти галереї гілок.
    const root = loadPage(`ministries/${m.slug}/index.html`).querySelector('[data-gallery]');
    const slides = root.querySelectorAll('[data-slide]');
    assert.equal(slides.length, m.media.length, m.slug);
    assert.ok(slides[0].classList.contains('is-active'), m.slug);
    // Навігація — лише коли є куди гортати.
    const nav = m.media.length > 1 ? m.media.length : 0;
    assert.equal(root.querySelectorAll('[data-dot]').length, nav, m.slug);
    assert.equal(root.querySelectorAll('[data-thumb]').length, nav, m.slug);
    assert.equal(Boolean(root.querySelector('[data-next]')), nav > 0, m.slug);
    m.media.forEach((item, i) => {
      assert.equal(slides[i].getAttribute('data-video') ?? null, item.type === 'video' ? ytId(item.src) : null, `${m.slug}#${i}`);
    });
    // iframe YouTube важкий — вставляється скриптом лише для активного слайда.
    assert.equal(root.querySelectorAll('.slide iframe').length, 0);
  }
});

test('«Інші служіння» — наступні (до чотирьох) по колу, без поточного', () => {
  ministries.forEach((m, index) => {
    const root = loadPage(`ministries/${m.slug}/index.html`);
    const expected = nextCyclic(ministries, index, 4).map((x) => href(`ministries/${x.slug}/`));
    assert.deepEqual(root.querySelectorAll('.more-card').map((c) => c.getAttribute('href')), expected, m.slug);
    assert.ok(!expected.includes(href(`ministries/${m.slug}/`)), `${m.slug}: серед інших — він сам`);
    // Без інших служінь блоку немає зовсім, а не порожня сітка з заголовком.
    assert.equal(Boolean(root.querySelector('section.more')), expected.length > 0, m.slug);
  });
});

test('шапка й футер деталки ведуть до списку тієї ж мови', () => {
  for (const m of ministries) {
    const root = loadPage(`en/ministries/${m.slug}/index.html`);
    assert.equal(root.querySelector('.back-link').getAttribute('href'), href('en/ministries/'));
    assert.equal(root.querySelector('.site-footer a').getAttribute('href'), href('en/ministries/'));
  }
});

test('ministry.css: скидання відступу абзаців не перебиває 1rem між блоками тексту', () => {
  // Нульова специфічність скидання (:where) — інакше `.desc p{margin:0}` (0,2,1) виграє в
  // `.desc > * + *` (0,2,0), і сусідні абзаци злипаються. Однокрокові тіла цього не видно.
  const css = readFileSync(new URL('../src/styles/pages/ministry.css', import.meta.url), 'utf8');
  const reset = css.indexOf('.info .desc :where(p){margin:0}');
  const gap = css.indexOf('.info .desc > * + *{margin-top:1rem}');
  assert.ok(reset >= 0, 'скидання має бути через :where(p)');
  assert.ok(gap > reset, 'правило відступу — після скидання');
  assert.doesNotMatch(css, /\.info \.desc p\s*\{/);
});

test('гілки: розділ з назвою з CMS, слайдер і контакти кожної гілки; загальних контактів немає', { timeout: 180_000 }, () => {
  const title = { uk: 'Гілки', en: 'Branches' };
  const withBranches = ministry('branchy', { leader: null, phone: null, branches: { title, items: [
    branch('a', { media: [image('a1'), image('a2')], ctaUrl: 'https://example.test/join' }),
    branch('b', { phone: '+380 22 222-22-22' }),
  ] } });
  const empty = ministry('nobranch', { branches: { title, items: [] } });
  withBuild((c) => {
    c.write('ministries', 'branchy', withBranches);
    c.write('ministries', 'nobranch', empty);
  }, (dist) => {
    assert.equal(dist.failed, false, dist.output);
    for (const [lang, prefix] of LOCALES) {
      const root = dist.page(`${prefix}ministries/branchy/index.html`);
      assert.equal(root.querySelector('.branches-title').text, title[lang]);
      const items = root.querySelectorAll('.branch');
      assert.equal(items.length, 2);
      assert.equal(root.querySelectorAll('[data-gallery]').length, 3, 'служіння + 2 гілки');
      items.forEach((el, i) => {
        assert.equal(el.querySelector('h3').text, withBranches.branches.items[i].name[lang]);
        assert.equal(el.querySelector('.desc').text, 'Опис гілки');
      });
      assert.equal(items[0].querySelector('.btn').getAttribute('href'), 'https://example.test/join');
      assert.equal(items[0].querySelectorAll('[data-dot]').length, 2);
      assert.equal(items[1].querySelector('.btn').getAttribute('href'), 'tel:+380222222222');
      assert.equal(items[1].querySelector('.fact .val').text, 'Лідер гілки');
      assert.equal(items[1].querySelector('a.val').getAttribute('href'), 'tel:+380222222222');
      assert.equal(items[1].querySelectorAll('[data-dot]').length, 0, 'одне фото — без навігації');
      // Гілка — не служіння: підписи без «служіння», назва розділу редагована.
      assert.equal(items[1].querySelector('.fact .lbl').text, t(lang, 'fact.branchLeader'));
      assert.equal(items[1].querySelector('.btn span').text, t(lang, 'cta.joinBranch'));
      const main = root.querySelector('.info');
      assert.equal(main.querySelector('.facts'), null);
      assert.equal(main.querySelector('.btn'), null);
      const plain = dist.page(`${prefix}ministries/nobranch/index.html`);
      assert.equal(plain.querySelector('.branches'), null);
      assert.ok(plain.querySelector('.info .btn'));
    }
  });
});
