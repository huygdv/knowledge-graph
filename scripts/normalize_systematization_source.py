#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
from pathlib import Path

from systematization.source_adapters import normalize_markdown_file


def main() -> int:
    parser = argparse.ArgumentParser(description="Normalize Markdown into stable systematization source fragments.")
    parser.add_argument("--input", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()

    normalized = normalize_markdown_file(args.input)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(normalized, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"✓ normalized {len(normalized['fragments'])} fragments from {args.input}")
    for fragment in normalized["fragments"]:
        print(f"  {fragment['id']} -> {fragment['locator']} ({fragment['contentHash'][:20]}…)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
