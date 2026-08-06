# Knowledge Canvas

[Open the live Knowledge Canvas](https://huygdv.github.io/knowledge-graph/)

A lean personal knowledge graph for organizing engineering topics, learning status, prerequisites, relationships, and project evidence.

## Implemented in v0.1

- Infinite-style canvas with pan, zoom, fit view, and draggable nodes
- Expand/collapse by knowledge area
- Search by title, summary, or tag (`Ctrl/Cmd + K`)
- Filter by area and learning status
- Contextual dimming of unrelated nodes
- Inspector with navigable relations and evidence links
- Deep links through URL hashes, for example `#topic.postgresql`
- 42 real seed nodes and 54 semantic relations
- Static JSON validation in CI
- Zero-build GitHub Pages deployment

## Run locally

```bash
python scripts/validate_data.py
python -m http.server 8080 --directory site
```

Open `http://localhost:8080`.

## Edit the knowledge graph

Update `site/data/knowledge.json`.

Every node uses a stable ID and includes:

- `kind`: `area`, `topic`, or `artifact`
- `title`, `summary`, `status`
- optional `area`, `level`, `tags`, and `evidence`

Relations use one of:

- `contains`
- `requires`
- `relates_to`
- `applied_in`

Run validation before committing:

```bash
python scripts/validate_data.py
```

## Deploy to GitHub Pages

1. Push the repository with `main` as its default branch.
2. In **Settings → Pages**, choose **GitHub Actions** as the deployment source.
3. Push to `main` or manually run `Deploy Knowledge Canvas to GitHub Pages`.

## Product and architecture decisions

- [`docs/PRODUCT_REVIEW.md`](docs/PRODUCT_REVIEW.md)
- [`docs/ADR-001-zero-build-mvp.md`](docs/ADR-001-zero-build-mvp.md)
