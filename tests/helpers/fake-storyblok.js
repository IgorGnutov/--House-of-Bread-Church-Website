import { createServer } from 'node:http';

// Management API у памʼяті: ті самі шляхи, форми відповідей, ліміт і 429,
// що й у Storyblok (документація MAPI v1; де вона мовчить — див. план
// Етапу 4, рішення 15). Живий простір тести не чіпають ніколи.
//
// Як і справжній API, фейк дописує до збереженого свої ключі (id полів,
// created_at, alt: null у asset): повторний імпорт мусить лишатися «0 змін»
// попри це (Review Focus 1).

const readBody = (req) => new Promise((resolve, reject) => {
  const chunks = [];
  req.on('data', (c) => chunks.push(c));
  req.on('end', () => resolve(Buffer.concat(chunks)));
  req.on('error', reject);
});

const ASSET_DEFAULTS = { alt: null, name: '', focus: null, title: null, source: null, copyright: null, meta_data: {} };

function decorateAssets(value) {
  if (Array.isArray(value)) return value.map(decorateAssets);
  if (value && typeof value === 'object') {
    const out = Object.fromEntries(Object.entries(value).map(([k, v]) => [k, decorateAssets(v)]));
    return out.fieldtype === 'asset' ? { ...ASSET_DEFAULTS, ...out } : out;
  }
  return value;
}

const listItem = ({ content, ...rest }) => rest;
// Storyblok «параметризує» імʼя файлу: крапки, крім останньої, стають «_».
const parameterize = (name) => name.replace(/\.(?=.*\.)/g, '_');

