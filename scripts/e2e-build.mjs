// Знахідка 4: `npm run e2e` мусить збирати сайт із base «/» незалежно від
// того, що лежить у BASE_PATH оболонки (напр. лишилось після ручної
// перевірки збірки під підшлях GitHub Pages). tests/e2e/helpers.js завжди
// монтує dist у корінь статичного сервера; якщо збірка вийде з іншим base,
// усі внутрішні посилання поїдуть під підшлях, якого сервер не обслуговує,
// і e2e масово впаде на переходах/кліках. Звичайний `BASE_PATH=/ astro
// build` у package.json синтаксично різний для POSIX-шела й PowerShell —
// тому оточення виставляємо тут, у Node, без нової залежності.
//
// Спека 5: стрічки Facebook у git немає, тож e2e збирає з тимчасової копії
// контенту, де facebook/ — пости з фікстури (їхні картинки — закомічені
// файли public/uploads). src/content не змінюється.
import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const astroBin = join(root, 'node_modules/astro/astro.js');
const posts = JSON.parse(readFileSync(join(root, 'tests/fixtures/facebook-posts.json'), 'utf8'));

const contentDir = mkdtempSync(join(tmpdir(), 'hob-e2e-content-'));
let status = 1;
try {
  cpSync(join(root, 'src/content'), contentDir, { recursive: true });
  rmSync(join(contentDir, 'facebook'), { recursive: true, force: true });
  mkdirSync(join(contentDir, 'facebook'));
  for (const post of posts) writeFileSync(join(contentDir, 'facebook', `${post.id}.json`), JSON.stringify(post, null, 2));
  const result = spawnSync(process.execPath, [astroBin, 'build'], {
    stdio: 'inherit',
    env: { ...process.env, BASE_PATH: '/', HOB_CONTENT_DIR: contentDir },
  });
  status = result.status ?? 1;
} finally {
  rmSync(contentDir, { recursive: true, force: true });
}
process.exit(status);
