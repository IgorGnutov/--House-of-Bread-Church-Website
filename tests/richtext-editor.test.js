// Документ зі справжнього редактора Storyblok (фікстура знята скриптом richtext-probe).
// Власник вставив один і той самий документ у три поля, тож рівень rich має його прийняти,
// а inline і card — відхилити блоки з чітким поясненням.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { localizedRich, localizedRichInline, localizedRichCard } from '../src/lib/schema.mjs';
import { normalizeDoc, richPlain } from '../src/lib/richtext.mjs';
import { renderRich } from '../src/lib/richtext-render.mjs';
import { TOOLBAR } from '../src/lib/storyblok/model.mjs';

const FIXTURE = JSON.parse(readFileSync(new URL('./fixtures/storyblok-richtext-probe.json', import.meta.url), 'utf8'));
const SCHEMAS = { rich: localizedRich, inline: localizedRichInline, card: localizedRichCard };
const resolveStory = () => '/ministries/probe/';
const normalized = (level) => normalizeDoc(FIXTURE[level], { resolveStory });

// Прибирає вузли за умовою на будь-якій глибині.
function without(node, drop) {
  if (!node || typeof node !== 'object') return node;
  const out = { ...node };
  if (Array.isArray(node.content)) out.content = node.content.filter((n) => !drop(n)).map((n) => without(n, drop));
  return out;
}
const check = (schema, d) => schema.safeParse({ uk: d, en: d });
const messages = (r) => r.error.issues.map((i) => i.message);

test('документ з редактора: основний текст проходить схему, крім очікуваної картинки без опису', () => {
  const d = normalized('rich');
  const full = check(SCHEMAS.rich, d);
  assert.equal(full.success, false);
  assert.ok(messages(full).every((m) => /опису/.test(m)), messages(full).join('\n'));
  const noBareImage = without(d, (n) => n.type === 'image' && !n.attrs?.alt);
  const r = check(SCHEMAS.rich, noBareImage);
  assert.ok(r.success, JSON.stringify(r.error?.issues));
});

test('документ з редактора: inline і card відхиляють блоки з поясненням «лише в основному тексті»', () => {
  for (const level of ['inline', 'card']) {
    const r = check(SCHEMAS[level], normalized(level));
    assert.equal(r.success, false, level);
    assert.ok(messages(r).some((m) => /лише в основному тексті/.test(m)), level + ': ' + messages(r).join('\n'));
  }
});

test('нормалізація ідемпотентна на справжньому документі й не лишає шуму редактора', () => {
  for (const level of ['rich', 'inline', 'card']) {
    const once = normalized(level);
    assert.deepEqual(normalizeDoc(once, { resolveStory }), once, level);
    const json = JSON.stringify(once);
    for (const noise of ['textAlign', 'backgroundColor', 'fallbackImage', 'meta_data', 'copyright', '"uuid"', '"target"', '"anchor":null']) {
      assert.ok(!json.includes(noise), `${level}: лишився «${noise}»`);
    }
  }
});

test('нормалізація: посилання з редактора — пошта з mailto:, сторінка за uuid, файл і адреса як є', () => {
  const links = [];
  const walk = (n) => {
    for (const m of n.marks ?? []) if (m.type === 'link') links.push(m.attrs.href);
    (n.content ?? []).forEach(walk);
  };
  walk(normalized('rich'));
  assert.deepEqual(links, [
    '/ministries/probe/',
    'https://google.com',
    'mailto:probe@example.com',
    'https://a.storyblok.com/f/295441376813729/4528x3016/13a393b863/dsc_0561.JPG',
  ]);
});

test('рендер справжнього документа: кожен текст потрапляє в розмітку', () => {
  const d = normalized('rich');
  const html = renderRich(d, { base: '/', lang: 'uk' });
  const visible = html.replace(/<[^>]*>/g, '').replace(/&#39;/g, "'");
  const texts = [];
  const walk = (n) => {
    if (typeof n.text === 'string') texts.push(n.text);
    (n.content ?? []).forEach(walk);
  };
  walk(d);
  for (const t of texts) assert.ok(visible.includes(t), `у HTML немає тексту «${t}»`);
  // richPlain бачить ті самі абзаци, що й рендер (код і картинки в опис не йдуть)
  for (const block of richPlain(d).split('\n\n')) assert.ok(visible.includes(block.slice(0, 20)), block);
});

test('TOOLBAR збігається з кнопками, які показала форма редактора', () => {
  for (const level of ['rich', 'inline', 'card']) {
    assert.deepEqual(FIXTURE.toolbarSeen[level], TOOLBAR[level], level);
  }
});
