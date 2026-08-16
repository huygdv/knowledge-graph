#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
from pathlib import Path

from systematization.contract import validate_draft
from systematization.pack import compile_reviewed_draft, validate_pack
from systematization.source_adapters import normalize_markdown_file


def load_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, value) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(description="Verify P1 deterministic source → draft → review → pack pipeline.")
    parser.add_argument("--case", required=True, type=Path)
    parser.add_argument("--pack-output", required=True, type=Path)
    parser.add_argument("--provenance-output", required=True, type=Path)
    parser.add_argument("--normalized-output", type=Path)
    args = parser.parse_args()

    input_path = args.case / "input.md"
    draft_path = args.case / "gold.draft.json"
    review_path = args.case / "gold.compile-review.json"
    expected_path = args.case / "expected-structure.json"

    normalized = normalize_markdown_file(input_path)
    draft = load_json(draft_path)
    review = load_json(review_path)
    expected = load_json(expected_path)

    normalized_sources = {item["id"]: item for item in normalized["fragments"]}
    draft_sources = {item["id"]: item for item in draft.get("sources", [])}
    if set(normalized_sources) != set(draft_sources):
        missing = sorted(set(draft_sources) - set(normalized_sources))
        unexpected = sorted(set(normalized_sources) - set(draft_sources))
        raise SystemExit(f"SourceAdapter alignment failed. missing={missing} unexpected={unexpected}")

    for source_id, draft_source in draft_sources.items():
        normalized_source = normalized_sources[source_id]
        for field in ("title", "locator"):
            if draft_source.get(field) != normalized_source.get(field):
                raise SystemExit(
                    f"SourceAdapter alignment failed for {source_id}.{field}: "
                    f"draft={draft_source.get(field)!r} normalized={normalized_source.get(field)!r}"
                )

    validation = validate_draft(draft)
    if not validation["valid"]:
        raise SystemExit("Draft validation failed:\n- " + "\n- ".join(validation["errors"]))

    pack, provenance = compile_reviewed_draft(
        draft,
        review,
        workspace_id="benchmark-agent-harness-p1",
        title="Agent Harness — P1 Compiled Benchmark",
        description="Deterministically compiled from benchmark #001 for pipeline verification.",
        author="p1-deterministic-pipeline",
    )
    pack_validation = validate_pack(pack)
    if not pack_validation["valid"]:
        raise SystemExit("Pack validation failed:\n- " + "\n- ".join(pack_validation["errors"]))

    expected_nodes = {item["id"] for item in expected.get("requiredNodes", [])}
    compiled_nodes = {item["id"] for item in pack["graph"]["nodes"]}
    missing_nodes = sorted(expected_nodes - compiled_nodes)
    if missing_nodes:
        raise SystemExit(f"Compiled pack is missing expected nodes: {missing_nodes}")

    expected_relations = {
        (item["source"], item["kind"], item["target"])
        for item in expected.get("requiredRelations", [])
    }
    compiled_relations = {
        (item["source"], item["kind"], item["target"])
        for item in pack["graph"]["edges"]
    }
    missing_relations = sorted(expected_relations - compiled_relations)
    if missing_relations:
        raise SystemExit(f"Compiled pack is missing expected relations: {missing_relations}")

    accepted_count = len(provenance.get("acceptedProposals", []))
    proposal_count = len(validation["proposalIds"])
    if accepted_count != proposal_count:
        raise SystemExit(f"Compile fixture expected all proposals accepted: accepted={accepted_count} proposals={proposal_count}")
    if len(provenance.get("sources", [])) != len(normalized_sources):
        raise SystemExit("Provenance sidecar lost source records")

    if args.normalized_output:
        write_json(args.normalized_output, normalized)
    write_json(args.pack_output, pack)
    write_json(args.provenance_output, provenance)

    print("✓ P1 deterministic pipeline verified")
    print(f"  normalized fragments: {len(normalized_sources)}")
    print(f"  draft proposals: {proposal_count}")
    print(f"  compiled nodes: {len(pack['graph']['nodes'])}")
    print(f"  compiled edges: {len(pack['graph']['edges'])}")
    print(f"  provenance records: {accepted_count}")
    print(f"  pack warnings: {len(pack_validation['warnings'])}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
