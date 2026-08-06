# Personal Engineering Knowledge Graph

A living personal knowledge library for engineering growth, project evidence, career calibration, and mentorship.

**Live:** https://huygdv.github.io/knowledge-graph/

## Product model

The graph is deliberately split into independent layers:

1. **Canonical graph** — describes knowledge itself: domains, capabilities, concepts, techniques, tools, patterns, and artifacts.
2. **Personal overlay** — describes Huy's current relationship with a node using a 0–6 mastery scale.
3. **Career profiles** — describe expectations for a role and level without labeling a knowledge node as intrinsically “junior” or “senior”.
4. **Evidence** — connects knowledge to real projects that demonstrate its application.

This separation lets one graph support daily learning, career development, portfolio evidence, and future mentoring curricula.

## v0.2

- 135 canonical nodes and 226 semantic relations
- Hierarchy depth derived from `contains`, up to depth 6
- Node kinds: `domain`, `capability`, `concept`, `technique`, `tool`, `pattern`, `artifact`
- Four projections:
  - **Library** — explore knowledge by domain and depth
  - **Career Lens** — Fresher → Junior → Middle → Senior → Lead
  - **Growth** — personal mastery overlay
  - **Evidence** — projects and the knowledge they demonstrate
- Public mastery overlay with 110 seed assessments
- Backend Engineer profile with five career levels
- Search, domain filter, deep links, pan/zoom, node dragging, collapse/expand, and inspector
- Static validation and GitHub Pages deployment

## Mastery scale

| Value | Meaning |
|---:|---|
| 0 | Unexplored |
| 1 | Recognize |
| 2 | Understand |
| 3 | Apply |
| 4 | Diagnose |
| 5 | Design |
| 6 | Teach |

Mastery belongs to an overlay, never to a canonical knowledge node.

## Data layout

```text
site/data/
├── graph.json
├── overlays/
│   └── huy.public.json
└── profiles/
    └── backend-engineer.json
```

The v0.1 `knowledge.json` file was removed during the v0.2 migration.

## Run locally

```bash
python scripts/validate_data.py
python -m http.server 8080 --directory site
```

Open `http://localhost:8080`.

## Validate

```bash
python scripts/validate_data.py
node --check site/app.js
```

Validation checks canonical/overlay separation, IDs, relations, hierarchy cycles, evidence references, career profile requirements, and mastery ranges.

## Architecture documents

- [`docs/ADR-001-zero-build-mvp.md`](docs/ADR-001-zero-build-mvp.md)
- [`docs/ADR-002-canonical-graph-and-projections.md`](docs/ADR-002-canonical-graph-and-projections.md)
- [`docs/SCHEMA.md`](docs/SCHEMA.md)
- [`docs/PRODUCT_REVIEW.md`](docs/PRODUCT_REVIEW.md)