export async function startFakeStoryblok({
  token = 'test-token', spaceId = '1', limit = Infinity, windowMs = 1000, seedDemo = false, failOnWrite = null,
} = {}) {
  const state = { components: [], stories: [], assets: [], files: new Map(), uploads: 0, rejected: 0, log: [] };
  let nextId = 1;
  let hits = [];
  let writeCount = 0;
  let baseUrl = '';

  const fullSlugOf = (story) => {
    const parent = state.stories.find((s) => s.id === story.parent_id);
    return parent ? `${parent.full_slug}/${story.slug}` : story.slug;
  };
  const decorateComponent = (component, id) => ({
    ...component,
    id,
    created_at: '2026-09-24T00:00:00.000Z',
    component_group_uuid: null,
    schema: Object.fromEntries(Object.entries(component.schema ?? {}).map(([k, f], i) => [k, { id: `f${i}`, ...f }])),
  });
  const addStory = ({ name, slug, parent_id = 0, is_folder = false, default_root, content, published = false }) => {
    const story = {
      id: nextId++, uuid: `uuid-${nextId}`, name, slug, parent_id, is_folder, default_root,
      content: decorateAssets(content), published, unpublished_changes: false,
    };
    story.full_slug = fullSlugOf(story);
    state.stories.push(story);
    return story;
  };

  if (seedDemo) {
    for (const name of ['page', 'teaser', 'grid', 'feature']) state.components.push(decorateComponent({ name, schema: {}, is_root: name === 'page', is_nestable: name !== 'page' }, nextId++));
    addStory({ name: 'Home', slug: 'home', content: { component: 'page', _uid: 'demo', body: [] }, published: true });
  }

  const send = (res, status, body, headers = {}) => {
    res.writeHead(status, { 'content-type': 'application/json', ...headers });
    res.end(body === undefined ? '' : JSON.stringify(body));
  };

  async function handle(req, res) {
    const url = new URL(req.url, baseUrl);
    const method = req.method;

    // Сховище файлів (S3 і CDN): не MAPI, без токена й ліміту.
    if (method === 'POST' && url.pathname === '/s3') {
      const form = await new Request('http://fake/s3', { method: 'POST', headers: { 'content-type': req.headers['content-type'] }, body: await readBody(req) }).formData();
      const file = form.get('file');
      state.files.set(`/${form.get('key')}`, Buffer.from(await file.arrayBuffer()));
      state.uploads++;
      return send(res, 204);
    }
    if (method === 'GET' && url.pathname.startsWith('/f/')) {
      const bytes = state.files.get(url.pathname);
      if (!bytes) return send(res, 404, { error: 'not found' });
      res.writeHead(200, { 'content-type': 'application/octet-stream' });
      return res.end(bytes);
    }

    const m = url.pathname.match(/^\/v1\/spaces\/([^/]+)(\/.*?)\/?$/);
    if (!m) return send(res, 404, { error: 'not found' });
    if (req.headers.authorization !== token) return send(res, 401, { error: 'Unauthorized' });
    if (m[1] !== spaceId) return send(res, 404, { error: 'space not found' });

    const now = Date.now();
    hits = hits.filter((t) => now - t < windowMs);
    if (hits.length >= limit) {
      state.rejected++;
      return send(res, 429, { error: 'Too Many Requests' });
    }
    hits.push(now);

    const route = m[2];
    const isWrite = method !== 'GET' || /\/publish$/.test(route) || /\/finish_upload$/.test(route);
    state.log.push({ method, route, write: isWrite });
    if (isWrite && failOnWrite !== null && ++writeCount === failOnWrite) return send(res, 500, { error: 'Internal Server Error' });

    const body = method === 'POST' || method === 'PUT' ? JSON.parse((await readBody(req)).toString() || '{}') : {};
    let r;

    if (route === '/components' && method === 'GET') return send(res, 200, { components: state.components, component_groups: [] });
    if (route === '/components' && method === 'POST') {
      if (state.components.some((c) => c.name === body.component.name)) return send(res, 422, { name: ['has already been taken'] });
      const component = decorateComponent(body.component, nextId++);
      state.components.push(component);
      return send(res, 201, { component });
    }
    if ((r = route.match(/^\/components\/(\d+)$/))) {
      const index = state.components.findIndex((c) => c.id === Number(r[1]));
      if (index < 0) return send(res, 404, { error: 'not found' });
      if (method === 'PUT') {
        state.components[index] = decorateComponent(body.component, state.components[index].id);
        return send(res, 200, { component: state.components[index] });
      }
      if (method === 'DELETE') return send(res, 200, { component: state.components.splice(index, 1)[0] });
    }

    if (route === '/stories' && method === 'GET') {
      const perPage = Number(url.searchParams.get('per_page') ?? 25);
      const page = Number(url.searchParams.get('page') ?? 1);
      const items = state.stories.slice((page - 1) * perPage, page * perPage).map(listItem);
      return send(res, 200, { stories: items }, { total: String(state.stories.length), 'per-page': String(perPage) });
    }
    if (route === '/stories' && method === 'POST') {
      const s = body.story ?? {};
      if (!s.name || !s.slug) return send(res, 422, { error: 'name and slug are required' });
      const parentId = s.parent_id ?? 0;
      if (state.stories.some((x) => x.parent_id === parentId && x.slug === s.slug)) return send(res, 422, { slug: ['has already been taken'] });
      const story = addStory({ ...s, parent_id: parentId, published: Boolean(body.publish) });
      return send(res, 201, { story });
    }
    if ((r = route.match(/^\/stories\/(\d+)(\/publish)?$/))) {
      const story = state.stories.find((s) => s.id === Number(r[1]));
      if (!story) return send(res, 404, { error: 'not found' });
      if (r[2] && method === 'GET') {
        story.published = true;
        story.unpublished_changes = false;
        return send(res, 200, { story });
      }
      if (method === 'GET') return send(res, 200, { story });
      if (method === 'PUT') {
        const s = body.story ?? {};
        for (const key of ['name', 'slug', 'parent_id', 'is_folder', 'default_root']) if (key in s) story[key] = s[key];
        if ('content' in s) story.content = decorateAssets(s.content);
        story.full_slug = fullSlugOf(story);
        if (body.publish) { story.published = true; story.unpublished_changes = false; }
        else if (story.published) story.unpublished_changes = true;
        return send(res, 200, { story });
      }
      if (method === 'DELETE') {
        state.stories = state.stories.filter((s) => s.id !== story.id);
        return send(res, 200, { story });
      }
    }

    if (route === '/assets' && method === 'GET') {
      const perPage = Number(url.searchParams.get('per_page') ?? 25);
      const page = Number(url.searchParams.get('page') ?? 1);
      return send(res, 200, { assets: state.assets.slice((page - 1) * perPage, page * perPage) }, { total: String(state.assets.length) });
    }
    if (route === '/assets' && method === 'POST') {
      const id = nextId++;
      const name = parameterize(body.filename);
      const key = `f/${spaceId}/${id}/${name}`;
      state.assets.push({ id, filename: `${baseUrl}/${key}`, short_filename: name, content_type: null, pending: true });
      return send(res, 200, { id, post_url: `${baseUrl}/s3`, public_url: `${baseUrl}/${key}`, pretty_url: `//fake/${key}`, fields: { key, acl: 'public-read' } });
    }
    if ((r = route.match(/^\/assets\/(\d+)\/finish_upload$/))) {
      const asset = state.assets.find((a) => a.id === Number(r[1]));
      if (!asset) return send(res, 404, { error: 'not found' });
      delete asset.pending;
      return send(res, 200, { asset });
    }
    return send(res, 404, { error: `no route ${method} ${route}` });
  }

  const server = createServer((req, res) => {
    handle(req, res).catch((error) => send(res, 500, { error: String(error) }));
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;

  const story = (fullSlug) => state.stories.find((s) => s.full_slug === fullSlug && !s.is_folder);
  return {
    baseUrl, token, spaceId, state,
    requests: () => state.log.length,
    writes: () => state.log.filter((e) => e.write).length,
    story,
    // Правка «редактором»: з publish — як натиснуте «Опублікувати».
    editStory(fullSlug, mutate, { publish = true } = {}) {
      const s = story(fullSlug);
      mutate(s.content, s);
      if (publish) { s.published = true; s.unpublished_changes = false; } else s.unpublished_changes = true;
    },
    addStory({ parentSlug, slug, name = slug, content }) {
      const parent = state.stories.find((s) => s.is_folder && s.full_slug === parentSlug);
      return addStory({ name, slug, parent_id: parent?.id ?? 0, content, published: true });
    },
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}
