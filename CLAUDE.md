# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A static, no-build website for "Дім Хліба" (House of Bread Church), Kryvyi Rih. There is no
package.json, no bundler, and no test suite — every page is a plain `.html` file opened directly
(or via a live server) in the browser. Content is Ukrainian-first with an English toggle.

## Running locally

There is no build step. Open `index.html` directly, or serve the folder with any static server —
the repo's `.vscode/settings.json` configures the Live Server extension on port 5501. There is
nothing to `npm install`, lint, or test.

## `support.js` is generated — never hand-edit it

`support.js` begins with `// GENERATED from dc-runtime/src/*.ts — do not edit. Rebuild with
`cd dc-runtime && bun run build`.` The `dc-runtime` source is not present in this repo. Treat
`support.js` as a vendored build artifact: it implements a custom `<x-dc>` element runtime (parses
`<x-dc>` / `<helmet>` / `<script data-dc-script>` blocks, mounts a `DCLogic`-based component,
handles routing/hydration for the `.dc.html` pages). If a `.dc.html` page needs new behavior, add it
in that page's own `<script type="text/x-dc" data-dc-script>` block, not in `support.js`.

## Page architecture

Two different page shapes coexist:

- **`index.html`** — the single-page main site. All sections (`#home`, `#about`, `#ministries`,
  `#media`, `#union`, `#pastors`, `#contacts`, `#donate`) live in one file, navigated via in-page
  anchors. It has its own inline i18n system (see below) and its own `componentDidMount` logic
  block near the end of the file.
- **`*.dc.html` files** (`church.dc.html`, `churches.dc.html`, `leaders.dc.html`,
  `ministry.dc.html`, `pastors.dc.html`, `report.dc.html`, `reports.dc.html`) — standalone detail /
  listing pages loaded through the `<x-dc>` runtime in `support.js`. Each follows the same
  skeleton:
  ```html
  <script src="./support.js"></script>
  ...
  <x-dc>
    <helmet>...fonts + <style> scoped to this page...</helmet>
    ...markup with data-* hooks (e.g. data-name, data-body, data-stage)...
    <script type="text/x-dc" data-dc-script>
      class Component extends DCLogic {
        componentDidMount(){ /* reads window.HOB_* data, fills in the DOM via data-* hooks */ }
      }
    </script>
  </x-dc>
  ```
  List pages (`churches.dc.html`, `reports.dc.html`) render cards from a `window.HOB_*` array.
  Detail pages (`church.dc.html`, `ministry.dc.html`, `report.dc.html`) read an `?id=` query param,
  find the matching record in the same array, and populate the page (including an image/video
  gallery with prev/next, dots, and thumbnails). `leaders.dc.html` and `pastors.dc.html` are static
  (no `window.HOB_*` data source / no dynamic `data-dc-script` lookup).

## Data files (`*-data.js`)

Content for the `.dc.html` pages lives in plain global-variable JS files, each loaded via a
`<script src="./churches-data.js">`-style tag inside the page's `<helmet>`:

- `churches-data.js` → `window.HOB_CHURCHES` — used by `churches.dc.html` + `church.dc.html`.
- `ministries-data.js` → `window.HOB_MINISTRIES` (+ `window.HOB_ministryMedia(m)` gallery helper) —
  used by the ministries section of `index.html` + `ministry.dc.html`.
- `reports-data.js` → `window.HOB_REPORTS` — used by `reports.dc.html` + `report.dc.html`.

To add/edit a church, ministry, or report, edit the corresponding `-data.js` array — the listing
and detail pages both read from it, so no HTML template changes are needed for ordinary content
updates. Each record's `id` field is the value passed via `?id=` on the matching `.dc.html` detail
page (e.g. `ministry.dc.html?id=youth`).

Media entries use `{type:"image"|"video", src, alt}`. Video `src` accepts a YouTube URL/ID; the
gallery code extracts the video ID and lazy-loads a YouTube iframe embed only when that slide
becomes active.

## i18n on `index.html`

`index.html` has an inline Ukrainian/English toggle: elements are tagged `data-i18n="key.path"`
(text content), `data-i18n-html` (marks that the value contains HTML, e.g. `<em>`), or
`data-i18n-title` (the `title` attribute). A translations dictionary keyed by those dot-paths is
defined inline near the bottom of the file, and `data-lang="uk"|"en"` buttons switch the active
language. The `.dc.html` pages are Ukrainian-only and do not use this system.

## Donations

The donate CTA and the dedicated `#donate` section on `index.html` link out to LiqPay checkout URLs
(`https://www.liqpay.ua/uk/checkout/...`) — there is no in-repo payment integration to modify.

## Conventions to preserve

- CSS custom properties (`--bg`, `--accent`, `--ink-blue`, `--font-display`, etc.) are redeclared at
  the top of every page's `<style>` block rather than shared from one file — keep new pages
  consistent with the existing palette/tokens instead of introducing new ones.
- Icons are inline SVG (`stroke="currentColor"`), not an icon font/library.
- Images largely come from `https://picsum.photos/seed/...` placeholders; `uploads/` holds a small
  number of real uploaded assets.
