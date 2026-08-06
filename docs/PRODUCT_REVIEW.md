# Product review v0.1 — Tech Lead × Solution Architect × Product Owner

## Product thesis

Knowledge Canvas is not a generic whiteboard. It is a personal knowledge graph with multiple projections: roadmap, library, skill map, and project evidence.

## Tech Lead review

- Keep the first release read-only. Building an editor before the information model is proven creates a large testing and interaction burden.
- Treat content as code. Pull requests become the initial authoring, review, versioning, and rollback workflow.
- Validate node IDs, edge references, and schema before every deployment.
- Use a zero-build static implementation for the first product experiment. It removes package and build-chain risk while preserving the graph domain model.
- Seed the app with real data. Mock content hides information-architecture problems.

## Solution Architect review

- The canonical model is a graph; the canvas is only one projection.
- Keep stable global IDs (`area.backend`, `topic.postgresql`, `artifact.dw-kit`) so data can later be reused by Causari, BigTimeline, or agent tooling.
- Static architecture for v0.1: JSON → validation → browser modules → GitHub Pages.
- Do not introduce React, a graph database, or a backend until a concrete use case requires them.
- Relation semantics remain explicit: `contains`, `requires`, `relates_to`, `applied_in`.
- Migration trigger to React Flow: more than ~150 visible nodes, custom node plugins, rich editing, or multiple projections sharing complex interaction state.

## Product Owner review

Primary job-to-be-done:

> Help me locate a concept quickly, understand where it sits, see what it depends on, and connect it to evidence from my actual projects.

The MVP succeeds when the owner can:

1. Scan the top-level knowledge areas.
2. Drill into a field without seeing the entire graph.
3. Search a topic or tag in seconds.
4. Understand direct relationships in one inspector.
5. Add knowledge through a reviewed data change and redeploy automatically.

## Explicitly deferred

- In-browser editing
- Authentication and cloud database
- Collaboration
- AI-generated roadmaps
- Freehand drawing
- Realtime sync
- Public marketplace/community roadmaps

## Risks and mitigations

| Risk | Mitigation |
|---|---|
| Canvas becomes unreadable | Progressive expansion, filters, contextual dimming |
| Taxonomy becomes inconsistent | Small schema, stable IDs, validation and PR review |
| Product becomes a bookmark store | Require summaries, relations, status, and project evidence |
| Overengineering for future integrations | Stable IDs and adapters later; no shared runtime now |
| Static prototype becomes permanent debt | Explicit migration triggers and isolated domain data |

## Next product experiment

Use the MVP for two weeks and log the questions it fails to answer. The next projection or schema field should be justified by repeated real questions, not imagined completeness.
