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
