# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Static website for "Дім Хліба" (House of Bread Church), Kryvyi Rih, built with **Astro 5**
(static output, no server). Ukrainian lives at the root, English under `/en/`; slugs are English
and shared by both locales. Roadmap and specs: `docs/superpowers/specs/`, implementation plans:
`docs/superpowers/plans/`.

## Commands

- `npm run dev` / `npm run build` / `npm run preview`
- `npm test` — `astro build` (also validates the content schema) + `node --test` over `tests/*.test.js`
- `npm run e2e` — Playwright browser tests in `tests/e2e/` (needs `npx playwright install chromium` once)
- A build under a sub-path: `SITE_URL=… BASE_PATH=/sub/ npm test`. On Windows/Git Bash prefix
  with `MSYS_NO_PATHCONV=1` or use PowerShell.

## Content

All content is in typed Content Collections: data under `src/content/**`, schemas in
`src/content.config.ts`, UI strings in `src/i18n/{uk,en}.json`. Every localized field is
`{uk, en}` and **both are required** — a missing translation fails the build on purpose. Edit
the JSON directly; there is no generator. Collection records carry an explicit `order` (the glob
loader does not guarantee file order). `pages.{about,contacts,donate}` build only once their
`body` is non-null (Spec 2: no empty pages in the index); their only links are in the homepage
footer.

## Pages and routing

One route file per page under `src/pages/[...lang]/` produces both locales via `localeParams()`;
detail pages (`ministries/[slug]`, `churches/[slug]`, `projects/[slug]`) use `getStaticPaths()`.
Build every internal URL with `localePath(base, lang, path)` / `assetUrl(base, src)` from
`src/lib/paths.mjs` (`base = import.meta.env.BASE_URL`) — a hand-written `/…` breaks on the
GitHub Pages sub-path. The language switcher is plain links; never add `localStorage`-based
language detection or redirects (blocks indexing of `/en/`, enforced by `tests/site.test.js`).

## Styling

The design was ported 1:1 from the legacy static site and verified pixel-by-pixel. Shared CSS:
`src/styles/{fonts,tokens,base}.css` (imported by `Base.astro`). Each page imports its own global
stylesheet from `src/styles/pages/`; the gallery has `src/styles/gallery.css`. **No `<style>`
blocks in `.astro` files** — scoped styles raise specificity and break the page media queries
(enforced by a test). Keep the existing tokens (`--bg`, `--accent`, `--ink-blue`, …) instead of
adding new colours. Icons are inline SVG (`src/lib/icons.mjs`, `src/lib/svg.mjs`).

Fonts are self-hosted in `public/fonts/`: **Nyght Serif** (`--font-display`) ships only
Regular/Bold, so headings use `font-weight:700` — never `600` on display text; **Fixel Text**
(`--font-body`) has a real 600. See `public/fonts/nyght-serif/NOTICE.md` for licensing.

## Deploy

`.github/workflows/deploy.yml`: push to `main` → `npm test` with the Pages `SITE_URL`/`BASE_PATH`
→ GitHub Pages. Production hosting (ukraine.com.ua, rsync over SSH) is pending a domain — see
Stage 0 plan, Task 5.

## Next

Stage 3 (Spec 2): meta tags, `hreflang`, JSON-LD, `sitemap.xml`, `robots.txt`, `.htaccess`.
Open content gaps for the customer: `docs/superpowers/notes/2026-09-23-content-gaps.md`.
