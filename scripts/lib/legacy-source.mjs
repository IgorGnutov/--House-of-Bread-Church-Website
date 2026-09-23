import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

export const PROJECT_ROOT = new URL('../../', import.meta.url);

export const legacyPath = (name) => fileURLToPath(new URL(name, PROJECT_ROOT));

export const readLegacy = (name) => readFileSync(legacyPath(name), 'utf8');

// Файли даних — це присвоєння у window, а не модулі. Виконуємо їх у пісочниці
// зі спільним window: HOB_ministryMedia посилається на той самий обʼєкт, тому
// розкладати кожен файл у власний контекст не можна.
export function readHobGlobals(fileNames) {
  const windowObject = {};
  const context = vm.createContext({ window: windowObject });

  for (const name of fileNames) {
    vm.runInContext(readLegacy(name), context, { filename: name });
  }

  return windowObject;
}
