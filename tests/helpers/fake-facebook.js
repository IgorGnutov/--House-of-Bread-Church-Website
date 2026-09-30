import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { GRAPH_VERSION } from '../../scripts/facebook/feed.mjs';
import { projectRoot } from './build.js';

// Фейк Graph API і fbcdn для npm run fb:pull (Спека 5): npm test у мережу не
// ходить. Відповіді повторюють знахідки пробного запиту 2026-09-30: розміри
// медіа — в attachments, в альбомі — у першій підкартинці. Помилки й
// paging.next свідомо містять токен, як і справжні: так видно, що fb:pull
// не виводить його ніде.
export const PAGE_ID = '238298299705573';
export const TOKEN = 'EAAfakeSECRETtoken123';
export const IMAGE_BYTES = readFileSync(join(projectRoot, 'public/uploads/hero-cross.jpg'));

export async function startFakeFacebook() {
  const fake = { posts: [], missing: new Set(), fail: null, requests: [] };
  const server = createServer((req, res) => {
    const url = new URL(req.url, 'http://fake');
    fake.requests.push(url.pathname);
    const json = (status, body) => {
      res.writeHead(status, { 'content-type': 'application/json' });
      res.end(JSON.stringify(body));
    };
    if (url.pathname === `/${GRAPH_VERSION}/${PAGE_ID}/posts`) {
      const token = url.searchParams.get('access_token');
      if (fake.fail || token !== TOKEN) {
        return json(fake.fail?.status ?? 400, {
          error: { message: `Invalid OAuth access token - Cannot parse access token: ${token}`, type: 'OAuthException', code: 190 },
        });
      }
      return json(200, {
        data: fake.posts,
        paging: { next: `${fake.origin}${url.pathname}?access_token=${token}&limit=12&after=QVFI` },
      });
    }
    const image = url.pathname.match(/^\/img\/(.+)$/);
    if (image && !fake.missing.has(image[1])) {
      res.writeHead(200, { 'content-type': 'image/jpeg' });
      return res.end(IMAGE_BYTES);
    }
    res.writeHead(404);
    res.end();
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  fake.origin = `http://127.0.0.1:${server.address().port}`;
  fake.close = () => new Promise((resolve) => server.close(resolve));
  return fake;
}

// Сирі пости Graph API різних типів — серед 10 останніх на сторінці є всі.
const base = (n, extra) => ({
  id: `${PAGE_ID}_${n}`,
  created_time: `2026-09-${String(n % 28 + 1).padStart(2, '0')}T10:00:09+0000`,
  permalink_url: `https://www.facebook.com/1266500102189084/posts/${n}`,
  message: `Пост ${n}\nОпис поста ${n}`,
  ...extra,
});
const picture = (fake, n) => `${fake.origin}/img/${n}.jpg?oe=68ABCDEF`;
const media = (width, height) => ({ image: { src: 'https://scontent.fbcdn.test/x.jpg', width, height } });

export const videoPost = (fake, n) => base(n, {
  full_picture: picture(fake, n), attachments: { data: [{ media_type: 'video', media: media(720, 1280) }] },
});
export const albumPost = (fake, n) => base(n, {
  full_picture: picture(fake, n),
  attachments: { data: [{ media_type: 'album', subattachments: { data: [{ media: media(1200, 900) }, { media: media(900, 1200) }] } }] },
});
export const sharePost = (fake, n) => base(n, {
  full_picture: picture(fake, n), attachments: { data: [{ media_type: 'share', media: media(600, 600) }] },
});
export const photoPost = (fake, n) => base(n, {
  full_picture: picture(fake, n), attachments: { data: [{ media_type: 'photo', media: media(1600, 900) }] },
});
export const textPost = (n) => base(n, {});
