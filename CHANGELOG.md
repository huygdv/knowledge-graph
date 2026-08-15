# Changelog

The public, data-driven timeline is available at:

- https://huygdv.github.io/knowledge-graph/changelog/

## Strategic ADR-003 — 2026-08-15

### Product thesis

- Reframed the strategic product from a graph viewer into a **systematization engine**: turn fragmented information into structured, trustworthy, reusable understanding.
- Defined the near-term wedge as fragmented AI conversations and research → reviewable Knowledge Pack.
- Defined `Knowledge Pack` as the portable boundary between knowledge creation and knowledge consumption.
- Established provenance-first trust, explicit human review, and local-first ownership as product principles.

### Open / private boundary

- Keep the current repository as the intended public representation and exploration foundation.
- Keep strategic systematization intelligence, large-history resolution, continuous updating, collaboration, and organization features eligible for a separate proprietary product layer.
- Formal open-source licensing remains a separate decision; public source availability is not treated as a completed licensing decision.

### v0.4 decision gate

- v0.4 is a **Systematization Prototype**, not another canvas feature release.
- Initial experiment: pasted Markdown / exported AI conversation → draft Knowledge Pack → validation → reviewable diff → accepted canvas.
- Introduced **Time to Structured Understanding (TTSU)** as the working north-star metric.
- Added explicit stop/falsification criteria so low-quality generated structure triggers product review instead of more visualization features.

See [`docs/ADR-003-product-thesis-open-core-and-systematization-architecture.md`](docs/ADR-003-product-thesis-open-core-and-systematization-architecture.md).

## v0.3.0 — 2026-08-11

### Added

- Reframed the product as a reusable **Knowledge Graph engine** with independent **Knowledge Packs / Workspaces**.
- Fullstack Engineering remains available as the built-in pack instead of being hard-coded as the only product dataset.
- Added Workspace Manager with switch, create blank, rename, delete, import, export, and example-preview flows.
- Added portable `.kg.json` schema version `1.0` with manifest, canonical graph, overlay, optional profiles, view hints, and inbox data.
- Added downloadable minimal and worked example templates for converting existing research into importable structured maps.
- Added IndexedDB-backed persistence for multiple local workspaces.
- Added per-workspace Knowledge Inbox isolation.
- Added neutral General Explorer profile fallback so domain packs without career data still use the same canvas engine safely.
- Added [`docs/KNOWLEDGE_PACK_SCHEMA.md`](docs/KNOWLEDGE_PACK_SCHEMA.md).

### Import safety

- Imports are validated and previewed before persistence.
- Validation covers schema compatibility, duplicate IDs, relation kinds, dangling edges, hierarchy cycles/multiple parents, canonical/personal separation, overlay references, mastery range, and profile references.
- Invalid packs never write to IndexedDB.

### Verification

- Existing Chromium Deep Dive regression smoke remains required.
- Added long-lived Chromium workspace smoke for IndexedDB flows.
- Workspace browser QA verifies the real Workspace Manager, template links, `Use example` validation preview, custom pack persistence across reload, custom graph rendering, portable export, workspace-scoped inbox, switching back to the built-in pack, and cleanup.
- Pull request #2 is gated on both browser suites before merge.

## v0.2.4.1 — 2026-08-07

### Fixed

- Fixed a Focus Realm main-thread freeze caused by a `MutationObserver` watching `body.class` and mutating the same class attribute on every callback.
- Focus Realm state synchronization is now transition-based and idempotent.
- `inspector-open` is removed only when it is actually present, preventing recursive observer scheduling.

### Verification

- Added an actual Chromium browser smoke test instead of relying on syntax checks alone.
- The smoke flow verifies: single click selects only → double click enters Focus Realm → Focus Realm renders nodes → header Capture/Menu actions respond → Exit returns to the outer canvas.
- GitHub Pages deployment is gated by this browser interaction smoke test.
- Pull requests execute the same validation path without deploying Pages.
- QA PR #1 / GitHub Actions run #72 completed successfully before the QA PR was closed without merge.

## v0.2.4 — 2026-08-07

### Fixed

- Quick Capture on tablet/touch devices now opens immediately instead of waiting for graph data before showing the dialog.
- Touch devices no longer autofocus the capture title field, avoiding keyboard/viewport jump and popup flicker.
- Heavy dialog backdrop blur is disabled on coarse-pointer devices.
- Single click now only selects a node; pointer users enter Deep Dive only through double-click/double-tap.
- Nested Focus Realm navigation follows the same double-activation rule.
- Tablet/mobile Focus Realm no longer lays itself out as an artificial 720px radial canvas.
- Focus Realm detail content is visible again on mobile and given more vertical spacing.
- Regular inspector is closed automatically when entering Focus Realm so it cannot cover the immersive view.

### Added

- Responsive Focus Realm “scrollable constellation” layout for tablet/mobile.
- Focus Realm header actions for menu, Quick Capture and fullscreen.
- Stable graph prefetching for the local-first capture workflow.

## v0.2.3 — 2026-08-07

### Fixed

- Deep Dive now recognizes double-click/double-tap by stable node ID instead of relying on native `dblclick` across re-rendered DOM nodes.
- Desktop menu now collapses/restores the sidebar and persists the preference.
- Tablet/mobile canvas supports two-finger pinch zoom.
- Navigate mode prevents accidental node dragging while panning, including when the gesture starts directly on a node.
- Panning a node in Navigate mode no longer causes a false selection after release.

### Added

- Explicit canvas interaction modes inspired by design tools:
  - **Navigate (H)** — safe default for pan, inspect and deep dive.
  - **Edit (V)** — enables node layout dragging.
- Touch/pen gesture bridge that reuses the core canvas state instead of maintaining a competing transform model.

## v0.2.2 — 2026-08-07

### Added

- Responsive desktop/tablet/mobile shell
- Sidebar drawer and mobile bottom-sheet inspector
- Native fullscreen canvas with CSS fallback
- Local-first Quick Capture and Knowledge Inbox CRUD
- JSON export and canonical node proposal generation
- Public System Design Overview
- Public data-driven project timeline/changelog

### Architecture

Canonical graph editing remains outside the public frontend security boundary. The browser can safely manage local drafts, while canonical updates continue through reviewed Git changes and validation.

## v0.2.1 — 2026-08-07

- Focus Realm deep-dive projection
- Radial scoped graph, breadcrumb and back navigation
- Reduced-motion support

## v0.2.0 — 2026-08-06

- Canonical graph + personal overlay + career profile separation
- 135 nodes, 226 relations and hierarchy depth up to 6
- Library, Career Lens, Growth and Evidence projections

## v0.1.0 — 2026-08-06

- Zero-build static MVP
- Search, filter, pan/zoom, inspector and GitHub Pages deployment
