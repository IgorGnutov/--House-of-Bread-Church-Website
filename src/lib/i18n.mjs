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
