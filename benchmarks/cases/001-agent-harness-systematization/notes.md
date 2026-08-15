# Benchmark 001 Notes

## Why this case

This corpus is useful as the first real systematization benchmark because the material is fragmented but not random. It contains:

- overlapping descriptions of the harness boundary;
- explicit and implicit hierarchy;
- several semantic relations that should be inferred rather than quoted as facts;
- safety, verification, observability, workflow, and product-boundary concepts;
- repeated vocabulary that can trigger duplication (`loop`, `workflow`, `orchestration`, `evaluation`);
- enough structure to judge whether a graph adds value over a flat summary.

The source was curated from prior internal research discussions/notes. It is frozen for benchmark comparison.

## What the case should test

A good systematizer should recover a mental model close to:

```text
Agent Harness
├── Control Loop
│   └── Retry and Iteration Budget
├── Context and Memory
├── Tool Execution
│   └── requires → Safety and Governance
├── Safety and Governance
│   ├── Human Approval Gate
│   └── Sandboxing
├── Verification and Observability
│   └── Production Traces
├── Reusable Skills and Workflows
│   └── Skill Contract
└── Harness vs Orchestrator
```

It should also infer that a reliable control loop requires verification, without pretending that every inferred relation is a direct quotation from one source fragment.

## Known ambiguities

These are intentionally not over-specified in `expected-structure.json`:

- evaluation may be modeled as its own capability or combined with verification/observability;
- context and memory may be split into two concepts in a richer graph;
- execution environment may deserve a dedicated capability;
- workflow orchestration may be a separate concept under reusable workflows;
- safety controls may be patterns, concepts, or techniques depending on the chosen ontology.

A transformer should not fail simply for choosing another defensible decomposition. The expected file defines minimum semantic anchors, not one perfect graph.

## Benchmark maintenance rule

Change expectations only when a human reviewer can explain why the previous expected model was wrong or unnecessarily restrictive. Never change the benchmark just to accommodate the latest model output.

## Manual baseline measurement

Do not fill these fields from memory or guesswork.

- Manual reconstruction started at: `TBD`
- Manual usable-structure completed at: `TBD`
- Manual baseline TTSU: `TBD`
- Reviewer: `TBD`
- Method: `TBD`

## System-assisted run log

For each serious run record:

| Run | Transformer/config | Node recall | Relation recall | Provenance | Correction | TTSU | Verdict |
|---|---|---:|---:|---:|---:|---:|---|
| baseline-gold | human-curated evaluator fixture | 1.00 | 1.00 | 1.00 | n/a | n/a | harness self-test only |

The gold fixture is not a transformer result and must not be counted as product performance.
