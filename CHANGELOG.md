# Changelog

The public, data-driven timeline is available at:

- https://huygdv.github.io/knowledge-graph/changelog/

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
