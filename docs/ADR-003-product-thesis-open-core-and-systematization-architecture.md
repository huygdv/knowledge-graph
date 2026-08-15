# ADR-003: Product thesis, open foundation, and systematization architecture

- **Status:** Accepted for v0.4 validation
- **Date:** 2026-08-15
- **Decision type:** Product strategy + architecture boundary

## Context

Knowledge Graph started as a personal engineering knowledge map. Through v0.1–v0.3 it evolved into a reusable canvas with multiple projections, Deep Dive, local workspaces, import/export, and a versioned Knowledge Pack format.

The stronger problem is not graph visualization itself.

People increasingly accumulate fragmented information across AI conversations, documents, notes, posts, repositories, meetings, research, and personal observations. AI chat is good at answering an individual prompt, but the resulting knowledge often remains distributed across many isolated threads and artifacts. When a person or team later needs an overview, roadmap, mental model, or decision framework, reconstructing the whole picture is slow and error-prone.

More information does not automatically produce structured understanding.

The strategic opportunity is therefore broader than a canvas:

> Turn fragmented information into structured, trustworthy, reusable understanding.

The canvas is one projection of that understanding, not the product boundary.

## Decision

### 1. Product thesis

The product is a **systematization engine** for transforming fragmented information into a living knowledge model that can be explored, reviewed, extended, shared, and projected into useful forms.

Internal vision:

> **Systematize anything you know.**

Near-term wedge:

> **Systematize fragmented AI conversations and research into a trustworthy structured knowledge model.**

The narrow wedge is intentional. The architecture may support broader domains, but v0.4 must prove the transformation quality before the product expands to more source types or collaboration features.

### 2. Core product flow

```text
Raw knowledge
  ├── AI conversations
  ├── Markdown / notes
  ├── documents
  ├── posts / bookmarks
  ├── repositories
  └── research fragments
          ↓
Source adapters
          ↓
Fragment normalization
          ↓
Systematization engine
  ├── concept extraction
  ├── claim extraction
  ├── entity / concept resolution
  ├── deduplication
  ├── hierarchy construction
  ├── relation inference
  ├── provenance attachment
  ├── confidence / uncertainty
  └── conflict detection
          ↓
Draft knowledge model
          ↓
Human review + diff
          ↓
Validated Knowledge Pack
          ↓
Projections
  ├── Canvas / Library
  ├── Focus Realm
  ├── Roadmap
  ├── Timeline
  ├── Curriculum
  ├── Decision map
  └── future projections
```

No source is allowed to bypass validation and silently mutate the canonical knowledge model.

### 3. Knowledge Pack is the portable interchange artifact

`Knowledge Pack` remains the stable boundary between knowledge creation and knowledge consumption.

The canvas engine consumes Knowledge Packs. Future systematization engines, adapters, third-party tools, and AI agents may also produce Knowledge Packs.

This lets the representation layer evolve independently from the intelligence layer.

Current v1.0 pack primitives remain compatible with the existing graph model. The architecture must, however, leave room for the following long-term primitives without requiring an immediate schema migration:

```text
Knowledge model
├── Node
├── Relation
├── Claim
├── Source
├── Evidence
├── Inference
└── Temporal context
```

`Claim`, `Source`, `Evidence`, and `Inference` are architectural primitives for future schema evolution, not mandatory v0.4 fields.

### 4. Provenance-first trust model

The system must never become a graph generator that merely produces plausible-looking structure.

For machine-generated knowledge, users must eventually be able to answer:

- Where did this concept or claim come from?
- Which source supports it?
- Was the relation explicitly stated or inferred?
- What confidence does the system have?
- Are there contradictory sources or alternative interpretations?
- What changed when new information was added?

Therefore:

- explicit source evidence is preferred over unsupported synthesis;
- machine inference must be distinguishable from source-backed facts;
- generated mutations must be reviewable before canonical acceptance;
- confidence must never be presented as certainty when the evidence is weak;
- provenance must survive export/import where the relevant schema supports it.

