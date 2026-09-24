import { stableUuid } from './convert.mjs';
import { COLLECTIONS, COMPONENTS, FINGERPRINT_FIELD, FOLDERS } from './model.mjs';

// JSON компонентів і папок для Management API — з моделі, без ручних
// правок в адмінці: повторний імпорт порівнює їх і каже «0 змін».

const TABS = { content: 'Контент', gallery: 'Галерея', seo: 'SEO', service: 'Службове' };

export const ROOT_COMPONENTS = new Set(Object.values(COLLECTIONS).flatMap((c) => c.variants));

// Хибні прапорці не пишемо зовсім: API може їх не повертати, і порівняння
// «наше ⊆ їхнє» бачило б зміну там, де її немає.
function scalar(kind, field, displayName, required) {
  const base = {
    display_name: displayName,
    ...(required && { required: true }),
    ...(field.description && { description: field.description }),
  };
  switch (kind) {
    case 'text': case 'textarea': case 'number': case 'boolean':
      return { type: kind, ...base };
    case 'option':
      return { type: 'option', ...base, options: field.values.map((value) => ({ name: field.names?.[value] ?? value, value })) };
    case 'image':
      return { type: 'asset', ...base, filetypes: ['images'], allow_external_url: true };
    default:
      throw new Error(`невідомий тип поля: ${kind}`);
  }
}

// required Storyblok перевіряє лише у формі редактора, не в API — справжня
// сітка безпеки лишається на збірці (Спека 3).
function storyblokFields(key, field) {
  if (field.kind === 'list') {
    return [[key, {
      type: 'bloks', display_name: field.label, restrict_components: true, component_whitelist: field.components,
      ...(field.required && { required: true, minimum: 1 }),
    }]];
  }
  const required = field.required ?? !(field.optional || field.nullable || field.allowEmpty || field.kind === 'boolean');
  if (field.kind === 'pair') {
    return [
      [`${key}_uk`, scalar(field.item, field, `${field.label} (укр.)`, required)],
      [`${key}_en`, scalar(field.item, field, `${field.label} (англ.)`, required)],
    ];
  }
  if (field.kind === 'group') {
    return [[key, {
      type: 'bloks', display_name: field.label, restrict_components: true, component_whitelist: [field.component],
      maximum: 1, ...(required && { required: true, minimum: 1 }),
    }]];
  }
  return [[key, scalar(field.kind, field, field.label, required)]];
}

export function buildComponents() {
  return Object.entries(COMPONENTS).map(([name, def]) => {
    const root = ROOT_COMPONENTS.has(name);
    const fields = Object.entries(def.fields).flatMap(([key, field]) =>
      storyblokFields(key, field).map(([k, f]) => ({ key: k, field: f, tab: field.tab ?? 'content' })));
    if (root) {
      fields.push({
        key: FINGERPRINT_FIELD,
        tab: 'service',
        field: {
          type: 'text',
          display_name: 'Відбиток імпорту — не змінювати',
          description: 'Службове поле: за ним імпорт із файлів помічає правки в Storyblok і не перезаписує їх.',
        },
      });
    }
    const schema = {};
    let pos = 0;
    // Вкладки — лише в типів контенту: вкладений блок і так короткий.
    // Ключ «tab-<uuid>» — формат Storyblok; uuid детермінований.
    if (root) {
      for (const [tab, displayName] of Object.entries(TABS)) {
        const keys = fields.filter((f) => f.tab === tab).map((f) => f.key);
        if (keys.length > 0) schema[`tab-${stableUuid(`${name}:${tab}`)}`] = { type: 'tab', display_name: displayName, keys, pos: pos++ };
      }
    }
    for (const { key, field } of fields) schema[key] = { ...field, pos: pos++ };
    return { name, display_name: def.label, is_root: root, is_nestable: !root, schema };
  });
}

export function buildFolders() {
  return Object.entries(FOLDERS).map(([slug, name]) => {
    const contentTypes = Object.values(COLLECTIONS).filter((c) => c.folder === slug).flatMap((c) => c.variants);
    return { slug, name, content_types: contentTypes, default_root: contentTypes[0] };
  });
}
