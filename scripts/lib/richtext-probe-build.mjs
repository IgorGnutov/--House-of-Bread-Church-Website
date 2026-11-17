import { cpSync, mkdtempSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { ContentFixture, projectRoot } from '../../tests/helpers/build.js';
import { fillAll } from '../../tests/helpers/richtext-full.js';

// Проба для перегляду очима й для перевірки ширини на телефоні: кожне richtext-поле повного
// документа свого рівня. Контент — тимчасова копія, src/content не чіпається.
const outDir = process.argv[2];
if (!outDir) {
  console.error('Використання: node scripts/lib/richtext-probe-build.mjs <outDir>');
  process.exit(2);
}

const contentDir = mkdtempSync(join(tmpdir(), 'hob-probe-'));
try {
  cpSync(join(projectRoot, 'src/content'), contentDir, { recursive: true });
  fillAll(new ContentFixture(contentDir));
  execFileSync(process.execPath, [join(projectRoot, 'node_modules/astro/astro.js'), 'build', '--outDir', resolve(outDir)], {
    cwd: projectRoot,
    env: { ...process.env, BASE_PATH: '/', HOB_CONTENT_DIR: contentDir },
    stdio: 'inherit',
  });
} finally {
  rmSync(contentDir, { recursive: true, force: true });
}
