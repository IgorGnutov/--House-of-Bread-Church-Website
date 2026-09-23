// Фолбеку на іншу мову немає свідомо: порожній переклад має валити збірку,
// а не показувати українську на англійській сторінці.
export function pick(pair, lang) {
  const value = pair?.[lang];
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`немає перекладу «${lang}» у ${JSON.stringify(pair)}`);
  }
  return value;
}

export function createT(dicts) {
  return (lang, key) => {
    const value = key.split('.').reduce((node, part) => node?.[part], dicts[lang]);
    if (typeof value !== 'string') throw new Error(`немає ключа «${key}» для «${lang}»`);
    return value;
  };
}

const PLURAL_LOCALE = { uk: 'uk-UA', en: 'en-US' };

// Лічильники («18 напрямків служіння», «6 файлів») рахуються з даних:
// редактор додає запис — число й форма слова міняються самі. Українській
// потрібні форми one/few/many («1 файл», «2 файли», «5 файлів»); словник
// тримає всі чотири категорії Intl.PluralRules для обох мов, щоб набори
// ключів uk/en лишалися однаковими.
export function createPlural(dicts) {
  return (lang, key, n) => {
    const forms = key.split('.').reduce((node, part) => node?.[part], dicts[lang]);
    const form = forms?.[new Intl.PluralRules(PLURAL_LOCALE[lang]).select(n)];
    if (typeof form !== 'string') throw new Error(`немає форм множини «${key}» для «${lang}»`);
    return form.replace('{n}', String(n));
  };
}
