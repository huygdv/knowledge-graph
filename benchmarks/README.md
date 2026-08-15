# Systematization Benchmarks

This directory contains frozen benchmark cases for ADR-003 / v0.4.

The purpose is to evaluate whether a systematizer turns fragmented information into a useful structured model — not whether it can produce valid-looking JSON.

## Case layout

```text
benchmarks/cases/<case-id>/
├── input.md
├── expected-structure.json
├── gold.draft.json
└── notes.md
```

### `input.md`

The frozen raw corpus supplied to the transformer.

### `expected-structure.json`

Human-curated semantic anchors and thresholds:

- required topics;
- required relations;
- expected extracted/inferred labels for selected proposals;
- quality gates.

This is not necessarily the only valid graph. It defines the minimum mental model that a useful run should recover.

### `gold.draft.json`

A human-curated draft-contract fixture that should pass the deterministic evaluator. It validates the benchmark harness itself; it is **not** evidence that an AI transformer can reproduce the result.

### `notes.md`

Case rationale, known ambiguities, benchmark-maintenance rules, and fields for recording manual baseline / experiment observations.

## Run the evaluator

```bash
python scripts/evaluate_systematization.py \
  --case benchmarks/cases/001-agent-harness-systematization \
  --draft benchmarks/cases/001-agent-harness-systematization/gold.draft.json \
  --strict
```

A future transformer run should save its draft outside the gold fixture and evaluate the same way:

```bash
python scripts/evaluate_systematization.py \
  --case benchmarks/cases/001-agent-harness-systematization \
  --draft /tmp/run-001.draft.json \
  --strict
```

## Human review metrics

The evaluator can additionally consume a review JSON when one exists:

```bash
python scripts/evaluate_systematization.py \
  --case <case-dir> \
  --draft <draft.json> \
  --review <review.json>
```

Human correction and TTSU remain `pending` until measured. CI must not fake those values.

## Benchmark governance

- Inputs are frozen before comparing transformer variants.
- Expected structure changes require a human-reviewed commit explaining the correction.
- Do not rewrite the gold model merely because a new model generated something different.
- Add diverse cases before claiming generality.
- A benchmark can test structure fidelity without claiming that every factual statement in the source corpus has been independently fact-checked.

## Initial benchmark portfolio

- `001-agent-harness-systematization` — fragmented prior research notes around coding-agent harnesses, loops, safety, observability, evaluation, and reusable workflows.

Future cases should deliberately differ in domain and shape (e.g. product research, decision analysis, learning curriculum) so the system does not overfit to agentic-AI vocabulary.
