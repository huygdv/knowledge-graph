# Knowledge Graph

A portable knowledge-canvas engine for turning research, experience, curricula, and personal knowledge into structured maps that can be explored, deep-dived, exported, and shared.

- **Live app:** https://huygdv.github.io/knowledge-graph/
- **System design:** https://huygdv.github.io/knowledge-graph/system-design-overview/
- **Project changelog:** https://huygdv.github.io/knowledge-graph/changelog/

## Product model

The application is now separated from the data it renders:

```text
Knowledge Graph App
└── Workspace / Knowledge Pack
    ├── Manifest
    ├── Canonical graph
    ├── Personal overlay
    ├── Optional profiles
    ├── View hints
    └── Knowledge Inbox
```

**Fullstack Engineering is the built-in pack, not the application itself.** A user can import another `.kg.json` pack and use the same Library, Focus Realm, search, responsive canvas, and authoring experience for any topic.

## v0.3 — Knowledge Packs

### Workspace workflow

1. Open the **Workspace** selector in the toolbar.
2. Choose one of:
   - **New blank** — create a local workspace with a root domain.
   - **Import pack** — select a `.kg.json` file; validation and preview happen before anything is saved.
   - **Use example** — preview a ready-made Agent Reliability research pack.
   - **Export current** — download the active workspace as a portable `.kg.json` file.
3. Switch between Fullstack Engineering and local workspaces from the same manager.

Local workspaces are persisted in **IndexedDB**. Only the active workspace ID and lightweight UI preferences stay in `localStorage`.

### Bring your own research

Download a template from Workspace Manager:

- `site/templates/minimal.kg.json` — compact starting structure.
- `site/templates/example.kg.json` — worked example showing how research becomes a systematic map.

You can give either template to an AI assistant together with your notes and ask it to convert the research into the same schema, then import the resulting `.kg.json` file into Knowledge Graph.

### Import safety

Before persistence, the browser validates:

- Knowledge Pack schema version
- stable workspace identity
- duplicate node IDs
- supported node and relation kinds
- dangling relations
- hierarchy cycles / multiple parents
- personal state leaking into canonical nodes
- overlay references and mastery range
- profile requirement references

Invalid packs are previewed with errors and **never written to IndexedDB**.

Schema reference: [`docs/KNOWLEDGE_PACK_SCHEMA.md`](docs/KNOWLEDGE_PACK_SCHEMA.md).

## Knowledge model

Each pack keeps different concerns independent:

1. **Canonical graph** — domains, capabilities, concepts, techniques, tools, patterns, and artifacts.
2. **Personal overlay** — a user's relationship with nodes using the 0–6 mastery scale.
3. **Profiles** — optional expectations or rubrics; packs without one use a neutral Explorer fallback.
4. **Evidence** — artifact relations that show where knowledge was applied.
5. **Knowledge Inbox** — local-first drafts scoped independently per workspace.

## Current capabilities

- Built-in Fullstack Engineering pack: 135 canonical nodes and 226 semantic relations
- Reusable `.kg.json` Knowledge Pack schema `1.0`
- IndexedDB-backed multiple local workspaces
- Import validation + preview, export, create, rename, delete, and switch
- Per-workspace Knowledge Inbox
- Library, Career Lens, Growth, Evidence and Focus Realm projections
- Search, deep links, pan/zoom, Navigate/Edit interaction modes, collapse/expand and inspector
- Responsive desktop/tablet/mobile shell and two-finger pinch zoom
- Fullscreen canvas
- Public System Design Overview and data-driven project changelog
- Chromium browser regression gates before deployment

## Storage boundary

```text
Portable .kg.json
      ↓ import + validate
Workspace Repository
      ↓
IndexedDB (local packs)
      ↓
Workspace data bridge
      ↓
Existing canvas / projections
```

The public frontend contains no GitHub token. Canonical GitHub-hosted content still changes through reviewed commits; imported personal workspaces stay on the device until the user explicitly exports them.

This repository boundary is intentionally compatible with a future replacement:

```text
IndexedDB Repository
        ↓ later
Authenticated API Repository
        ↓
Users / teams / tenants / sync
```

## Run locally

```bash
python scripts/validate_data.py
python -m json.tool site/data/project-history.json > /dev/null
python -m json.tool site/templates/minimal.kg.json > /dev/null
python -m json.tool site/templates/example.kg.json > /dev/null
node --check site/workspace-runtime.js
node --check site/workspace-manager.js
node --check site/app.js
node --check site/focus-mode.js
python -m http.server 8080
```

Open `http://localhost:8080/site/`.

## Quality gates

Pull requests and `main` deployments run:

- graph/schema validation
- Knowledge Pack template JSON validation
- JavaScript syntax validation
- runtime script-order checks
- Chromium Deep Dive interaction smoke test
- long-lived Chromium Knowledge Pack smoke test covering Workspace Manager UI, template preview, validation, IndexedDB persistence, custom graph reload, export, workspace-scoped inbox, switch-back, and cleanup

GitHub Pages deploys only after these gates pass.

## Architecture documents

- [`docs/KNOWLEDGE_PACK_SCHEMA.md`](docs/KNOWLEDGE_PACK_SCHEMA.md)
- [`docs/ADR-001-zero-build-mvp.md`](docs/ADR-001-zero-build-mvp.md)
- [`docs/ADR-002-canonical-graph-and-projections.md`](docs/ADR-002-canonical-graph-and-projections.md)
- [`docs/SCHEMA.md`](docs/SCHEMA.md)
- [`docs/PRODUCT_REVIEW.md`](docs/PRODUCT_REVIEW.md)
- [`CHANGELOG.md`](CHANGELOG.md)
