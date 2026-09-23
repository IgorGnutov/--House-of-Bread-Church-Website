// Знахідка 4: `npm run e2e` мусить збирати сайт із base «/» незалежно від
// того, що лежить у BASE_PATH оболонки (напр. лишилось після ручної
// перевірки збірки під підшлях GitHub Pages). tests/e2e/helpers.js завжди
// монтує dist у корінь статичного сервера; якщо збірка вийде з іншим base,
// усі внутрішні посилання поїдуть під підшлях, якого сервер не обслуговує,
// і e2e масово впаде на переходах/кліках. Звичайний `BASE_PATH=/ astro
// build` у package.json синтаксично різний для POSIX-шела й PowerShell —
// тому оточення виставляємо тут, у Node, без нової залежності.
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const astroBin = fileURLToPath(new URL('../node_modules/astro/astro.js', import.meta.url));
const result = spawnSync(process.execPath, [astroBin, 'build'], {
  stdio: 'inherit',
  env: { ...process.env, BASE_PATH: '/' },
});
process.exit(result.status ?? 1);
