import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Після Етапу 5 джерело правди — Storyblok. Збірка main з src/content
// мовчки відкотила б сайт до стану репозиторію (Review Focus 1).
const workflow = readFileSync(fileURLToPath(new URL('../.github/workflows/deploy.yml', import.meta.url)), 'utf8');

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
