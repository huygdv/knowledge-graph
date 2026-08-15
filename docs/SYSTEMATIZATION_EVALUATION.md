# Systematization Evaluation Rubric v0.1

The evaluator separates three questions that must not be conflated:

1. **Validity:** Is the generated draft structurally legal?
2. **Quality:** Does it capture the expected mental model with traceable structure?
3. **Usefulness:** Does a human actually save effort and trust the result?

A run can be valid but low quality, or high-scoring structurally but still not useful.

## Evaluation layers

### Layer A — Deterministic validity

Binary checks:

- contract version supported;
- unique proposal IDs;
- unique proposed canonical node/edge IDs;
- supported node and relation kinds;
- all edge endpoints resolvable;
- all source references resolvable;
- confidence values in `[0,1]`;
- machine-generated proposals have evidence;
- review decisions reference known proposals;
- compiled pack has no dangling edges or hierarchy cycles.

Any failure makes the run invalid.

### Layer B — Benchmark quality

The benchmark defines expected semantic anchors rather than requiring a byte-for-byte graph match.

#### Required-topic recall

```text
matched required nodes / total required nodes
```

Initial target: **≥ 0.85**.

#### Required-relation recall

```text
matched required relations / total required relations
```

Initial target: **≥ 0.75**.

#### Provenance coverage

```text
machine-generated node+edge proposals with evidence
--------------------------------------------------
all machine-generated node+edge proposals
```

Initial target: **≥ 0.90**.

#### Origin-label accuracy

For benchmark proposals where the expected origin is known:

```text
correct extracted/inferred labels / evaluated origin labels
```

Initial target: **≥ 0.85**.

#### Duplicate concept rate

A duplicate is a second proposed node with the same normalized kind+title, or a benchmark-confirmed semantic duplicate that should have been merged.

```text
duplicate nodes / proposed nodes
```

Initial maximum: **≤ 0.10**.

### Layer C — Human correction

After review:

#### Human correction rate

```text
edited + rejected proposals
---------------------------
all reviewed proposals
```

Initial maximum: **≤ 0.30**.

#### Accepted without rewrite

```text
accepted proposals
------------------
all reviewed proposals
```

Initial target: **≥ 0.70**.

A rejection counts as correction because the human had to remove invalid/unhelpful structure.

### Layer D — Time to Structured Understanding

**TTSU** starts when the run begins and ends when the reviewer has a structured model they consider usable enough to continue working from.

Record:

- automated transform duration;
- review duration;
- total TTSU;
- manual-baseline time for the same corpus.

Do not invent a manual baseline. Measure it on a separate manual reconstruction attempt or use an already-observed workflow with a recorded duration.

Recommended comparison:

```text
TTSU improvement = 1 - (system-assisted TTSU / manual baseline TTSU)
```

v0.4 does not set a universal percentage target yet. It requires a **material, observed reduction** across representative cases.

## Human usefulness verdict

The reviewer answers:

- `mentalModelUseful`: Can the major mental model be recovered without reopening most source fragments?
- `provenanceTrustworthy`: Can important generated structure be explained from source evidence?
- `continueFromModel`: Would the reviewer continue from this model instead of discarding it and rebuilding manually?

A run is not a product pass when two or more verdicts are false, regardless of deterministic metrics.

## Benchmark thresholds

Each case stores thresholds in `expected-structure.json` so thresholds are versioned with the case.

Recommended initial thresholds:

```json
{
  "contractValid": true,
  "requiredNodeRecallMin": 0.85,
  "requiredRelationRecallMin": 0.75,
  "provenanceCoverageMin": 0.90,
  "originAccuracyMin": 0.85,
  "duplicateRateMax": 0.10,
  "humanCorrectionRateMax": 0.30,
  "acceptedWithoutRewriteMin": 0.70
}
```

## No opaque aggregate score

v0.4 deliberately avoids a single 0–100 quality score. A weighted score can hide catastrophic weakness in provenance or relation quality.

The evaluator reports each metric and a per-metric pass/fail gate.

## Regression policy

When transformer implementation changes:

1. rerun all frozen benchmark cases;
2. compare metric deltas;
3. reject a change that improves one case but causes significant unexplained regression on another;
4. record configuration/model changes with the run;
5. never silently alter expected benchmark structure to make a new model pass.

Changing benchmark expectations requires human review and a commit explaining why the previous expectation was wrong.

## Precision vs recall

The first evaluator emphasizes required-topic/relation recall because v0.4 begins with a small human-curated expected model.

As benchmark coverage grows, add precision against a richer gold model:

- unsupported/unhelpful proposed relations;
- unnecessary concepts;
- over-generalization;
- incorrect hierarchy placement.

Until then, human reject/edit rate is the main signal for false-positive structure.

## What success does not mean

These are not sufficient:

- 100% valid JSON;
- lots of nodes;
- a graph that looks complex;
- a fluent summary;
- high model confidence;
- low latency alone.

Success means the structured output is valid, close to the expected mental model, traceable, cheap to correct, and materially faster to use than manual reconstruction.
