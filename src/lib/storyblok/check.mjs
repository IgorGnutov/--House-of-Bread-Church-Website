import { localized, localizedHtml, schemas as SCHEMAS } from '../schema.mjs';
import { COLLECTIONS, COMPONENTS } from './model.mjs';

// Доводить, що модель Storyblok покриває схему рівно: ті самі ключі, ті
// самі optional/nullable, сумісні типи. Без винятків — нове поле в схемі
// без поля в моделі (чи навпаки) дає помилку з повним шляхом.

const SCALARS = {
  ZodString: ['text', 'textarea', 'image'],
  ZodNumber: ['number'],
  ZodBoolean: ['boolean'],
  ZodEnum: ['option'],
};

// Знімає optional/nullable/refine, але зупиняється на localized і
// localizedHtml — їх модель упізнає за тотожністю, а не за формою.
function unwrap(schema) {
  let s = schema;
  let optional = false;
  let nullable = false;
  for (;;) {
    if (s === localized || s === localizedHtml) break;
    const type = s._def.typeName;
    if (type === 'ZodOptional') { optional = true; s = s._def.innerType; }
    else if (type === 'ZodNullable') { nullable = true; s = s._def.innerType; }
    else if (type === 'ZodEffects') s = s._def.schema;
    else break;
  }
  return { s, optional, nullable };
}

export function checkModel(schemas = SCHEMAS) {
  const errors = [];
  const used = new Set();
  for (const [collection, schema] of Object.entries(schemas)) {
    const entry = COLLECTIONS[collection];
    if (!entry) {
      errors.push(`${collection}: колекції немає в моделі (COLLECTIONS)`);
      continue;
    }
    // Запис колекції має slug — у Storyblok це slug історії, а не поле.
    compareVariants(schema, entry.variants, collection, entry.kind === 'collection' ? ['slug'] : [], errors, used);
  }
  for (const collection of Object.keys(COLLECTIONS)) {
    if (!(collection in schemas)) errors.push(`${collection}: є в моделі, але немає в схемі`);
  }
  for (const name of Object.keys(COMPONENTS)) {
    if (!used.has(name)) errors.push(`${name}: компонент моделі ніде не використано`);
  }
  return errors;
}

// Варіанти (testimony_text/_video, resource_document/_link, gallery_image/
// _video) відрізняються fixed-значеннями: варіант схеми, що їх приймає, і є
// його парою.
function compareVariants(schema, variants, path, implicit, errors, used) {
  const { s } = unwrap(schema);
  const options = s._def.typeName === 'ZodDiscriminatedUnion' ? [...s._def.options] : [s];
  const matched = new Set();
  for (const name of variants) {
    used.add(name);
    const def = COMPONENTS[name];
    if (!def) {
      errors.push(`${path}: компонента «${name}» немає в моделі`);
      continue;
    }
    const option = options.find((o) => o._def.typeName === 'ZodObject'
      && Object.entries(def.fixed ?? {}).every(([key, value]) => o.shape[key]?.safeParse(value).success));
    if (!option) {
      errors.push(`${path} (${name}): у схемі немає варіанта, що приймає fixed ${JSON.stringify(def.fixed ?? {})}`);
      continue;
    }
    matched.add(option);
    compareObject(option, def, `${path} (${name})`, implicit, errors, used);
  }
  for (const option of options) {
    if (!matched.has(option)) errors.push(`${path}: варіант схеми без компонента в моделі`);
  }
}

function compareObject(object, def, path, implicit, errors, used) {
  const shape = object.shape;
  const fixed = Object.keys(def.fixed ?? {});
  const modelKeys = [...Object.keys(def.fields), ...fixed, ...implicit];
  for (const key of Object.keys(shape)) {
    if (!modelKeys.includes(key)) errors.push(`${path}.${key}: поле є в схемі, але немає в моделі`);
  }
  for (const key of modelKeys) {
    if (!(key in shape)) errors.push(`${path}.${key}: поле є в моделі, але немає в схемі`);
  }
  for (const key of fixed) {
    if (key in def.fields) errors.push(`${path}.${key}: і поле, і fixed-значення`);
  }
  for (const [key, field] of Object.entries(def.fields)) {
    if (key in shape) compareField(shape[key], field, `${path}.${key}`, errors, used);
  }
}

