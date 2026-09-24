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
  (includes a few extra probe builds: schema rules in `content-schema.test.js`, empty/single-item
  datasets in `content-crud.test.js`)
- `npm run e2e` — Playwright browser tests in `tests/e2e/` (needs `npx playwright install chromium` once)
- A build under a sub-path: `SITE_URL=… BASE_PATH=/sub/ npm test`. On Windows/Git Bash prefix
  with `MSYS_NO_PATHCONV=1` or use PowerShell.
- Preview mode (as in CI): add `SITE_NOINDEX=true`.
- `npm run cms:import` — dry-run plan for the Storyblok space; `-- --apply` writes it, `--prune` also deletes
  stories/components that are not in the files/model, `--force` overwrites stories edited in Storyblok.
  `npm run cms:verify` — field-by-field comparison with the files (library images by SHA-256). Both read
  `.env` (`STORYBLOK_MANAGEMENT_TOKEN`, `STORYBLOK_SPACE_ID`, `STORYBLOK_REGION`; never committed).

## Content

All content is in typed Content Collections: data under `src/content/**`, schemas in
`src/lib/schema.mjs` (`content.config.ts` only wires loaders), UI strings in `src/i18n/{uk,en}.json`. Every localized field is
`{uk, en}` and **both are required** — a missing translation fails the build on purpose. Edit
the JSON directly; there is no generator. Collection records carry an explicit `order` (the glob
loader does not guarantee file order); gaps and duplicates are fine — templates sort by `order`,
then `slug` (`sortedData`), and "first/main" means first after sorting. `pages.{about,contacts,donate}`
build only once their `body` is non-null (Spec 2: no empty pages in the index); their only links
are in the homepage footer.

**Contract with the CMS:** anything the schema accepts must build and pass `npm test` (it gates
the deploy). The schema holds only integrity rules (slug format + uniqueness per collection,
known icons, URL formats, phone format, both languages non-blank, no markup in text fields
except `homepage.hero.title`, no `#` placeholder URLs, YouTube for videos, non-empty gallery,
required page / singleton ids, known `pages.*.sections` keys; uniqueness and ids via the loader
wrappers in `content.config.ts`); never counts or exact values. A collection with zero records
(no folder at all — git keeps no empty dirs) is valid. **One deliberate exception:** a relative
path to a file that doesn't exist (`uploads/…` in a photo, poster, hero image, gallery `src`,
resource `url`, `seo.ogImage` or `defaultOgImage`, or an internal `ctaUrl` to a page that isn't
built) passes the schema but fails
`site.test.js` (`findBrokenLinks` names the page and the missing target) — a broken link must not
reach production, and the schema can't see the file system/route set. Templates must tolerate every schema-valid dataset: empty lists omit their block,
optional fields omit their element, counters use `plural()`. Tests assert rules and derive
expectations from the content they read — never pin current data. Edge cases are proven with
probe builds from a temporary copy of the content (`tests/helpers/build.js`, `HOB_CONTENT_DIR`),
so tests never touch `src/content`.

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

## SEO

`<head>` comes from `src/components/Seo.astro` (via `Base.astro`): title, description, canonical,
reciprocal `hreflang` (uk / en / x-default → uk), OG + Twitter, `robots`, and one JSON-LD `@graph`.
Every route passes `path` (without locale or base), its visible `title` and a fallback `description`;
records also pass their `seo` group and gallery cover (`image`). Fallbacks (`resolveMeta` in
`src/lib/seo.mjs`): `seo.metaTitle` → `<title> — <site name>` unless the title already carries the
brand; `seo.metaDescription` → summary / lead / first body paragraph → `homepage.about.lead`, cut to
160 chars; `seo.ogImage` → gallery cover → `site-settings.defaultOgImage` → hero photo. Editor-filled
SEO fields are used verbatim. JSON-LD nodes live in `src/lib/jsonld.mjs`: `Organization` + `Church` on
the homepage, `Church` on church pages, `BreadcrumbList` on every sub-page (built by `SubPage.astro`,
same labels as the visible crumbs where a page shows them).
`robots.txt`, `.htaccess` and `sitemap.xml` (built from the pages' own canonical / hreflang / robots)
are written after the build by `src/integrations/seo-files.mjs`. `SITE_NOINDEX=true` (the GitHub Pages
preview) puts `noindex` on every page and skips the sitemap; robots.txt stays `Allow: /` on purpose —
`Disallow` would stop crawlers from ever seeing the `noindex`.
Launch checks for the production domain: `docs/superpowers/notes/2026-09-23-seo-launch-checklist.md`.

## CMS (Storyblok, Stage 4)

Space «Dim Hliba», EU region, Starter limits (3 req/s, 2 locales unused). Pairs `{uk, en}` are two
fields `<key>_uk` / `<key>_en`, not Storyblok's language feature (an untranslated field would silently
fall back to Ukrainian). The model `src/lib/storyblok/model.mjs` is subordinate to the zod schema:
`checkModel()` (tests/cms-model.test.js) fails on any key/type/optional mismatch — a new schema field
needs a model field. `convert.mjs` (`toStory`/`fromStory`, pure; Stage 5 loader) and `components.mjs`
(component JSON) are derived from it. Import (`scripts/cms/`) validates before any request, is
idempotent, writes a fingerprint (`import_hash`, tab «Службове») and refuses to overwrite a story whose
data no longer matches it. Tests run against the in-memory fake API (`tests/helpers/fake-storyblok.js`);
the live space is never touched by `npm test`. Demo content names (`page`, `teaser`, `grid`, `feature`,
story `home`) are reserved — the first `--apply` deletes them and switches the space's default content
type from `page` to `site_page` (Storyblok forbids deleting the default type).

## Deploy

`.github/workflows/deploy.yml`: push to `main` → `npm test` with the Pages `SITE_URL`/`BASE_PATH`
and `SITE_NOINDEX=true` → GitHub Pages. Production hosting (ukraine.com.ua, rsync over SSH) is
pending a domain — see Stage 0 plan, Task 5.

## Next

Stage 5 (Spec 3): Astro reads Storyblok (`fromStory` as the loader), images downloaded at build, preview on Cloudflare Pages, Visual Editor, publish webhook.
Before launch on the domain: production deploy (Stage 0 plan, Task 5) and the SEO launch checklist. Open content gaps for the customer:
`docs/superpowers/notes/2026-09-23-content-gaps.md`.
