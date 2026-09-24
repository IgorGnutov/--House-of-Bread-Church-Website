# Чекліст SEO в день запуску на домені

Поведінку `.htaccess`, картки Facebook і валідність розмітки неможливо перевірити
локально (Етап 3, рішення 14). Прогнати один раз після першого продакшн-деплою
(Етап 0, Задача 5), підставивши домен замість `example.org`.

## Збірка

- [ ] Продакшн-збірка: `SITE_URL=https://example.org`, `BASE_PATH=/`, **без** `SITE_NOINDEX`.
- [ ] `https://example.org/robots.txt` — `Allow: /` і `Sitemap: https://example.org/sitemap.xml`.
- [ ] На будь-якій сторінці **немає** `<meta name="robots" content="noindex">`.

## Редиректи й заголовки

```sh
curl -sI http://example.org/                             # 301 → https://example.org/
curl -sI https://www.example.org/ministries/             # 301 → https://example.org/ministries/
curl -sI https://example.org/ministries                  # 301 → https://example.org/ministries/
curl -sI https://example.org/index.html                  # 301 → https://example.org/
curl -sI https://example.org/ministries/index.html       # 301 → https://example.org/ministries/
curl -sI "https://example.org/ministry.dc.html?id=youth" # 301 → https://example.org/ministries/youth/
curl -sI https://example.org/church.dc.html              # 301 → https://example.org/churches/
curl -sI https://example.org/pastors.dc.html              # 301 → https://example.org/pastors/
curl -sI https://example.org/                            # 200, Cache-Control: no-cache
curl -sI -H 'Accept-Encoding: br, gzip' https://example.org/   # Content-Encoding: br або gzip
```

- [ ] Будь-який `https://example.org/_astro/*.css` — `Cache-Control: public, max-age=31536000, immutable`.
- [ ] Жодного ланцюжка з більш ніж одного 301 і жодного циклу (`curl -sIL`).
- [ ] Ланцюжок з кількох редиректів одразу (http + www + чистий URL) не подовжується й не
      зациклюється: `curl -sIL --max-redirs 3 http://www.example.org/ministries` — не більш
      ніж 2 стрибки, останній — `200` на `https://example.org/ministries/`, і кожен `Location:`
      у ланцюжку вже `https://` (за проксі, що знімає TLS, правило редиректу на самé себе за
      шляхом без домену інакше могло б віддати `http://` і додати зайвий стрибок).
- [ ] Якщо будь-який запит повертає **500** — імовірно, `AllowOverride` хостингу забороняє
      `Options`; прибрати рядок `Options -Indexes -MultiViews` у `src/lib/seo-files.mjs`.
      Якщо **403** — на хостингу для цієї теки треба увімкнути `FollowSymLinks` /
      `SymLinksIfOwnerMatch` для `mod_rewrite` (налаштування хостера, не файлу).
- [ ] Якщо `http://` не редіректить або редіректить у цикл — хостинг сигналізує TLS інакше, ніж
      `%{HTTPS}` / `X-Forwarded-Proto` (наприклад, `X-Forwarded-SSL` або `%{ENV:HTTPS}`);
      підправити правило https в `src/lib/seo-files.mjs`.
- [ ] OpenLiteSpeed читає з `.htaccess` лише правила `mod_rewrite`. Якщо редиректи працюють, а
      перевірки `Cache-Control` / `Content-Encoding` — ні, кеш і стиснення вмикаються в панелі
      хостингу, а не у файлі.

## Розмітка й картки

- [ ] Facebook Sharing Debugger: `/`, `/en/`, одна сторінка служіння — заголовок, опис і картинка підтягуються.
- [ ] validator.schema.org: `/` (Organization, Church), сторінка церкви (Church), сторінка служіння (BreadcrumbList) — без помилок.

## Search Console

- [ ] Додати ресурс домену, надіслати `sitemap.xml`.
- [ ] Через 1–2 тижні: у звіті індексування є обидві мови; немає помилок `hreflang`.
