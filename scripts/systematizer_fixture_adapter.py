#!/usr/bin/env python3
"""Fixture-only process adapter used to verify the public Systematizer interface.

It is not a model and must never be counted as systematization performance.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path


def load_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--draft", required=True, type=Path)
    args = parser.parse_args()

    request = json.load(sys.stdin)
    draft = load_json(args.draft)

    request_run = request["run"]
    draft["run"] = {
        "id": request_run["id"],
        "startedAt": request_run["startedAt"],
        "producer": request_run["systematizerId"],
        "inputAdapter": request_run["inputAdapter"],
        "configurationHash": request_run["configurationHash"],
        **({"benchmarkCase": request_run["benchmarkCase"]} if request_run.get("benchmarkCase") else {}),
    }

    draft["sources"] = [
        {
            "id": fragment["id"],
            "type": request["source"].get("adapter", "unknown"),
            "title": fragment.get("title", fragment["id"]),
            "contentHash": fragment.get("contentHash"),
            "locator": fragment.get("locator"),
        }
        for fragment in request["source"].get("fragments", [])
    ]

    json.dump(draft, sys.stdout, ensure_ascii=False)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
