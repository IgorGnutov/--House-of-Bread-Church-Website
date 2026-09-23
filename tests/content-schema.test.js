import { before, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

const projectRoot = fileURLToPath(new URL('..', import.meta.url));

// finally не виконується, якщо процес убили (Ctrl+C, SIGKILL раннера), —
// тоді __probe*.json лишається в колекції і ламає всі наступні збірки,
// зокрема перший тест цього файлу. Прибираємо залишки до старту.
before(() => {
  for (const collection of ['ministries', 'leader-resources', 'projects']) {
    const dir = join(projectRoot, 'src/content', collection);
    for (const name of readdirSync(dir).filter((f) => /^__probe.*\.json$/.test(f))) {
      rmSync(join(dir, name), { force: true });
    }
  }
});

// Зіпсований запис кладеться у справжню теку колекції — інакше glob його не
// побачить, і тест перевіряв би не те. Прибирається у finally завжди.
function buildWith(collection, entryFileName, entryData) {
  const entryPath = join(projectRoot, 'src/content', collection, entryFileName);
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
  order: 0,
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
  const { failed, output } = buildWith('ministries', '__probe.json', validMinistry);
  assert.equal(failed, false, `валідний запис завалив збірку:\n${output}`);
});

test('невідома іконка валить збірку', { timeout: 120_000 }, () => {
  const { failed, output } = buildWith('ministries', '__probe.json', { ...validMinistry, icon: 'rocket' });
  assert.equal(failed, true, 'збірка пройшла з іконкою поза списком 18');
  assert.match(output, /icon/i, 'у помилці не названо поле icon');
});

test('відсутній slug валить збірку', { timeout: 120_000 }, () => {
  const { slug, ...withoutSlug } = validMinistry;
  const { failed, output } = buildWith('ministries', '__probe.json', withoutSlug);
  assert.equal(failed, true, 'збірка пройшла без slug');
  assert.match(output, /slug/i, 'у помилці не названо поле slug');
});

test('порожній alt у галереї валить збірку', { timeout: 120_000 }, () => {
  const broken = {
    ...validMinistry,
    media: [{ type: 'image', src: 'https://example.test/a.jpg', alt: '' }],
  };
  const { failed, output } = buildWith('ministries', '__probe.json', broken);
  assert.equal(failed, true, 'збірка пройшла з картинкою без опису');
  assert.match(output, /alt/i, 'у помилці не названо поле alt');
});

test('невідомий ключ (одруківка в назві поля) валить збірку', { timeout: 120_000 }, () => {
  // Без .strict() zod мовчки викинув би "sumary", і збірка пройшла б
  // зі справжнім summary — одруківку ніхто б не помітив.
  const { failed, output } = buildWith('ministries', '__probe.json', { ...validMinistry, sumary: validMinistry.summary });
  assert.equal(failed, true, 'збірка пройшла з невідомим ключем');
  assert.match(output, /sumary/, 'у помилці не названо зайвий ключ');
});

test('локалізоване поле без англійської валить збірку', { timeout: 120_000 }, () => {
  const broken = { ...validMinistry, name: { uk: 'Тест', en: '' } };
  const { failed } = buildWith('ministries', '__probe.json', broken);
  assert.equal(failed, true, 'збірка пройшла з порожнім перекладом');
});

test('голий YouTube-ID у відео збірку не ламає', { timeout: 120_000 }, () => {
  // Спека 1: video src приймає URL або ID. Схема не сміє звужувати до URL.
  const withBareId = {
    ...validMinistry,
    media: [{ type: 'video', src: 'ScMzIvxBSi4', alt: 'Відео' }],
  };
  const { failed, output } = buildWith('ministries', '__probe.json', withBareId);
  assert.equal(failed, false, `голий ID відкинутий схемою:\n${output}`);
});

const validLink = {
  slug: '__probe',
  kind: 'link',
  order: 99,
  url: null,
  format: null,
  icon: 'book',
  title: { uk: 'Тест', en: 'Test' },
  description: { uk: 'Тест', en: 'Test' },
  meta: null,
};

test('посилання для лідерів без іконки валить збірку', { timeout: 120_000 }, () => {
  const { failed, output } = buildWith('leader-resources', '__probe.json', { ...validLink, icon: null });
  assert.equal(failed, true, 'збірка пройшла з посиланням без іконки');
  assert.match(output, /icon/, 'у помилці не названо поле icon');
});

test('відносний ctaUrl у стилі легасі валить збірку', { timeout: 120_000 }, () => {
  const probe = JSON.parse(readFileSync(join(projectRoot, 'src/content/projects/social-canteen.json'), 'utf8'));
  const { failed, output } = buildWith('projects', '__probe.json', {
    ...probe, slug: '__probe', order: 99, ctaUrl: 'index.html#contacts',
  });
  assert.equal(failed, true, 'збірка пройшла з index.html#contacts');
  assert.match(output, /ctaUrl/);
});
