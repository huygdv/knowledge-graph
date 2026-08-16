#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
from pathlib import Path

from systematization.systematizer import build_request, run_process_adapter


def load_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, value) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(description="Run a replaceable systematizer process against normalized source input.")
    parser.add_argument("--normalized-source", required=True, type=Path)
    parser.add_argument("--adapter-command", required=True, help="Trusted local command that reads request JSON on stdin and writes Draft Contract JSON on stdout.")
    parser.add_argument("--systematizer-id", required=True)
    parser.add_argument("--benchmark-case")
    parser.add_argument("--configuration", type=Path, help="Optional non-secret JSON descriptor used only for reproducible configuration hashing.")
    parser.add_argument("--timeout-seconds", type=int, default=120)
    parser.add_argument("--draft-output", required=True, type=Path)
    parser.add_argument("--report-output", required=True, type=Path)
    args = parser.parse_args()

    normalized = load_json(args.normalized_source)
    configuration = load_json(args.configuration) if args.configuration else {}
    request = build_request(
        normalized,
        systematizer_id=args.systematizer_id,
        benchmark_case=args.benchmark_case,
        configuration=configuration,
    )
    draft, report = run_process_adapter(
        args.adapter_command,
        request,
        timeout_seconds=args.timeout_seconds,
    )
    write_json(args.draft_output, draft)
    write_json(args.report_output, report)
    print(
        f"✓ systematizer response valid: {report['systematizerId']} "
        f"duration={report['durationMs']}ms config={report['configurationHash']}"
    )
    print(f"  draft: {args.draft_output}")
    print(f"  report: {args.report_output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
