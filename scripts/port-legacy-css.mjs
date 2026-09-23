// Переносить <style> легасі-сторінки в src/styles/pages/*.css дослівно.
// Скрипт, а не руки: 10 файлів по сотні рядків — гарантовані одруки, а
// піксельне порівняння ловить їх лише post factum. Видаляється разом із
// легасі в кутовері (Задача 15).
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Правила галереї, що переїжджають у src/styles/gallery.css. У легасі кожне
// — один рядок, тож вирізаємо порядково.
const GALLERY_RULE =
  /^\.(gallery|gallery-stage|gal-arrow|slider|slider-stage|slider-arrow|slide|dots|thumbs)[ .:{].*$\n?/gm;

export function portCss(source, { from, to, origin, maxw = null, keepUl = false, stripGallery = false }) {
  let css = source.split('\n').slice(from - 1, to).join('\n');

  // Перемикач мов тепер посилання (Спека 2). Три додані властивості
  // відтворюють те, що кнопці дає браузер: центрування вмісту,
  // line-height:normal (інакше +0.6px висоти) і відсутність кольору
  // при наведенні (глобальне a:hover інакше перефарбувало б текст).
  css = css.replace(/\.lang-toggle button\{([^}]*)\}/g, (_, body) =>
    `.lang-toggle a{${body.trimEnd()};display:inline-flex;align-items:center;justify-content:center;line-height:normal}\n`
    + '.lang-toggle a:hover{color:rgba(255,255,255,.7)}');
  css = css.replace(/\.lang-toggle button\.is-active\{/g, '.lang-toggle a.is-active,.lang-toggle a.is-active:hover{');

  let removed = 0;
  if (stripGallery) {
    css = css.replace(GALLERY_RULE, () => {
      removed += 1;
      return '';
    });
  }

  const head = [
    `/* Перенесено з ${origin}, рядки ${from}–${to}. @font-face, :root і базові правила — у fonts/tokens/base.css. */`,
    maxw && `:root{--maxw:${maxw}}`,
    keepUl && 'ul{margin:0;padding:0;list-style:none}',
  ].filter(Boolean);
  return { css: `${head.join('\n')}\n${css.replace(/\s+$/, '')}\n`, removed };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [file, from, to, out, ...flags] = process.argv.slice(2);
  const flag = (name) => flags.includes(name);
  const maxwAt = flags.indexOf('--maxw');
  const { css, removed } = portCss(readFileSync(file, 'utf8').replace(/\r\n?/g, '\n'), {
    from: Number(from),
    to: Number(to),
    origin: file,
    maxw: maxwAt === -1 ? null : flags[maxwAt + 1],
    keepUl: flag('--keep-ul'),
    stripGallery: flag('--strip-gallery'),
  });
  writeFileSync(out, css);
  console.log(`${out}: ${css.split('\n').length} рядків${flag('--strip-gallery') ? `, правил галереї вирізано: ${removed}` : ''}`);
}
