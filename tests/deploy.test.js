import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Після Етапу 5 джерело правди — Storyblok. Збірка main з src/content
// мовчки відкотила б сайт до стану репозиторію (Review Focus 1).
const workflow = readFileSync(fileURLToPath(new URL('../.github/workflows/deploy.yml', import.meta.url)), 'utf8').replace(/\r\n/g, '\n');

test('кожна збірка main бере опублікований контент зі Storyblok до npm test', () => {
  const pull = workflow.indexOf('run: npm run cms:pull');
  const gate = workflow.indexOf('run: npm test');
  assert.ok(pull > 0, 'немає кроку npm run cms:pull');
  assert.ok(gate > pull, 'cms:pull має йти перед npm test');
  assert.match(workflow, /STORYBLOK_PUBLIC_TOKEN:\s*\$\{\{\s*secrets\.STORYBLOK_PUBLIC_TOKEN\s*\}\}/);
});

test('вебхук публікації може запустити деплой', () => {
  assert.match(workflow, /^\s{2}workflow_dispatch:/m);
});

test('у CI немає токенів запису чи чернеток', () => {
  assert.doesNotMatch(workflow, /MANAGEMENT_TOKEN|PREVIEW_TOKEN/);
});

// Відрізок workflow від кроку / завдання до наступного — щоб перевіряти env
// саме цього кроку, а не будь-якого у файлі.
function section(start, end) {
  const i = workflow.indexOf(start);
  assert.ok(i >= 0, `немає «${start.trim()}»`);
  const rest = workflow.slice(i + start.length);
  const j = rest.search(end);
  return j < 0 ? rest : rest.slice(0, j);
}
const step = (name) => section(`- name: ${name}`, /\n {6}- /);
const job = (name) => section(`\n  ${name}:\n`, /\n {2}[a-z][a-z-]*:\n/);

// Рішення 19: копія — той самий контент і код, що пройшли npm test, інша
// лише адреса. Дубль основного сайту закритий від індексації.
test('копія на Cloudflare збирається після npm test: корінь, своя адреса, noindex', () => {
  assert.ok(workflow.indexOf('- name: Build Cloudflare Pages copy') > workflow.indexOf('run: npm test'), 'копія — лише після npm test');
  const build = step('Build Cloudflare Pages copy');
  assert.match(build, /if: vars\.CLOUDFLARE_PROJECT != ''/);
  assert.match(build, /BASE_PATH: \/\n/);
  assert.match(build, /SITE_NOINDEX: 'true'/);
  assert.match(build, /SITE_URL: \$\{\{ vars\.CLOUDFLARE_SITE_URL \}\}/);
  assert.match(build, /run: npx astro build --outDir dist-cloudflare/);
});

test('деплой копії — окреме завдання: збій Cloudflare не блокує GitHub Pages', () => {
  const copy = job('deploy-cloudflare');
  assert.match(copy, /needs: build/);
  assert.match(copy, /if: vars\.CLOUDFLARE_PROJECT != ''/);
  assert.match(copy, /apiToken: \$\{\{ secrets\.CLOUDFLARE_API_TOKEN \}\}/);
  assert.match(copy, /pages deploy dist-cloudflare --project-name=\$\{\{ vars\.CLOUDFLARE_PROJECT \}\} --branch=main/);
  assert.doesNotMatch(job('deploy'), /deploy-cloudflare/);
});

// Спека 5: стрічка Facebook. Деплой через Facebook не падає ніколи: крок
// fb:pull лише передає код виходу, кеш тримає останній добрий знімок, а
// сигнал власнику — окрема задача після деплою.
test('fb:pull іде після cms:pull і до npm test, сам не падає, передає код виходу', () => {
  const fb = step('Pull Facebook feed');
  assert.ok(workflow.indexOf('- name: Pull Facebook feed') > workflow.indexOf('run: npm run cms:pull'), 'fb:pull — після cms:pull');
  assert.ok(workflow.indexOf('- name: Pull Facebook feed') < workflow.indexOf('run: npm test'), 'fb:pull — до npm test');
  assert.match(fb, /id: fb\n/);
  assert.match(fb, /FACEBOOK_PAGE_TOKEN: \$\{\{ secrets\.FACEBOOK_PAGE_TOKEN \}\}/);
  assert.match(fb, /FACEBOOK_PAGE_ID: \$\{\{ vars\.FACEBOOK_PAGE_ID \}\}/);
  assert.match(fb, /set \+e\n\s*npm run fb:pull\n\s*echo "code=\$\?" >> "\$GITHUB_OUTPUT"/);
  assert.doesNotMatch(fb, /continue-on-error/, 'крок має завершуватися успішно сам, а не ховати помилку');
});

test('знімок стрічки: код 0 або 2 — зберегти, код 1 — відновити останній, обидва до npm test', () => {
  const save = step('Save Facebook feed snapshot');
  const restore = step('Restore last Facebook feed snapshot');
  assert.match(save, /if: steps\.fb\.outputs\.code != '1'/);
  assert.match(save, /uses: actions\/cache\/save@v4/);
  assert.match(save, /key: facebook-feed-\$\{\{ github\.run_id \}\}/);
  assert.match(restore, /if: steps\.fb\.outputs\.code == '1'/);
  assert.match(restore, /uses: actions\/cache\/restore@v4/);
  assert.match(restore, /restore-keys: facebook-feed-\n/);
  for (const part of [save, restore]) {
    assert.match(part, /src\/content\/facebook\n/);
    assert.match(part, /public\/uploads\/facebook\n/);
  }
  const gate = workflow.indexOf('run: npm test');
  assert.ok(workflow.indexOf('- name: Save Facebook feed snapshot') < gate);
  assert.ok(workflow.indexOf('- name: Restore last Facebook feed snapshot') < gate);
});

test('задача facebook-feed — після деплою, завжди, падає при коді ≠ 0', () => {
  assert.match(job('build'), /outputs:\n\s+facebook: \$\{\{ steps\.fb\.outputs\.code \}\}/);
  const feed = job('facebook-feed');
  assert.match(feed, /needs: \[build, deploy\]/);
  assert.match(feed, /if: always\(\)/);
  assert.match(feed, /CODE: \$\{\{ needs\.build\.outputs\.facebook \}\}/);
  assert.match(feed, /"\$CODE" != "0"/);
  assert.match(feed, /exit 1/);
  assert.doesNotMatch(job('deploy'), /facebook/, 'деплой не чекає на Facebook');
});
