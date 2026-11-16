// Рендер richtext-документа Storyblok у HTML. Межа безпеки — схема (allowlist вузлів, марок і
// адрес); тут лише розмітка. Бібліотека передає атрибути в рендерери сирими, а схемні шаблони
// адрес допускають `"`, `<`, `>` — тож кожне значення атрибута екранує власна attr().
import { renderRichText } from '@storyblok/richtext';
import { linkHref, isExternal, assetUrl } from './paths.mjs';

// Сирі значення в атрибут: без цього `https://x"onmouseover=alert(1)` додав би новий атрибут.
const attr = (value) => String(value)
  .replace(/&/g, '&amp;')
  .replace(/"/g, '&quot;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;');

const attrs = (pairs) => pairs
  .filter(([, v]) => v !== undefined && v !== null && v !== '')
  .map(([k, v]) => ` ${k}="${attr(v)}"`)
  .join('');

const cell = (tag) => (node) => `<${tag}${attrs([
  ['colspan', node.attrs?.colspan],
  ['rowspan', node.attrs?.rowspan],
])}>${node.children}</${tag}>`;

function renderers({ base, lang, inline }) {
  return {
    link: (node) => {
      const url = node.attrs.href;
      const external = isExternal(url);
      return `<a${attrs([
        ['class', 'rt-link'],
        ['href', linkHref(base, lang, url)],
        ['target', external ? '_blank' : undefined],
        ['rel', external ? 'noopener noreferrer' : undefined],
      ])}>${node.children}</a>`;
    },
    // Порожній абзац (Enter у редакторі) — не розмітка, а відступ, який дає CSS.
    paragraph: (node) => (node.children === '' ? '' : (inline ? node.children : `<p>${node.children}</p>`)),
    heading: (node) => `<h${node.attrs.level} class="rt-h">${node.children}</h${node.attrs.level}>`,
    bullet_list: (node) => `<ul class="rt-list">${node.children}</ul>`,
    ordered_list: (node) => `<ol${attrs([['class', 'rt-list'], ['start', node.attrs?.order]])}>${node.children}</ol>`,
    blockquote: (node) => `<blockquote class="rt-quote">${node.children}</blockquote>`,
    horizontal_rule: () => '<hr class="rt-hr">',
    code_block: (node) => `<pre class="rt-code"><code${attrs([['class', node.attrs?.class]])}>${node.children}</code></pre>`,
    // Обгортка дає горизонтальну прокрутку широкої таблиці на телефоні.
    table: (node) => `<div class="rt-table"><table>${node.children}</table></div>`,
    tableHeader: cell('th'),
    tableCell: cell('td'),
    image: (node) => `<img${attrs([
      ['class', 'rt-img'],
      ['src', assetUrl(base, node.attrs.src)],
      ['alt', node.attrs.alt ?? ''],
      ['title', node.attrs.title],
    ])} loading="lazy" decoding="async">`,
    anchor: (node) => `<span${attrs([['id', node.attrs.id]])}>${node.children}</span>`,
    emoji: (node) => attr(node.attrs.emoji),
  };
}

// Апостроф бібліотека пише як &#039;, Astro — як &#39;: один вигляд у всьому HTML.
const unify = (html) => html.replace(/&#039;/g, '&#39;');

export function renderRich(doc, { base, lang, inline = false }) {
  const opts = { renderers: renderers({ base, lang, inline }) };
  const html = inline
    ? (doc.content ?? [])
      .map((node) => renderRichText({ type: 'doc', content: [node] }, opts))
      .filter((part) => part !== '')
      .join('<br>')
    : renderRichText(doc, opts);
  return unify(html ?? '');
}
