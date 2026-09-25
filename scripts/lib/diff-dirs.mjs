import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

const walk = (dir) => readdirSync(dir, { withFileTypes: true })
  .flatMap((e) => (e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]));

// Дві збірки файл у файл. Одна перевірка на два питання: «сторінки не
// відрізняються від версії на файлах» (Спека 3) і «рефакторинг не змінив
// виходу» (Задачі 5, 7, 8 плану Етапу 5).
export function diffDirs(a, b) {
  const files = (root) => new Set(walk(root).map((f) => relative(root, f).split(sep).join('/')));
  const left = files(a);
  const right = files(b);
  const out = [];
  for (const f of [...new Set([...left, ...right])].sort()) {
    if (!right.has(f)) out.push(`${f}: є лише в ${a}`);
    else if (!left.has(f)) out.push(`${f}: є лише в ${b}`);
    else if (!readFileSync(join(a, f)).equals(readFileSync(join(b, f)))) out.push(`${f}: вміст відрізняється`);
  }
  return out;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [a, b] = process.argv.slice(2);
  const diffs = diffDirs(a, b);
  for (const d of diffs) console.log(`✗ ${d}`);
  console.log(diffs.length > 0 ? `Відмінностей: ${diffs.length}.` : 'Збірки однакові.');
  process.exitCode = diffs.length > 0 ? 1 : 0;
}
