# Knowledge Graph

A portable knowledge-canvas engine for turning research, experience, curricula, and personal knowledge into structured maps that can be explored, deep-dived, exported, and shared.

- **Live app:** https://huygdv.github.io/knowledge-graph/
- **System design:** https://huygdv.github.io/knowledge-graph/system-design-overview/
- **Project changelog:** https://huygdv.github.io/knowledge-graph/changelog/

## Strategic direction

The long-term product thesis is broader than graph visualization:

> **Turn fragmented information into structured, trustworthy, reusable understanding.**

The canvas is a projection of a living knowledge model, not the product boundary. The near-term wedge is to systematize fragmented AI conversations and research into a reviewable Knowledge Pack, while preserving provenance and human control.

The current repository is intended to remain the public representation/exploration foundation; proprietary product intelligence may live above it behind explicit Knowledge Pack and Systematizer contracts.

See:

- [`ADR-003: Product thesis, open foundation, and systematization architecture`](docs/ADR-003-product-thesis-open-core-and-systematization-architecture.md)
- [`v0.4 Systematization Experiment`](docs/V0.4_SYSTEMATIZATION_EXPERIMENT.md)
- [`Systematization Draft Contract`](docs/SYSTEMATIZATION_DRAFT_CONTRACT.md)
- [`Systematizer Interface`](docs/SYSTEMATIZER_INTERFACE.md)
- [`Systematization Evaluation`](docs/SYSTEMATIZATION_EVALUATION.md)

### Public/private systematization boundary

```text
Public foundation
  Markdown / conversation source
          ↓
     SourceAdapter
          ↓
   normalized fragments
          ↓
   Systematizer Request
          │
          │ explicit provider-neutral process contract
          ▼
Private / replaceable intelligence
  model + prompts + orchestration
          ↓
   Draft Contract v0.1
          ↓
Public foundation
  validate → evaluate → human review → compile
          ↓
   Knowledge Pack v1.0
          ↓
        Canvas
```

The public foundation does not require a provider SDK, API key, or proprietary prompt strategy. A concrete systematizer must return a reviewable Draft Contract; it never writes canonical knowledge directly.

## Product model

The application is separated from the data it renders:

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

## v0.4 — Measurable systematization experiment

v0.4 tests the harder thesis: can fragmented source material become a useful structured model with low correction cost and traceable provenance?

Current verified pipeline:

```text
input.md
  ↓
SourceAdapter
  ↓
normalized fragments
  ↓
Systematizer boundary
  ↓
Draft Contract
  ↓
validation + benchmark evaluation
  ↓
human review
  ↓
PackCompiler
  ↓
Knowledge Pack + provenance sidecar
  ↓
existing browser runtime / canvas
```

The benchmark harness deliberately distinguishes gold/fixture self-tests from real model performance. Human correction rate and Time to Structured Understanding (TTSU) remain unmeasured until a genuine model run is reviewed by a human.

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
- Systematization Draft Contract v0.1 and deterministic evaluator
- Stable Markdown SourceAdapter + reviewed-draft PackCompiler
- Provenance sidecar that keeps Knowledge Pack v1.0 canonical data clean
- Provider-neutral Systematizer process interface and reproducible run/config metadata
- Frozen benchmark #001 with deterministic CI gates
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
python scripts/test_systematization_core.py -v
python scripts/test_systematizer_interface.py -v
node --check site/workspace-runtime.js
node --check site/workspace-manager.js
node --check site/app.js
node --check site/focus-mode.js
python -m http.server 8080
```

Open `http://localhost:8080/site/`.

## Quality gates

Pull requests and relevant `main` changes run:

- graph/schema validation
- Knowledge Pack template JSON validation
- JavaScript syntax validation
- runtime script-order checks
- Chromium Deep Dive interaction smoke test
- long-lived Chromium Knowledge Pack smoke test
- mentorship pack browser smoke test
- systematization draft/evaluator regression
- deterministic SourceAdapter → review → PackCompiler pipeline verification
- provider-neutral Systematizer process-contract verification
- browser import/render smoke for a deterministically compiled systematization pack

Fixture/gold benchmark runs verify the harness only; they are never reported as real model quality.

## Architecture documents

- [`docs/KNOWLEDGE_PACK_SCHEMA.md`](docs/KNOWLEDGE_PACK_SCHEMA.md)
- [`docs/SYSTEMATIZATION_DRAFT_CONTRACT.md`](docs/SYSTEMATIZATION_DRAFT_CONTRACT.md)
- [`docs/SYSTEMATIZER_INTERFACE.md`](docs/SYSTEMATIZER_INTERFACE.md)
- [`docs/SYSTEMATIZATION_EVALUATION.md`](docs/SYSTEMATIZATION_EVALUATION.md)
- [`docs/V0.4_SYSTEMATIZATION_EXPERIMENT.md`](docs/V0.4_SYSTEMATIZATION_EXPERIMENT.md)
- [`docs/V0.4_IMPLEMENTATION_BACKLOG.md`](docs/V0.4_IMPLEMENTATION_BACKLOG.md)
- [`docs/ADR-001-zero-build-mvp.md`](docs/ADR-001-zero-build-mvp.md)
- [`docs/ADR-002-canonical-graph-and-projections.md`](docs/ADR-002-canonical-graph-and-projections.md)
- [`docs/ADR-003-product-thesis-open-core-and-systematization-architecture.md`](docs/ADR-003-product-thesis-open-core-and-systematization-architecture.md)
- [`docs/SCHEMA.md`](docs/SCHEMA.md)
- [`docs/PRODUCT_REVIEW.md`](docs/PRODUCT_REVIEW.md)
- [`CHANGELOG.md`](CHANGELOG.md)
