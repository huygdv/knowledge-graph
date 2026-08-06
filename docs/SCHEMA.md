# Knowledge Graph v2 schema

## Canonical graph

`site/data/graph.json` is the source of truth for shared knowledge.

### Node kinds

- `domain` — broad body of knowledge, such as Backend Engineering
- `capability` — outcome-oriented competency area, such as API Engineering
- `concept` — explanatory knowledge, such as Idempotency
- `technique` — repeatable method, such as Execution Plan Analysis
- `tool` — technology used to implement or operate systems
- `pattern` — reusable design structure
- `artifact` — project or output that demonstrates applied knowledge

Canonical nodes must not contain learner fields such as `status`, `mastery`, or career `level`.

### Relations

- `contains` — canonical hierarchy; each non-artifact node has at most one parent
- `requires` — prerequisite relationship
- `relates_to` — meaningful cross-link without dependency direction
- `supports` — makes another capability or practice easier/possible
- `implemented_by` — concept realized through a tool or mechanism
- `applied_in` — knowledge demonstrated in an artifact

## Personal overlay

`site/data/overlays/huy.public.json` stores public, person-specific assessments.

```json
{
  "nodeId": "concept.idempotency",
  "mastery": 4,
  "updatedAt": "2026-08-06",
  "evidenceIds": ["artifact.dw-kit"],
  "note": "Seed assessment to refine during daily use."
}
```

Mastery scale:

```text
0 Unexplored
1 Recognize
2 Understand
3 Apply
4 Diagnose
5 Design
6 Teach
```

## Career profile

`site/data/profiles/backend-engineer.json` defines role expectations.

```json
{
  "nodeId": "concept.idempotency",
  "expectedMastery": 5,
  "importance": "core",
  "outcome": "Design correctness under retries and partial failure."
}
```

Profiles describe observable expectations. They do not change the canonical node.

## Depth

Depth is computed by following `contains` parents from a node to its domain root.

```text
Domain (0)
└── Capability (1)
    └── Concept (2)
        └── Technique (3)
            └── Concept (4)
```

The validator rejects multiple canonical parents and hierarchy cycles.
