import { createServer } from 'node:http';
import { createReadStream, statSync } from 'node:fs';
import { extname, join, normalize, resolve, sep } from 'node:path';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml',
};

// Query і hash відкидаються: файл визначає лише шлях, як на статичному хостингу.
// «/каталог/» → index.html, як на GitHub Pages і Apache.
export function resolveFile(root, urlPath) {
  const base = resolve(root);
  const pathname = decodeURIComponent(urlPath.split(/[?#]/)[0]);
  const abs = join(base, normalize(pathname).replace(/^[/\\]+/, ''));
  if (abs !== base && !abs.startsWith(base + sep)) return null;
  try {
    if (statSync(abs).isDirectory()) {
      const index = join(abs, 'index.html');
      statSync(index);
      return index;
    }
    return abs;
  } catch {
    return null;
  }
}

export function startStaticServer(root, port = 0) {
  const server = createServer((req, res) => {
    const file = resolveFile(root, req.url);
    if (!file) {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end('not found');
      return;
    }
    res.writeHead(200, { 'content-type': TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream' });
    createReadStream(file).pipe(res);
  });
  return new Promise((done) => {
    server.listen(port, '127.0.0.1', () => done({
      origin: `http://127.0.0.1:${server.address().port}`,
      close: () => new Promise((closed) => server.close(closed)),
    }));
  });
}
