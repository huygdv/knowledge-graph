# ADR-002: Separate canonical knowledge from personal and career projections

- **Status:** Accepted
- **Date:** 2026-08-06

## Context

The v0.1 schema stored `status` and a generic `level` directly on knowledge nodes. That made the graph behave like a learning tracker and mixed three different questions:

1. What is this knowledge?
2. How well does a person currently know it?
3. What depth does a role or career level expect?

A concept such as database indexing is not intrinsically junior or senior. The expected depth changes by role, context, and outcome. Personal mastery also changes over time and may contain information that should not be public.

## Decision

Use one canonical graph with independent projections:

- `graph.json` contains objective knowledge structure and semantic relations.
- `overlays/*.json` contain person-specific mastery, notes, and evidence references.
- `profiles/*.json` contain role/level expectations and observable outcomes.
- artifacts remain canonical nodes and connect to knowledge through `applied_in` edges.

Hierarchy depth is derived from `contains` edges. It is never stored on nodes.

## Consequences

### Positive

- The same graph can power library, career, growth, evidence, and mentor views.
- Public and private overlays can coexist without duplicating the graph.
- Career levels can expect different mastery for the same node.
- Knowledge can grow deeper without turning every node into a learning task.
- Project evidence becomes reusable for portfolio, review, and mentoring.

### Negative

- The UI must merge several files at runtime.
- Validation becomes more important because references cross data layers.
- Career profiles require deliberate maintenance and observable outcome wording.

## Follow-up

- Add a private overlay adapter when personal notes should no longer be public.
- Add curriculum files after real mentoring sessions reveal repeatable teaching sequences.
- Add additional role profiles only when they have a concrete user or decision use case.
