import { test } from 'node:test';
import assert from 'node:assert/strict';
import { portCss } from '../scripts/port-legacy-css.mjs';

const legacy = [
  '<style>',                                                              // 1
  '.eyebrow{margin:0}',                                                   // 2
  '.lang-toggle{display:inline-flex}',                                    // 3
  '.lang-toggle button{border:none;font-size:.8rem;',                     // 4
  '  min-height:34px}',                                                   // 5
  '.lang-toggle button.is-active{background:#fff}',                       // 6
  '.slider{overflow:hidden}',                                             // 7
  '.slider-stage{aspect-ratio:16/10}',                                    // 8
  '.slide.is-active{opacity:1}',                                          // 9
  '.gal-arrow:hover{background:#fff}',                                    // 10
  '.info{display:block}',                                                 // 11
  '</style>',                                                             // 12
].join('\n');

test('бере рівно вказані рядки і пише походження', () => {
  const { css } = portCss(legacy, { from: 11, to: 11, origin: 'x.dc.html' });
  assert.equal(css, '/* Перенесено з x.dc.html, рядки 11–11. @font-face, :root і базові правила — у fonts/tokens/base.css. */\n.info{display:block}\n');
});

test('кнопки перемикача мов стають посиланнями з поведінкою кнопки', () => {
  const { css } = portCss(legacy, { from: 3, to: 6, origin: 'x' });
  assert.match(css, /\.lang-toggle a\{border:none;font-size:\.8rem;\n {2}min-height:34px;display:inline-flex;align-items:center;justify-content:center;line-height:normal\}/);
  assert.match(css, /\.lang-toggle a:hover\{color:rgba\(255,255,255,\.7\)\}/);
  assert.match(css, /\.lang-toggle a\.is-active,\.lang-toggle a\.is-active:hover\{background:#fff\}/);
  assert.doesNotMatch(css, /button/);
});

test('правила галереї вирізаються, решта лишається', () => {
  const { css, removed } = portCss(legacy, { from: 7, to: 11, origin: 'x', stripGallery: true });
  assert.equal(removed, 4);
  assert.doesNotMatch(css, /slide|gal-arrow/);
  assert.match(css, /\.info\{display:block\}/);
});

test('перевизначення --maxw і ресет ul додаються на початок', () => {
  const { css } = portCss(legacy, { from: 11, to: 11, origin: 'x', maxw: '1200px', keepUl: true });
  assert.match(css, /\*\/\n:root\{--maxw:1200px\}\nul\{margin:0;padding:0;list-style:none\}\n\.info/);
});
