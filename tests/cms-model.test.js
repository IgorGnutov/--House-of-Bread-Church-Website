import { test } from 'node:test';
import assert from 'node:assert/strict';
import { z } from 'astro/zod';
import { localized, schemas } from '../src/lib/schema.mjs';
import { checkModel } from '../src/lib/storyblok/check.mjs';

// Модель Storyblok підпорядкована zod-схемі (Спека 3): нове поле в схемі
// без поля в моделі — червоний тест, а не поле, яке редактор не бачить.
const errorsFor = (collection, schema) => checkModel({ ...schemas, [collection]: schema });
const assertError = (errors, fragment) =>
  assert.ok(errors.some((e) => e.includes(fragment)), `немає помилки про «${fragment}»:\n${errors.join('\n')}`);

test('модель покриває схему рівно — без винятків', () => {
  assert.deepEqual(checkModel(), []);
});

test('нове поле в схемі без поля в моделі — помилка з повним шляхом', () => {
  assertError(errorsFor('ministries', schemas.ministries.extend({ extra: localized })), 'ministries (ministry).extra');
});

test('поле, якого вже немає в схемі, — помилка', () => {
  assertError(errorsFor('ministries', schemas.ministries.omit({ phone: true })), 'ministries (ministry).phone');
});

test('розбіжність optional/nullable видно', () => {
  assertError(errorsFor('ministries', schemas.ministries.extend({ leader: z.string().min(1).optional() })), '.leader: optional');
  assertError(errorsFor('churches', schemas.churches.extend({ pastor: z.string().min(1).nullable() })), '.pastor: nullable');
});

test('несумісний тип видно', () => {
  assertError(errorsFor('ministries', schemas.ministries.extend({ phone: z.number() })), '.phone');
  assertError(errorsFor('ministries', schemas.ministries.extend({ icon: z.enum(['book', 'rocket']) })), '.icon');
});

test('схема дозволила порожній рядок, а модель ні — помилка', () => {
  // Від цього залежить required у формі редактора: поле, яке схема дозволяє
  // лишити порожнім, форма не сміє вимагати.
  assertError(errorsFor('ministries', schemas.ministries.extend({ leader: z.string() })), '.leader');
});

test('обовʼязковість списку (min(1)) звіряється', () => {
  assertError(errorsFor('projects', schemas.projects.extend({ stats: z.array(z.object({ n: z.string().min(1), label: localized }).strict()).min(1) })), '.stats');
});

test('колекція схеми без моделі й навпаки — помилка', () => {
  assertError(checkModel({ ...schemas, extra: z.object({}).strict() }), 'extra');
  const { pastors, ...withoutPastors } = schemas;
  assertError(checkModel(withoutPastors), 'pastors');
});