### 5. Human review is a product feature, not a temporary limitation

AI should reduce the cost of systematization, not remove human agency from knowledge modeling.

The default AI transformation flow is:

```text
Generate draft → validate → preview diff → human accept/edit/reject → canonicalize
```

The user must be able to correct structure before it becomes canonical. Human corrections are also valuable feedback for improving the systematization engine later.

### 6. Open-foundation / private-intelligence boundary

The current repository should remain the **public foundation** rather than becoming the private product monolith.

The intended public foundation contains:

- Knowledge Pack specification;
- validation rules;
- canvas / projection engine;
- local workspace repository;
- import/export;
- local-first authoring and review primitives;
- adapter interfaces and example adapters where they do not expose proprietary intelligence;
- templates and reference Knowledge Packs.

The strategic proprietary product may contain:

- high-quality multi-source ingestion;
- systematization orchestration;
- concept/entity resolution across large histories;
- deduplication intelligence;
- claim and relation inference;
- provenance reasoning;
- contradiction and change detection;
- continuous knowledge updating;
- personal/team recommendations;
- cloud sync and collaboration;
- organization-level governance, permissions, analytics, and automation.

The principle is:

> **Open the representation layer. Own the intelligence layer.**

Public foundation and proprietary product must communicate through explicit interfaces such as Knowledge Pack and adapter contracts. Proprietary intelligence must not become a hidden dependency required to use the public canvas locally.

A formal open-source license is a separate decision. Until a license is intentionally selected, public source availability must not be described as a completed open-source licensing decision.

### 7. Local-first remains the default trust boundary

Personal knowledge may contain private conversations, unfinished ideas, work context, or confidential organizational information.

Therefore:

- local workspaces remain useful without authentication or cloud services;
- importing a private corpus must not imply uploading it to a public repository;
- future cloud features must be additive rather than mandatory for basic ownership/export;
- users must retain the ability to export their structured knowledge in a portable format.

### 8. The canvas is a projection, not the domain model

No future data-model decision should be made solely because it makes the graph visualization easier.

The same living knowledge model should eventually support different jobs:

```text
Knowledge model
├── Overview / Canvas
├── Deep Dive
├── Roadmap
├── Timeline
├── Curriculum
├── Report
├── Decision support
└── Agent context
```

This protects the product from becoming a generic mind-map editor.

## Non-goals

The project is not trying to become:

- a Notion clone;
- an Obsidian clone;
- a generic mind-map editor;
- a generic whiteboard;
- a vector database UI;
- a generic RAG chatbot;
- a generic LLM wrapper;
- a project-management suite;
- an autonomous truth engine that removes human review.

A feature that does not materially improve **systematization, trust, review, or consumption of structured knowledge** requires explicit justification before entering the roadmap.

## Strategic metric

The primary product metric is not node count.

The working north-star metric is:

> **Time to Structured Understanding (TTSU)** — the elapsed effort from fragmented source material to a useful, trusted, editable system model.

Supporting quality metrics:

- structural acceptance rate;
- human correction rate;
- relation precision;
- duplicate concept rate;
- source coverage;
- provenance coverage;
- unresolved conflict count;
- time saved versus manual synthesis;
- percentage of generated changes accepted without structural rewrite.

Metrics should measure usefulness and trust, not graph size.

## v0.4 validation experiment

v0.4 is deliberately a **Systematization Prototype**, not a canvas feature release.

### Scope

One input adapter only:

```text
Pasted Markdown / exported AI conversation
              ↓
      systematization prototype
              ↓
      Draft Knowledge Pack
              ↓
          validation
              ↓
        reviewable diff
              ↓
             Canvas
```

Out of scope for v0.4:

- Gmail/Notion/Drive connectors;
- continuous sync;
- team collaboration;
- authentication;
- vector database infrastructure;
- multi-tenant SaaS;
- autonomous canonical updates;
- broad file-format support.