function compareField(schema, field, path, errors, used) {
  const { s, optional, nullable } = unwrap(schema);
  if (Boolean(field.optional) !== optional) errors.push(`${path}: optional у схемі ${optional}, у моделі ${Boolean(field.optional)}`);
  if (Boolean(field.nullable) !== nullable) errors.push(`${path}: nullable у схемі ${nullable}, у моделі ${Boolean(field.nullable)}`);
  const type = s._def.typeName;
  const isText = s === localized || s === localizedHtml;

  if (field.kind === 'pair') {
    if (isText) {
      if ((s === localizedHtml) !== Boolean(field.markup)) errors.push(`${path}: розмітка (localizedHtml) у схемі й моделі не збігається`);
      if (!['text', 'textarea'].includes(field.item)) errors.push(`${path}: текстова пара в моделі має тип ${field.item}`);
      return;
    }
    if (type !== 'ZodObject' || Object.keys(s.shape).sort().join() !== 'en,uk') {
      errors.push(`${path}: у моделі пара uk/en, у схемі ${type}`);
      return;
    }
    if (field.markup) errors.push(`${path}: markup дозволений лише для localizedHtml`);
    for (const side of ['uk', 'en']) compareField(s.shape[side], { kind: field.item }, `${path}.${side}`, errors, used);
    return;
  }
  if (isText) {
    errors.push(`${path}: у схемі пара uk/en, у моделі ${field.kind}`);
    return;
  }
  if (field.kind === 'group') {
    if (type !== 'ZodObject') {
      errors.push(`${path}: у моделі група, у схемі ${type}`);
      return;
    }
    compareVariants(s, [field.component], path, [], errors, used);
    return;
  }
  if (field.kind === 'list') {
    if (type !== 'ZodArray') {
      errors.push(`${path}: у моделі список, у схемі ${type}`);
      return;
    }
    const required = (s._def.minLength?.value ?? 0) > 0;
    if (Boolean(field.required) !== required) errors.push(`${path}: список обовʼязковий у схемі ${required}, у моделі ${Boolean(field.required)}`);
    if (field.unwrap) {
      const [name] = field.components;
      used.add(name);
      const def = COMPONENTS[name];
      if (field.components.length !== 1 || !def || Object.keys(def.fields).join() !== field.unwrap) {
        errors.push(`${path}: unwrap потребує рівно одного компонента з єдиним полем «${field.unwrap}»`);
        return;
      }
      compareField(s._def.type, def.fields[field.unwrap], `${path}[]`, errors, used);
      return;
    }
    compareVariants(s._def.type, field.components, `${path}[]`, [], errors, used);
    return;
  }
  if (!SCALARS[type]?.includes(field.kind)) {
    errors.push(`${path}: у схемі ${type}, у моделі ${field.kind}`);
    return;
  }
  if (type === 'ZodEnum' && [...s._def.values].sort().join() !== [...field.values].sort().join()) {
    errors.push(`${path}: значення списку не збігаються зі схемою`);
  }
  // Від цього залежить required у формі: поле, яке схема дозволяє лишити
  // порожнім, форма не сміє вимагати (і навпаки).
  if (type === 'ZodString' && !optional && !nullable) {
    const acceptsEmpty = schema.safeParse('').success;
    if (acceptsEmpty !== Boolean(field.allowEmpty)) {
      errors.push(`${path}: схема ${acceptsEmpty ? 'приймає' : 'не приймає'} порожній рядок, у моделі allowEmpty=${Boolean(field.allowEmpty)}`);
    }
  }
}
