#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
from pathlib import Path

from systematization.pack import compile_reviewed_draft, validate_pack


def load_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, value) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(description="Compile a reviewed systematization draft into Knowledge Pack v1.0 + provenance sidecar.")
    parser.add_argument("--draft", required=True, type=Path)
    parser.add_argument("--review", required=True, type=Path)
    parser.add_argument("--workspace-id", required=True)
    parser.add_argument("--title", required=True)
    parser.add_argument("--description", default="")
    parser.add_argument("--author", default="systematization-prototype")
    parser.add_argument("--pack-output", required=True, type=Path)
    parser.add_argument("--provenance-output", required=True, type=Path)
    args = parser.parse_args()

    draft = load_json(args.draft)
    review = load_json(args.review)
    pack, provenance = compile_reviewed_draft(
        draft,
        review,
        workspace_id=args.workspace_id,
        title=args.title,
        description=args.description,
        author=args.author,
    )
    validation = validate_pack(pack)
    if not validation["valid"]:
        raise SystemExit("Compiled pack validation failed: " + "; ".join(validation["errors"]))

    write_json(args.pack_output, pack)
    write_json(args.provenance_output, provenance)
    print(
        "✓ compiled reviewed draft: "
        f"{validation['stats']['nodes']} nodes, {validation['stats']['edges']} edges, "
        f"{len(provenance['acceptedProposals'])} accepted proposals"
    )
    print(f"  pack: {args.pack_output}")
    print(f"  provenance: {args.provenance_output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