### Prototype requirements

The prototype must:

1. accept pasted Markdown or exported conversation text;
2. preserve the original source as a traceable input artifact;
3. produce a schema-valid draft Knowledge Pack;
4. identify root topics, concepts, and useful semantic relations;
5. avoid duplicate concepts where reasonable;
6. distinguish extracted structure from inferred structure where possible;
7. show a human-reviewable diff before import;
8. allow reject/edit/accept rather than forcing generated output into the workspace;
9. render the accepted result using the existing canvas and Focus Realm;
10. preserve existing import/export and local workspace behavior.

### Initial success criteria

These are prototype targets, not permanent SLAs:

- **100% schema validity** after the transformation pipeline completes;
- **0 dangling edge references** and **0 hierarchy cycles** after validation;
- all machine-generated structural changes are visible in a review step before canonical import;
- the user can identify the major topics and relationships of a representative research corpus without reopening every original fragment;
- manual structural corrections should remain below roughly **20–30%** on the initial benchmark corpus;
- the resulting overview should take materially less effort than manually rebuilding the same mental model.

### Falsification / stop condition

The thesis is not considered validated merely because the model can generate a graph.

Pause feature expansion and revisit the product thesis if, across several representative corpora:

- generated structure repeatedly requires major manual reconstruction;
- relation quality is too low to trust without re-reading most sources;
- provenance cannot explain why important structure exists;
- users prefer a normal summary/document because the structured model adds little decision or learning value;
- TTSU is not meaningfully better than manual synthesis.

Failure of the experiment is useful evidence and should trigger architecture/product review rather than additional visualization work.

## Decision filters for future features

Before adding a significant feature, ask:

1. Does it reduce Time to Structured Understanding?
2. Does it increase structural quality or trust?
3. Does it improve human review/correction?
4. Does it make structured knowledge more reusable across projections?
5. Does it strengthen the open representation layer without leaking proprietary intelligence?
6. Is there observed product pressure, or are we designing for imagined scale?

If the answers are mostly no, defer the feature.

## Consequences

### Positive

- Clarifies that the strategic product is systematization, not graph rendering.
- Gives the public repository a durable purpose as a portable representation and exploration foundation.
- Creates a clean boundary for a future proprietary intelligence product.
- Keeps local-first trust and data portability as first-class properties.
- Makes v0.4 falsifiable instead of allowing endless feature accumulation.
- Leaves room for roadmap, timeline, curriculum, causal, and other projections without distorting the canonical model.

### Negative

- Provenance and review make the architecture more complex than a simple LLM-to-graph demo.
- Open/public compatibility will create schema and migration obligations over time.
- Maintaining a public foundation and private intelligence layer requires explicit interfaces and release discipline.
- High-quality systematization is technically harder than visualization and may require benchmark corpora and evaluation infrastructure.
- The product wedge must remain narrow until transformation quality is proven.

## Follow-up decisions

1. Define the v0.4 draft/review data contract before implementing AI transformation.
2. Create a small benchmark corpus from real fragmented research/conversation material and retain expected human structure for comparison.
3. Decide how `Source`, `Claim`, `Evidence`, and `Inference` enter a future Knowledge Pack schema without breaking v1.0 imports.
4. Define an adapter interface that keeps model/provider choice outside the canonical schema.
5. Select an explicit public-repository license in a separate licensing ADR before marketing the foundation as formally open source.
6. Decide the repository/product boundary before proprietary systematization code is introduced.
7. Update the public System Design Overview when the v0.4 prototype architecture is implemented.

## Revisit triggers

Revisit this ADR when any of the following becomes true:

- v0.4 fails its systematization experiment;
- a second independent consumer needs the Knowledge Pack specification;
- cloud synchronization or team collaboration becomes necessary;
- proprietary intelligence needs interfaces not representable through the current Knowledge Pack boundary;
- schema evolution introduces first-class claims/provenance;
- a commercial licensing or investment decision requires a different open/private boundary.
