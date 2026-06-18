#!/usr/bin/env bash
set -euo pipefail

# Exports the reveal.js deck (site/) to PDF as an offline backup:
#   - presentation-full.pdf   the whole deck, dark theme, 16:9, with a full
#                             notes page after every slide (reveal.js's
#                             print-pdf "separate-page" notes layout) - a
#                             single self-contained fallback file.
#   - presentation-slides.pdf just the slides, same look, no notes pages.
#   - presentation-notes.pdf  a standalone, light-themed, normal-sized-font
#                             notes booklet (one slide's notes per A4 page)
#                             meant to be printed on paper.
#
# Lives at the repo root (not in site/) so it never gets published to
# GitHub Pages along with the rest of site/.
#
# Prerequisites:
#   - The site must already be served over HTTP (see site/README.md),
#     since slides/docs are loaded via fetch() and won't work over file://.
#   - A system Google Chrome install (used via Playwright's "chrome"
#     channel, so no separate browser download is needed).
#   - uv (https://docs.astral.sh/uv/) to run Playwright.
#
# Usage:
#   ./export-pdf.sh [url] [output-dir]
#
# Defaults:
#   url:        http://localhost:8000
#   output-dir: ./export (relative to this script, i.e. repo-root/export)

URL="${1:-http://localhost:8000}"
OUT_DIR="${2:-$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/export}"

mkdir -p "$OUT_DIR"

uv run --with playwright python3 - "$URL" "$OUT_DIR" <<'PY'
import html
import sys

from playwright.sync_api import sync_playwright

url, out_dir = sys.argv[1], sys.argv[2]
full_pdf = f"{out_dir}/presentation-full.pdf"
slides_pdf = f"{out_dir}/presentation-slides.pdf"
notes_pdf = f"{out_dir}/presentation-notes.pdf"


def load_deck(page, extra_query=""):
    page.goto(f"{url}/?print-pdf&controls=false&width=1920&height=1080{extra_query}", wait_until="load")
    # The deck is fetched and rendered client-side, so wait for actual
    # slide content rather than just the "load" event.
    page.wait_for_function(
        "document.querySelectorAll('#reveal-slides > section').length > 0",
        timeout=30000,
    )
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(500)  # let async Mermaid diagram rendering finish


with sync_playwright() as p:
    browser = p.chromium.launch(channel="chrome", headless=True)

    print(f"Exporting full deck (with notes pages) -> {full_pdf} ...")
    full_page = browser.new_page()
    load_deck(full_page)
    full_page.pdf(path=full_pdf, print_background=True, prefer_css_page_size=True)

    print(f"Exporting slides-only deck -> {slides_pdf} ...")
    slides_page = browser.new_page()
    load_deck(slides_page, "&showNotes=false")
    slides_page.pdf(path=slides_pdf, print_background=True, prefer_css_page_size=True)

    print(f"Extracting speaker notes -> {notes_pdf} ...")
    # reveal.js's print-pdf mode relocates slide content out of #reveal-slides
    # into separate absolutely-positioned page wrappers for pagination, so
    # notes are extracted from a plain (non-print) page load instead.
    notes_page_src = browser.new_page()
    notes_page_src.goto(f"{url}/?controls=false", wait_until="load")
    notes_page_src.wait_for_function(
        "document.querySelectorAll('#reveal-slides > section').length > 0",
        timeout=30000,
    )
    slides_data = notes_page_src.evaluate("""
        () => Array.from(document.querySelectorAll('#reveal-slides > section')).map((s, i) => ({
            index: i + 1,
            title: (s.querySelector('h1, h2, h3')?.textContent || '').trim(),
            notesHtml: s.querySelector(':scope > aside.notes')?.innerHTML || '',
        }))
    """)
    notes_page_src.close()

    sections_html = []
    for s in slides_data:
        title = html.escape(s["title"]) or f"Slide {s['index']}"
        sections_html.append(
            f'<section><h2>{s["index"]}. {title}</h2>'
            f'<div class="notes-body">{s["notesHtml"]}</div></section>'
        )

    notes_html = f"""<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
  body {{ font-family: 'Helvetica Neue', Arial, sans-serif; color: #111; background: #fff; margin: 0; }}
  section {{ padding: 48px 56px; page-break-after: always; }}
  section:last-child {{ page-break-after: auto; }}
  h2 {{ font-size: 16pt; color: #555; font-weight: 600; margin: 0 0 18pt 0; border-bottom: 1px solid #ddd; padding-bottom: 8pt; }}
  .notes-body {{ font-size: 15pt; line-height: 1.6; }}
  .notes-body p {{ margin: 0 0 12pt 0; }}
</style></head><body>{''.join(sections_html)}</body></html>"""

    notes_page = browser.new_page()
    notes_page.set_content(notes_html)
    notes_page.pdf(path=notes_pdf, print_background=True, format="A4")

    browser.close()

print(f"{len(slides_data)} slides exported.")
print("Done:")
print(f"  {full_pdf}")
print(f"  {slides_pdf}")
print(f"  {notes_pdf}")
PY
