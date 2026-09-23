import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

const projectRoot = fileURLToPath(new URL('..', import.meta.url));

// Зіпсований запис кладеться у справжню теку колекції — інакше glob його не
// побачить, і тест перевіряв би не те. Прибирається у finally завжди.
function buildWith(entryFileName, entryData) {
  const entryPath = join(projectRoot, 'src/content/ministries', entryFileName);
  const outDir = mkdtempSync(join(tmpdir(), 'hob-schema-'));
  try {
    writeFileSync(entryPath, JSON.stringify(entryData), 'utf8');
    // execFileSync блокує event loop, тому таймаут самого test() (окремий
    // таймер на event loop) завислу збірку не перерве — потрібен власний
    // таймаут дочірнього процесу, інакше __probe.json лишиться назавжди.
    execFileSync(
      process.execPath,
      [join(projectRoot, 'node_modules/astro/astro.js'), 'build', '--outDir', outDir],
      { cwd: projectRoot, stdio: 'pipe', timeout: 90_000, killSignal: 'SIGKILL' },
    );
    return { failed: false, output: '' };
  } catch (error) {
    return { failed: true, output: `${error.stdout ?? ''}${error.stderr ?? ''}` };
  } finally {
    rmSync(entryPath, { force: true });
    rmSync(outDir, { recursive: true, force: true });
  }
}

const validMinistry = {
  slug: '__probe',
  icon: 'book',
  leader: 'Тест',
  phone: '+380000000000',
  name: { uk: 'Тест', en: 'Test' },
  summary: { uk: 'Тест', en: 'Test' },
  body: { uk: 'Тест', en: 'Test' },
  media: [{ type: 'image', src: 'https://example.test/a.jpg', alt: 'Тест' }],
  seo: { metaTitle: null, metaDescription: null, ogImage: null, noindex: false },
};

test('коректний запис збірку не ламає', { timeout: 120_000 }, () => {
  const { failed, output } = buildWith('__probe.json', validMinistry);
  assert.equal(failed, false, `валідний запис завалив збірку:\n${output}`);
});

test('невідома іконка валить збірку', { timeout: 120_000 }, () => {
  const { failed, output } = buildWith('__probe.json', { ...validMinistry, icon: 'rocket' });
  assert.equal(failed, true, 'збірка пройшла з іконкою поза списком 18');
  assert.match(output, /icon/i, 'у помилці не названо поле icon');
});

test('відсутній slug валить збірку', { timeout: 120_000 }, () => {
  const { slug, ...withoutSlug } = validMinistry;
  const { failed } = buildWith('__probe.json', withoutSlug);
  assert.equal(failed, true, 'збірка пройшла без slug');
});

test('порожній alt у галереї валить збірку', { timeout: 120_000 }, () => {
  const broken = {
    ...validMinistry,
    media: [{ type: 'image', src: 'https://example.test/a.jpg', alt: '' }],
  };
  const { failed } = buildWith('__probe.json', broken);
  assert.equal(failed, true, 'збірка пройшла з картинкою без опису');
});

test('локалізоване поле без англійської валить збірку', { timeout: 120_000 }, () => {
  const broken = { ...validMinistry, name: { uk: 'Тест', en: '' } };
  const { failed } = buildWith('__probe.json', broken);
  assert.equal(failed, true, 'збірка пройшла з порожнім перекладом');
});

test('голий YouTube-ID у відео збірку не ламає', { timeout: 120_000 }, () => {
  // Спека 1: video src приймає URL або ID. Схема не сміє звужувати до URL.
  const withBareId = {
    ...validMinistry,
    media: [{ type: 'video', src: 'ScMzIvxBSi4', alt: 'Відео' }],
  };
  const { failed, output } = buildWith('__probe.json', withBareId);
  assert.equal(failed, false, `голий ID відкинутий схемою:\n${output}`);
});
