import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { renderRichText } from '@storyblok/richtext';
import { renderRich } from '../src/lib/richtext-render.mjs';
import { docFromText } from '../src/lib/richtext.mjs';
import { FULL_DOC } from './helpers/richtext-full.js';

const uk = { base: '/', lang: 'uk' };
const text = (t, marks) => (marks ? { type: 'text', text: t, marks } : { type: 'text', text: t });
const para = (...content) => ({ type: 'paragraph', content });
const doc = (...content) => ({ type: 'doc', content });
const linked = (t, href, linktype = 'url') => text(t, [{ type: 'link', attrs: { href, linktype } }]);

test('бібліотека 5.5.2: текст екранується, javascript: і невідомий вузол проходять — межа безпеки в схемі', () => {
  const out = renderRichText(doc(
    para(text('<script>x</script>')),
    para(linked('клік', 'javascript:alert(1)')),
    { type: 'weird', content: [para(text('дитина'))] },
  ));
  assert.match(out, /&lt;script&gt;x&lt;\/script&gt;/);
  assert.ok(out.includes('href="javascript:alert(1)"'));
  assert.ok(out.includes('дитина'));
});

test('текст екранується так само, як в Astro', () => {
  assert.equal(
    renderRich(docFromText('<script>x</script> & "q" it\'s'), uk),
    '<p>&lt;script&gt;x&lt;/script&gt; &amp; &quot;q&quot; it&#39;s</p>',
  );
});

test('абзаци й марки; порожні абзаци не рендеряться', () => {
  const marks = { bold: 'strong', italic: 'em', underline: 'u', strike: 's', superscript: 'sup', subscript: 'sub', code: 'code' };
  for (const [mark, tag] of Object.entries(marks)) {
    assert.equal(renderRich(doc(para(text('т', [{ type: mark }]))), uk), `<p><${tag}>т</${tag}></p>`);
  }
  assert.equal(renderRich(doc(para(), para(text('а'))), uk), '<p>а</p>');
});

test('абзац лише з пробілів не рендериться (звичайний і inline)', () => {
  const d = doc(para(text(' ')), para(text('а')), para(text('  ')), para(text('б')));
  assert.equal(renderRich(d, uk), '<p>а</p><p>б</p>');
  assert.equal(renderRich(d, { ...uk, inline: true }), 'а<br>б');
  // пробіл усередині абзацу з розміткою лишається
  assert.equal(
    renderRich(doc(para(text('а', [{ type: 'bold' }]), text(' '), text('б'))), uk),
    '<p><strong>а</strong> б</p>',
  );
});

test('посилання: сторінка — з мовою й base, чужий сайт — у новій вкладці, адреса екранується', () => {
  const one = (href, linktype, opts = uk) => renderRich(doc(para(linked('т', href, linktype))), opts);
  assert.equal(one('/ministries/'), '<p><a class="rt-link" href="/ministries/">т</a></p>');
  assert.equal(
    one('/ministries/', 'url', { base: '/sub/', lang: 'en' }),
    '<p><a class="rt-link" href="/sub/en/ministries/">т</a></p>',
  );
  assert.equal(
    one('https://example.test/'),
    '<p><a class="rt-link" href="https://example.test/" target="_blank" rel="noopener noreferrer">т</a></p>',
  );
  assert.equal(one('mailto:a@example.test', 'email'), '<p><a class="rt-link" href="mailto:a@example.test">т</a></p>');
  assert.equal(
    one('https://example.test/?a="b"&c'),
    '<p><a class="rt-link" href="https://example.test/?a=&quot;b&quot;&amp;c" target="_blank" rel="noopener noreferrer">т</a></p>',
  );
});

