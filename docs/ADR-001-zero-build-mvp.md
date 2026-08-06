# ADR-001: Use a zero-build static app for MVP

- **Status:** Accepted
- **Date:** 2026-08-06

## Context

The first release must validate the information architecture and daily usefulness of a personal knowledge graph. It does not yet require collaboration, server-side queries, or rich editing.

## Decision

Use native browser modules, HTML, CSS, SVG, and JSON. Deploy the `site/` directory directly to GitHub Pages. Validate graph integrity with a small Python script in CI.

## Consequences

### Positive

- No npm install or build chain.
- Fast local preview and deterministic GitHub Pages deploy.
- Very small operational surface.
- Domain data remains portable.

### Negative

- Interaction code is more manual than React Flow.
- Complex editing and plugin-style custom nodes will eventually justify a framework migration.

## Migration triggers

Move to React + React Flow when at least one is true:

- More than roughly 150 nodes must be visible at once.
- The product needs an in-browser editor with undo/redo.
- Multiple graph projections share substantial interaction state.
- Custom node/edge plugins are needed.
- Automated visual regression and component-level testing provide clear value.
