import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readHobGlobals } from '../scripts/lib/legacy-source.mjs';

test('читає window.HOB_* із легасі-файлів даних', () => {
  const w = readHobGlobals([
    'ministries-data.js',
    'churches-data.js',
    'projects-data.js',
    'testimonies-data.js',
  ]);

  assert.equal(w.HOB_MINISTRIES.length, 18);
  assert.equal(w.HOB_CHURCHES.length, 6);
  assert.equal(w.HOB_PROJECTS.length, 4);
  assert.equal(w.HOB_TESTIMONIES.length, 6);
  assert.equal(w.HOB_MINISTRIES[0].id, 'bible-school');
});

test('галерея служінь доступна як функція і дає 4 слайди', () => {
  // Служіння — єдина колекція без media[] у джерелі: галерея генерується
  // функцією. Її треба саме викликати, інакше на Етапі 2 картинок не буде.
  const w = readHobGlobals(['ministries-data.js']);
  const media = w.HOB_ministryMedia(w.HOB_MINISTRIES[0]);

  assert.equal(media.length, 4);
  assert.equal(media[0].type, 'image');
  assert.equal(media[2].type, 'video');
  assert.ok(media[0].alt.length > 0, 'alt порожній — на Етапі 2 це буде картинка без опису');
});
