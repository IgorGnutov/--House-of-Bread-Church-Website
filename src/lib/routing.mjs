// Статична збірка передає мову в props (localeParams), серверний режим
// прев'ю — лише параметром адреси. Невідомий префікс (/foo/about/) не є
// сторінкою сайту: null, і маршрут відповідає 404.
export function pageLang(astro) {
  if (astro.props?.lang) return astro.props.lang;
  const param = astro.params?.lang;
  if (param === undefined) return 'uk';
  return param === 'en' ? 'en' : null;
}

export const notFound = () => new Response('Not found', { status: 404, headers: { 'content-type': 'text/plain; charset=utf-8' } });
