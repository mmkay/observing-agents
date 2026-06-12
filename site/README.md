# Site — local development

The site is plain HTML/JS with no build step. It uses `fetch()` to load slides
and docs at runtime, so it must be served over HTTP — opening `index.html`
directly as a `file://` URL will not work.

## Quickstart

From inside the `site/` directory:

```bash
python3 -m http.server 8080
```

Then open <http://localhost:8080>.

Or from the repo root:

```bash
python3 -m http.server 8080 --directory site
```

Any static file server works — the only requirement is that it serves the
`site/` directory at the root so that relative paths like `docs/setup-*.md`
and `slides/index.json` resolve correctly.

## Directory layout

```
site/
  index.html          — single-page shell
  app.js              — routing, docs loader, Reveal.js init
  style.css
  docs/               — Markdown files loaded by the Docs section
  slides/             — Markdown files + index.json for the slide deck
  images/             — Dashboard screenshots
  vendor/             — Reveal.js, marked, mermaid, IBM Plex Mono (all local, no CDN)
```
