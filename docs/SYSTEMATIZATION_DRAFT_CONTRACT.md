# Systematization Draft Contract v0.1

This contract is the intermediate boundary between raw source material and a canonical Knowledge Pack.

It exists so an AI transformer cannot write directly into canonical knowledge. Every generated change must be traceable, validated, and reviewable first.

## Design principles

1. **Draft before canonical.** Machine output is a proposal, never an accepted fact by default.
2. **Provenance first.** Every machine-generated node/relation should point to supporting source evidence.
3. **Origin is explicit.** `extracted`, `inferred`, and `user_authored` are different semantics.
4. **Provider independent.** OpenAI/Anthropic/model-specific payloads do not enter the contract.
5. **Deterministic identity.** Proposed canonical IDs should follow stable normalized naming rules so evaluation and future merges are reproducible.
6. **Review is first-class.** Accept/edit/reject decisions are part of the transformation lifecycle.

## Top-level shape

```json
{
  "contractVersion": "0.1",
  "run": {},
  "sources": [],
  "proposals": {
    "nodes": [],
    "edges": [],
    "merges": [],
    "conflicts": []
  },
  "review": {
    "status": "pending",
    "decisions": []
  }
}
```

## `run`

Required:

- `id`: unique run identifier.
- `startedAt`: ISO-8601 timestamp.
- `producer`: implementation identifier, e.g. `systematizer-prototype`.
- `inputAdapter`: e.g. `markdown` or `ai-conversation-export`.

Recommended:

- `model`: neutral string for experiment traceability only; never used by the canonical pack.
- `configurationHash`: hash/version of prompt/configuration.
- `benchmarkCase`: benchmark case ID when applicable.

## `sources`

Each source is a traceable input artifact.

```json
{
  "id": "source.note-01",
  "type": "markdown",
  "title": "Agent harness exploration notes",
  "contentHash": "sha256:...",
  "locator": "input.md#fragment-1"
}
```

Required:

- `id`
- `type`
- `title`

Recommended:

- `contentHash`
- `locator`
- `createdAt`
- `metadata`

The draft may reference source text without embedding the full private corpus in every proposal.

## Proposal origins

Allowed `origin` values:

- `extracted`: directly supported by source wording/structure.
- `inferred`: a useful relation/structure synthesized from multiple observations or implicit reasoning.
- `user_authored`: explicitly added by a human.

`inferred` is not synonymous with low confidence. It means the relationship is not represented as a direct source statement.

## Evidence reference

```json
{
  "sourceId": "source.note-01",
  "locator": "#fragment-2",
  "note": "The fragment explicitly lists approval gates as part of policy/safety."
}
```

A proposal may cite multiple source fragments.

For v0.4, evidence references use source IDs + human-readable locators. Exact character offsets are deferred until the first adapter proves they are necessary.

## Node proposal

```json
{
  "proposalId": "p.node.control-loop",
  "operation": "add_node",
  "origin": "extracted",
  "confidence": 0.96,
  "node": {
    "id": "concept.control-loop",
    "kind": "concept",
    "title": "Control Loop",
    "summary": "The observe-plan-act-verify cycle controlling an agent's execution.",
    "tags": ["agent", "orchestration"]
  },
  "evidence": [
    {"sourceId": "source.note-01", "locator": "#fragment-2"}
  ]
}
```

Requirements:

- unique `proposalId`;
- `operation = add_node` for v0.4;
- `node` conforms to canonical node constraints;
- `confidence` is numeric in `[0,1]` for machine-generated proposals;
- machine-generated proposals include at least one evidence reference.

## Edge proposal

```json
{
  "proposalId": "p.edge.loop-requires-verification",
  "operation": "add_edge",
  "origin": "inferred",
  "confidence": 0.82,
  "edge": {
    "id": "edge.control-loop.requires.verification",
    "kind": "requires",
    "source": "concept.control-loop",
    "target": "capability.verification"
  },
  "evidence": [
    {"sourceId": "source.note-02", "locator": "#fragment-3"}
  ]
}
```

An inferred edge must remain visibly marked as inferred through review.

## Merge proposal

A merge expresses suspected duplicate concepts without deleting data automatically.

```json
{
  "proposalId": "p.merge.guardrails-policy",
  "operation": "merge_nodes",
  "origin": "inferred",
  "confidence": 0.78,
  "sourceNodeIds": ["concept.guardrails", "concept.policy-layer"],
  "targetNodeId": "concept.policy-and-guardrails",
  "reason": "Both fragments describe the same control boundary.",
  "evidence": []
}
```

v0.4 may emit merge proposals, but compilation must require explicit human acceptance.

## Conflict proposal

Conflicts capture incompatible claims/structures rather than hiding them.

```json
{
  "proposalId": "p.conflict.retry-policy",
  "operation": "flag_conflict",
  "origin": "inferred",
  "confidence": 0.74,
  "subjectId": "concept.retry-policy",
  "description": "Two fragments recommend incompatible retry limits.",
  "evidence": []
}
```

Conflict proposals do not compile into canonical graph edges automatically.

## Review model

Each proposal receives one decision:

- `accept`
- `edit`
- `reject`
- `pending`

```json
{
  "proposalId": "p.node.control-loop",
  "decision": "edit",
  "editedValue": {
    "summary": "Human-corrected summary"
  },
  "reviewedAt": "2026-08-15T20:30:00+07:00",
  "note": "Concept is correct; wording was too broad."
}
```

Top-level review metadata may include:

```json
{
  "status": "completed",
  "reviewer": "human",
  "completedAt": "...",
  "verdict": {
    "mentalModelUseful": true,
    "provenanceTrustworthy": true,
    "continueFromModel": true
  }
}
```

## Compilation rules

The Pack Compiler must:

1. ignore rejected/pending proposals;
2. apply accepted proposals exactly;
3. apply edited proposals using their reviewed value;
4. validate all canonical IDs and relations after merge resolution;
5. reject dangling edges, hierarchy cycles, unsupported kinds/relations, and duplicate IDs;
6. never compile unresolved conflicts as truth;
7. preserve source/provenance metadata outside canonical v1.0 fields until a future pack schema formally supports first-class provenance.

## Stable ID guidance

For v0.4, proposed canonical IDs should follow:

```text
<kind>.<normalized-semantic-name>
```

Examples:

```text
domain.agent-harness
capability.verification
concept.control-loop
pattern.human-approval-gate
```

IDs should not contain model-generated random suffixes. Collision resolution must be explicit and deterministic.

## Validation invariants

A draft is invalid when any of the following is true:

- unsupported `contractVersion`;
- duplicate proposal IDs;
- duplicate proposed node IDs;
- unknown source references;
- unsupported node/relation kind;
- confidence outside `[0,1]`;
- machine-generated proposal without evidence;
- edge endpoint references neither an existing canonical node nor a proposed node;
- duplicate edge IDs;
- review decision references an unknown proposal.

## Deferred decisions

Not part of contract v0.1:

- vector embeddings;
- provider tool-call traces;
- token/cost accounting schema;
- exact text-span offsets;
- first-class Claim/Source/Evidence entities inside Knowledge Pack v1.0;
- collaborative review identities/RBAC;
- automatic conflict resolution.
