import { test } from 'node:test';
import assert from 'node:assert/strict';
import { schemas } from '../src/lib/schema.mjs';
import { formatPostDate, isWide, linkify, postDateTime, sortPosts, splitPost } from '../src/lib/facebook.mjs';

// Логіка картки поста Facebook (Спека 5): пост — чужий текст однією мовою,
// без заголовка, з голими посиланнями й датою в UTC.

test('splitPost: заголовок — перший непорожній рядок, опис — решта через пробіл', () => {
  assert.deepEqual(splitPost(''), { title: null, body: null });
  assert.deepEqual(splitPost('  \n \n'), { title: null, body: null });
  assert.deepEqual(splitPost('Один рядок'), { title: 'Один рядок', body: null });
  assert.deepEqual(splitPost('\n\n  Заголовок \n\nПерший\r\n  \nДругий  '), { title: 'Заголовок', body: 'Перший Другий' });
});

test('linkify: екранує текст, робить клікабельними лише http(s)', () => {
  assert.equal(linkify('<b>Тиша</b> & <3'), '&lt;b&gt;Тиша&lt;/b&gt; &amp; &lt;3');
  assert.equal(
    linkify('Дивіться https://example.com/a?b=1&c=2.'),
    'Дивіться <a href="https://example.com/a?b=1&amp;c=2" target="_blank" rel="noopener noreferrer">https://example.com/a?b=1&amp;c=2</a>.',
  );
  assert.equal(linkify('javascript:alert(1)'), 'javascript:alert(1)');
  assert.equal(linkify('ftp://x.y'), 'ftp://x.y');
  assert.equal(linkify('без посилань'), 'без посилань');
});

test('linkify: кінцеві розділові знаки лишаються поза посиланням, посилань кілька', () => {
  const html = linkify('(http://a.test/x), «https://b.test/y»!? кінець');
  assert.match(html, /^\(<a href="http:\/\/a\.test\/x"[^>]*>http:\/\/a\.test\/x<\/a>\), «<a href="https:\/\/b\.test\/y"[^>]*>https:\/\/b\.test\/y<\/a>»!\? кінець$/);
  assert.equal((linkify('https://a.test/1 і https://a.test/2; https://a.test/3...').match(/<a /g) ?? []).length, 3);
});

test('linkify: лапки в адресі не виходять з атрибута', () => {
  assert.equal(
    linkify('https://a.test/"onmouseover="x'),
    '<a href="https://a.test/" target="_blank" rel="noopener noreferrer">https://a.test/</a>&quot;onmouseover=&quot;x',
  );
});

test('formatPostDate: київська дата мовою сторінки, без «р.»', () => {
  // 22:30 UTC 29 вересня — у Києві (UTC+3) вже 30-те.
  assert.equal(formatPostDate('2026-09-29T22:30:09+0000', 'uk'), '30 вересня 2026');
  assert.equal(formatPostDate('2026-09-29T22:30:09+0000', 'en'), '30 September 2026');
  assert.equal(formatPostDate('2026-09-29T20:30:09+0000', 'uk'), '29 вересня 2026');
  // Взимку зсув +2: 21:30 UTC — ще той самий день, 22:30 — уже наступний.
  assert.equal(formatPostDate('2027-01-14T21:30:00+0000', 'uk'), '14 січня 2027');
  assert.equal(formatPostDate('2027-01-14T22:30:00+0000', 'uk'), '15 січня 2027');
});

test('isWide: від 1.5 — широке', () => {
  assert.equal(isWide({ width: 1600, height: 900 }), true);
  assert.equal(isWide({ width: 1500, height: 1000 }), true);
  assert.equal(isWide({ width: 1200, height: 900 }), false);
  assert.equal(isWide({ width: 576, height: 1280 }), false);
});

test('sortPosts: новіші першими, на рівних датах — за id; вхід не змінюється', () => {
  const posts = [
    { id: '1_1', date: '2026-09-28T10:00:00+0000' },
    { id: '1_3', date: '2026-09-29T10:00:00+0000' },
    { id: '1_2', date: '2026-09-29T13:00:00+0300' },
  ];
  assert.deepEqual(sortPosts(posts).map((p) => p.id), ['1_2', '1_3', '1_1']);
  assert.equal(posts[0].id, '1_1');
});

test('postDateTime: валідний для <time datetime>', () => {
  assert.equal(postDateTime('2026-09-29T10:00:09+0000'), '2026-09-29T10:00:09.000Z');
});

const post = (extra = {}) => ({
  id: '238298299705573_1515024300669995',
  date: '2026-09-29T10:00:09+0000',
  url: 'https://www.facebook.com/1266500102189084/posts/1515024300669995',
  text: 'Текст',
  video: false,
  image: { src: 'uploads/facebook/238298299705573_1515024300669995.jpg', width: 576, height: 1280 },
  ...extra,
});
const valid = (data) => schemas.facebook.safeParse(data).success;

test('схема поста: цілісність id, дати, адреси й картинки', () => {
  assert.equal(valid(post()), true);
  assert.equal(valid(post({ image: null, text: '' })), true, 'порожній текст і пост без картинки валідні');
  // Свідомий виняток: розмітка в чужому пості — просто текст, шаблон екранує.
  assert.equal(valid(post({ text: '<b>Тиша</b> <3 <script>x</script>' })), true);
  assert.equal(valid(post({ date: '2026-09-29T10:00:09Z' })), true);
  for (const id of ['1515024300669995', '238_x', '../x_1', '1_2/..', '']) assert.equal(valid(post({ id })), false, id);
  for (const date of ['2026-09-29', 'вчора', '2026-13-45T10:00:00+0000']) assert.equal(valid(post({ date })), false, date);
  for (const url of ['http://www.facebook.com/x', 'https://evil.test/x', 'https://www.facebook.com.evil.test/x']) {
    assert.equal(valid(post({ url })), false, url);
  }
  for (const image of [
    { src: '/uploads/facebook/a.jpg', width: 1, height: 1 },
    { src: 'https://scontent.xx.fbcdn.net/a.jpg', width: 1, height: 1 },
    { src: 'uploads/facebook/a.jpg', width: 0, height: 1 },
    { src: 'uploads/facebook/a.jpg', width: 1.5, height: 1 },
    { src: 'uploads/facebook/a.jpg', width: 1 },
  ]) assert.equal(valid(post({ image })), false, JSON.stringify(image));
  assert.equal(valid({ ...post(), extra: 1 }), false, 'невідомий ключ');
  assert.equal(valid({ ...post(), video: 'yes' }), false);
});
