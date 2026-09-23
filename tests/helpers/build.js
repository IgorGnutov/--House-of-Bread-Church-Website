import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parse } from 'node-html-parser';

export const projectRoot = fileURLToPath(new URL('../..', import.meta.url));

// Тимчасова копія src/content, яку тест вільно псує: видаляє записи,
// спорожнює колекції, міняє одиночки. Справжній src/content тести не
// чіпають ніколи — навіть убитий посеред збірки прогін не лишить сміття в
// робочому дереві (content.config.ts читає HOB_CONTENT_DIR).
export class ContentFixture {
  constructor(dir) {
    this.dir = dir;
  }

  path(...parts) {
    return join(this.dir, ...parts);
  }

  files(collection) {
    if (!existsSync(this.path(collection))) return [];
    return readdirSync(this.path(collection)).filter((f) => f.endsWith('.json'));
  }

  read(collection, name) {
    return JSON.parse(readFileSync(this.path(collection, `${name}.json`), 'utf8'));
  }

  // Усі записи колекції (без імен файлів) — щоб будувати проби з реальних
  // даних, не знаючи конкретних slug.
  all(collection) {
    return this.files(collection).map((f) => JSON.parse(readFileSync(this.path(collection, f), 'utf8')));
  }

  write(collection, name, data) {
    mkdirSync(this.path(collection), { recursive: true });
    writeFileSync(this.path(collection, `${name}.json`), JSON.stringify(data, null, 2), 'utf8');
  }

  // Колекцію без записів у CI видно як відсутню теку (git не зберігає
  // порожніх тек) — проба відтворює саме це, а не порожню теку.
  clear(collection) {
    rmSync(this.path(collection), { recursive: true, force: true });
  }

  // Одиночка (singletons/<name>.json): mutate отримує весь обʼєкт файлу
  // ({ main: … } або записи pages) і змінює його на місці.
  editSingleton(name, mutate) {
    const file = this.path('singletons', `${name}.json`);
    const data = JSON.parse(readFileSync(file, 'utf8'));
    mutate(data);
    writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
  }
}

// Збирає сайт із копії контенту, зміненої prepare(), у тимчасову теку й
// передає результат у check(). Обидві теки прибираються у finally — навіть
// якщо prepare, збірка чи перевірки впали.
export function withBuild(prepare, check, { env = {}, timeout = 150_000 } = {}) {
  const contentDir = mkdtempSync(join(tmpdir(), 'hob-content-'));
  const outDir = mkdtempSync(join(tmpdir(), 'hob-dist-'));
  try {
    cpSync(join(projectRoot, 'src/content'), contentDir, { recursive: true });
    const fixture = new ContentFixture(contentDir);
    prepare(fixture);
    let result;
    try {
      // execFileSync блокує event loop, тож таймаут самого test() завислу
      // збірку не перерве — потрібен власний таймаут дочірнього процесу.
      execFileSync(
        process.execPath,
        [join(projectRoot, 'node_modules/astro/astro.js'), 'build', '--outDir', outDir],
        {
          cwd: projectRoot,
          env: { ...process.env, ...env, HOB_CONTENT_DIR: contentDir },
          stdio: 'pipe',
          timeout,
          killSignal: 'SIGKILL',
        },
      );
      result = { failed: false, output: '' };
    } catch (error) {
      result = { failed: true, output: `${error.stdout ?? ''}${error.stderr ?? ''}` };
    }
    return check({
      ...result,
      outDir,
      fixture,
      page: (rel) => parse(readFileSync(join(outDir, rel), 'utf8')),
    });
  } finally {
    rmSync(contentDir, { recursive: true, force: true });
    rmSync(outDir, { recursive: true, force: true });
  }
}
