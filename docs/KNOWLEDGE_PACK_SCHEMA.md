# Knowledge Pack schema v1.0

A **Knowledge Pack** is the portable unit used by Knowledge Graph. The application is the engine; Fullstack Engineering is only one built-in pack.

## File extension

Use `.kg.json` for portable packs. The file is plain UTF-8 JSON.

## Top-level shape

```json
{
  "schemaVersion": "1.0",
  "manifest": {},
  "graph": {},
  "overlay": {},
  "profiles": [],
  "views": {},
  "inbox": []
}
```

### `manifest`

Required fields:

- `id`: stable workspace identifier, 2–80 characters using letters, digits, `.`, `_`, `-`
- `title`: human-readable workspace title

Recommended fields: `description`, `author`, `createdAt`, `updatedAt`.

### `graph`

The canonical graph uses internal graph schema `version: 2`.

Supported node kinds:

- `domain`
- `capability`
- `concept`
- `technique`
- `tool`
- `pattern`
- `artifact`

Supported relations:

- `contains`
- `requires`
- `relates_to`
- `supports`
- `implemented_by`
- `applied_in`

Canonical nodes must not contain personal learner fields such as `mastery`, `status`, or `level`.

### `overlay`

Optional personal state. `assessments[].mastery` uses the 0–6 scale:

`Unexplored → Recognize → Understand → Apply → Diagnose → Design → Teach`.

### `profiles`

Optional career or capability rubrics. A pack without profiles still works; Career Lens falls back to a neutral **General Explorer** profile.

### `views`

Optional UI defaults. v1.0 supports `defaultMode` and `defaultDepth` as portable hints.

### `inbox`

Optional local-first draft knowledge. When a pack is imported, its inbox is scoped to that workspace.

## Import guarantees

Before anything is persisted, the browser validates:

- schema version
- manifest identity
- duplicate node IDs
- supported node/relation kinds
- dangling edges
- multiple hierarchy parents
- hierarchy cycles
- overlay references and mastery range
- profile requirement references

Invalid imports never write to IndexedDB.

## Templates

- `site/templates/minimal.kg.json` — smallest practical starting point
- `site/templates/example.kg.json` — research-to-system-map example
