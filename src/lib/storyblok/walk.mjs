import { COLLECTIONS, COMPONENTS } from './model.mjs';

// Обхід моделі: кожна richtext-пара запису проходить через `fn`. Потрібен міграції
// файлів і, далі, збору картинок документів — окремо перелічувати поля колекцій не доводиться.

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

// Варіант компонента за fixed-значеннями (type/kind) — як у convert.mjs.
const variantOf = (variants, data) =>
  variants.find((v) => Object.entries(COMPONENTS[v].fixed ?? {}).every(([key, value]) => data?.[key] === value));

function mapField(field, value, fn) {
  if (field.kind === 'pair') return field.item === 'richtext' && isObj(value) ? fn(value, field) : value;
  if (field.kind === 'group') return isObj(value) ? mapBlock(field.component, value, fn) : value;
  if (field.kind === 'list' && Array.isArray(value)) {
    return value.map((item) => {
      if (field.unwrap) return mapField(COMPONENTS[field.components[0]].fields[field.unwrap], item, fn);
      const name = variantOf(field.components, item);
      return name ? mapBlock(name, item, fn) : item;
    });
  }
  return value;
}

function mapBlock(name, data, fn) {
  const out = { ...data };
  for (const [key, field] of Object.entries(COMPONENTS[name].fields)) {
    if (data[key] === undefined || data[key] === null) continue;
    out[key] = mapField(field, data[key], fn);
  }
  return out;
}

// Нова копія запису; вхідні дані не змінюються. Запис без підходящого варіанта
// лишається як є — його називає схема, а не обхід.
export function mapRichPairs(collection, data, fn) {
  const name = variantOf(COLLECTIONS[collection].variants, data);
  return name ? mapBlock(name, data, fn) : { ...data };
}
