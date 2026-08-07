# Personal Engineering Knowledge Graph

A living personal knowledge library for engineering growth, project evidence, career calibration, daily capture, and mentorship.

- **Live app:** https://huygdv.github.io/knowledge-graph/
- **System design:** https://huygdv.github.io/knowledge-graph/system-design-overview/
- **Project changelog:** https://huygdv.github.io/knowledge-graph/changelog/

## Product model

The graph is deliberately split into independent layers:

1. **Canonical graph** — domains, capabilities, concepts, techniques, tools, patterns, and artifacts.
2. **Personal overlay** — Huy's current relationship with a node using a 0–6 mastery scale.
3. **Career profiles** — expectations for a role and level without labeling knowledge as intrinsically junior or senior.
4. **Evidence** — real projects that demonstrate applied knowledge.
5. **Knowledge Inbox** — local-first drafts captured quickly and reviewed before canonical promotion.

## Current capabilities

- 135 canonical nodes and 226 semantic relations
- Hierarchy depth derived from `contains`, up to depth 6
- Library, Career Lens, Growth, Evidence and Focus Realm projections
- Search, deep links, pan/zoom, drag, collapse/expand and inspector
- Responsive tablet/mobile shell, sidebar drawer and bottom-sheet inspector
- Fullscreen canvas with native Fullscreen API and CSS fallback
- Local Knowledge Inbox CRUD, JSON export and canonical proposal copy
- Public system design and data-driven project timeline
- Static validation and GitHub Pages deployment

## Safe authoring boundary

The public static frontend never stores a GitHub token and does not push directly to the canonical graph. Quick Capture writes to device-local `localStorage`; users can review, export, and promote proposals through a validated Git workflow.

## Data layout

```text
site/data/
├── graph.json
├── overlays/huy.public.json
├── profiles/backend-engineer.json
└── project-history.json
```

## Run locally

```bash
python scripts/validate_data.py
python -m json.tool site/data/project-history.json > /dev/null
node --check site/app.js
node --check site/polish.js
node --check site/focus-mode.js
node --check site/responsive-shell.js
node --check site/capture.js
node --check site/changelog/app.js
python -m http.server 8080 --directory site
```

## Architecture documents

- [`docs/ADR-001-zero-build-mvp.md`](docs/ADR-001-zero-build-mvp.md)
- [`docs/ADR-002-canonical-graph-and-projections.md`](docs/ADR-002-canonical-graph-and-projections.md)
- [`docs/SCHEMA.md`](docs/SCHEMA.md)
- [`docs/PRODUCT_REVIEW.md`](docs/PRODUCT_REVIEW.md)
- [`CHANGELOG.md`](CHANGELOG.md)