test('адреса з лапкою не додає атрибутів ні в посиланні, ні в картинці', () => {
  const evil = 'https://x"onmouseover=alert(1)';
  const a = renderRich(doc(para(linked('т', evil))), uk);
  assert.ok(a.includes('href="https://x&quot;onmouseover=alert(1)"'), a);
  const img = renderRich(doc({ type: 'image', attrs: { src: evil, alt: 'a', title: 'b"c' } }), uk);
  assert.ok(img.includes('src="https://x&quot;onmouseover=alert(1)"'), img);
  for (const html of [a, img]) {
    const tag = html.match(/<(?:a|img)\b[^>]*>/)[0];
    // імена атрибутів — лише ті, що поставили ми; «onmouseover» не з'являється
    const names = [...tag.matchAll(/ ([a-z-]+)="[^"]*"/g)].map((m) => m[1]);
    assert.ok(!names.includes('onmouseover'), tag);
  }
});

test('заголовки 2–6, списки з order, цитата, лінія, код', () => {
  const item = (t) => ({ type: 'list_item', content: [para(text(t))] });
  for (const level of [2, 3, 4, 5, 6]) {
    assert.equal(
      renderRich(doc({ type: 'heading', attrs: { level }, content: [text('З')] }), uk),
      `<h${level} class="rt-h">З</h${level}>`,
    );
  }
  assert.equal(
    renderRich(doc({ type: 'ordered_list', attrs: { order: 3 }, content: [item('н')] }), uk),
    '<ol class="rt-list" start="3"><li><p>н</p></li></ol>',
  );
  assert.equal(renderRich(doc({ type: 'bullet_list', content: [item('п')] }), uk), '<ul class="rt-list"><li><p>п</p></li></ul>');
  assert.equal(renderRich(doc({ type: 'blockquote', content: [para(text('ц'))] }), uk), '<blockquote class="rt-quote"><p>ц</p></blockquote>');
  assert.equal(renderRich(doc({ type: 'horizontal_rule' }), uk), '<hr class="rt-hr">');
  assert.equal(
    renderRich(doc({ type: 'code_block', attrs: { class: 'language-js' }, content: [text('a<b')] }), uk),
    '<pre class="rt-code"><code class="language-js">a&lt;b</code></pre>',
  );
});

test('таблиця — в обгортці з прокруткою, colspan переноситься', () => {
  const html = renderRich(doc({
    type: 'table',
    content: [
      { type: 'tableRow', content: [{ type: 'tableHeader', content: [para(text('з'))] }] },
      { type: 'tableRow', content: [{ type: 'tableCell', attrs: { colspan: 2 }, content: [para(text('к'))] }] },
    ],
  }), uk);
  assert.ok(html.startsWith('<div class="rt-table"><table>') && html.endsWith('</table></div>'), html);
  assert.ok(html.includes('<th>'), html);
  assert.ok(html.includes('<td colspan="2">'), html);
});

test('картинка — під base, lazy, alt і title екрановані', () => {
  const html = renderRich(
    doc({ type: 'image', attrs: { src: 'uploads/cms/x.jpg', alt: 'a "b" <c>', title: 'т&т' } }),
    { base: '/sub/', lang: 'uk' },
  );
  assert.equal(
    html,
    '<img class="rt-img" src="/sub/uploads/cms/x.jpg" alt="a &quot;b&quot; &lt;c&gt;" title="т&amp;т" loading="lazy" decoding="async">',
  );
});

test('якір — span з id; емодзі — сам символ', () => {
  assert.equal(
    renderRich(doc(para(text('ціль', [{ type: 'anchor', attrs: { id: 'a-1' } }]), { type: 'emoji', attrs: { emoji: '🙂' } })), uk),
    '<p><span id="a-1">ціль</span>🙂</p>',
  );
});

test('inline: абзаци через <br>, без <p>', () => {
  assert.equal(renderRich(docFromText('Перший\n\nДругий'), { ...uk, inline: true }), 'Перший<br>Другий');
});

test('повні документи всіх рівнів рендеряться без винятків', () => {
  for (const level of ['rich', 'inline', 'card']) {
    const html = renderRich(FULL_DOC[level]('uk'), { ...uk, inline: level !== 'rich' });
    assert.ok(html.length > 0);
  }
});

test('renderRich і pickRich — лише в Rich.astro', () => {
  const walk = (dir) => readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
  const offenders = walk('src')
    .filter((p) => p.endsWith('.astro') && !p.endsWith('Rich.astro'))
    .filter((p) => /richtext-render|pickRich/.test(readFileSync(p, 'utf8')));
  assert.deepEqual(offenders, []);
});

test('якір над частково форматованою фразою: id лише на першому фрагменті', () => {
  // ProseMirror ріже «Привіт **світ**» на два текстові вузли з тією самою маркою якоря;
  // повторений id провалив би findDuplicateIds і весь деплой.
  const a = { type: 'anchor', attrs: { id: 'a-1' } };
  const html = renderRich(doc(para(text('Привіт ', [a]), text('світ', [a, { type: 'bold' }]))), uk);
  assert.equal((html.match(/id="a-1"/g) ?? []).length, 1, html);
  assert.ok(html.includes('світ'), html);
  // другий виклик починає з чистого аркуша: id знову на першому фрагменті
  assert.equal((renderRich(doc(para(text('x', [a]))), uk).match(/id="a-1"/g) ?? []).length, 1);
  // різні id — кожен по одному разу; inline-режим ділить лічильник між абзацами
  const b = { type: 'anchor', attrs: { id: 'b-2' } };
  const inl = renderRich(doc(para(text('a', [a])), para(text('b', [a]), text('c', [b]))), { ...uk, inline: true });
  assert.equal((inl.match(/id="a-1"/g) ?? []).length, 1, inl);
  assert.equal((inl.match(/id="b-2"/g) ?? []).length, 1, inl);
});
