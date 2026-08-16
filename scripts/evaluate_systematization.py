#!/usr/bin/env python3
"""Deterministic evaluator for v0.4 systematization drafts."""

from __future__ import annotations

import argparse
import json
import re
import sys
from datetime import datetime
from pathlib import Path
from typing import Any

from systematization.contract import validate_draft


def load_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def normalize_title(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", value.lower()).strip()


def ratio(numerator: int, denominator: int) -> float:
    return 1.0 if denominator == 0 else numerator / denominator


def parse_iso(value: str) -> datetime:
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def evaluate_quality(draft: dict[str, Any], expected: dict[str, Any]) -> dict[str, Any]:
    proposals = draft.get("proposals", {}) if isinstance(draft.get("proposals", {}), dict) else {}
    nodes = [item for item in proposals.get("nodes", []) if isinstance(item, dict) and isinstance(item.get("node"), dict)]
    edges = [item for item in proposals.get("edges", []) if isinstance(item, dict) and isinstance(item.get("edge"), dict)]

    node_by_id = {item["node"].get("id"): item for item in nodes if item["node"].get("id")}
    relation_map = {
        (item["edge"].get("source"), item["edge"].get("kind"), item["edge"].get("target")): item
        for item in edges
    }

    required_nodes = expected.get("requiredNodes", [])
    required_relations = expected.get("requiredRelations", [])
    matched_nodes = sum(1 for item in required_nodes if item.get("id") in node_by_id)
    matched_relations = sum(
        1
        for item in required_relations
        if (item.get("source"), item.get("kind"), item.get("target")) in relation_map
    )

    machine = [item for item in nodes + edges if item.get("origin") in {"extracted", "inferred"}]
    with_evidence = sum(1 for item in machine if isinstance(item.get("evidence"), list) and len(item["evidence"]) > 0)

    seen_titles: set[tuple[str, str]] = set()
    duplicate_count = 0
    for item in nodes:
        node = item["node"]
        key = (str(node.get("kind", "")), normalize_title(str(node.get("title", ""))))
        if key in seen_titles:
            duplicate_count += 1
        else:
            seen_titles.add(key)

    origin_expectations = expected.get("originExpectations", [])
    origin_matches = 0
    origin_evaluated = 0
    for item in origin_expectations:
        actual = None
        if item.get("type") == "node":
            proposal = node_by_id.get(item.get("id"))
            actual = proposal.get("origin") if proposal else None
        elif item.get("type") == "edge":
            proposal = relation_map.get((item.get("source"), item.get("kind"), item.get("target")))
            actual = proposal.get("origin") if proposal else None
        if actual is not None:
            origin_evaluated += 1
            if actual == item.get("origin"):
                origin_matches += 1

    return {
        "requiredNodeRecall": ratio(matched_nodes, len(required_nodes)),
        "requiredNodeMatched": matched_nodes,
        "requiredNodeTotal": len(required_nodes),
        "requiredRelationRecall": ratio(matched_relations, len(required_relations)),
        "requiredRelationMatched": matched_relations,
        "requiredRelationTotal": len(required_relations),
        "provenanceCoverage": ratio(with_evidence, len(machine)),
        "machineProposalCount": len(machine),
        "machineProposalWithEvidence": with_evidence,
        "originAccuracy": ratio(origin_matches, origin_evaluated),
        "originMatched": origin_matches,
        "originEvaluated": origin_evaluated,
        "duplicateRate": ratio(duplicate_count, len(nodes)),
        "duplicateCount": duplicate_count,
        "proposedNodeCount": len(nodes),
        "proposedEdgeCount": len(edges),
    }


def evaluate_review(review: dict[str, Any] | None, draft: dict[str, Any]) -> dict[str, Any]:
    if review is None:
        return {
            "status": "pending",
            "humanCorrectionRate": None,
            "acceptedWithoutRewrite": None,
            "ttsuSeconds": None,
            "verdict": None,
        }

    decisions = review.get("decisions", []) if isinstance(review, dict) else []
    decisions = [item for item in decisions if isinstance(item, dict) and item.get("decision") in {"accept", "edit", "reject"}]
    accepted = sum(1 for item in decisions if item.get("decision") == "accept")
    corrected = sum(1 for item in decisions if item.get("decision") in {"edit", "reject"})

    ttsu = None
    started_at = review.get("startedAt") or draft.get("run", {}).get("startedAt")
    completed_at = review.get("completedAt")
    if started_at and completed_at:
        try:
            ttsu = (parse_iso(completed_at) - parse_iso(started_at)).total_seconds()
        except (ValueError, TypeError):
            ttsu = None

    return {
        "status": "measured",
        "reviewedCount": len(decisions),
        "acceptedCount": accepted,
        "correctedCount": corrected,
        "humanCorrectionRate": ratio(corrected, len(decisions)),
        "acceptedWithoutRewrite": ratio(accepted, len(decisions)),
        "ttsuSeconds": ttsu,
        "verdict": review.get("verdict"),
    }


def gate_results(validity: dict[str, Any], quality: dict[str, Any], review: dict[str, Any], thresholds: dict[str, Any]) -> dict[str, Any]:
    gates: dict[str, Any] = {
        "contractValid": validity["valid"] is bool(thresholds.get("contractValid", True)),
        "requiredNodeRecall": quality["requiredNodeRecall"] >= thresholds.get("requiredNodeRecallMin", 0),
        "requiredRelationRecall": quality["requiredRelationRecall"] >= thresholds.get("requiredRelationRecallMin", 0),
        "provenanceCoverage": quality["provenanceCoverage"] >= thresholds.get("provenanceCoverageMin", 0),
        "originAccuracy": quality["originAccuracy"] >= thresholds.get("originAccuracyMin", 0),
        "duplicateRate": quality["duplicateRate"] <= thresholds.get("duplicateRateMax", 1),
    }

    if review.get("status") == "measured":
        gates["humanCorrectionRate"] = review["humanCorrectionRate"] <= thresholds.get("humanCorrectionRateMax", 1)
        gates["acceptedWithoutRewrite"] = review["acceptedWithoutRewrite"] >= thresholds.get("acceptedWithoutRewriteMin", 0)
    else:
        gates["humanCorrectionRate"] = "pending"
        gates["acceptedWithoutRewrite"] = "pending"

    automated = [value for value in gates.values() if isinstance(value, bool)]
    return {"gates": gates, "automatedPass": all(automated)}


def main() -> int:
    parser = argparse.ArgumentParser(description="Evaluate a v0.4 systematization draft against a frozen benchmark case.")
    parser.add_argument("--case", required=True, type=Path, help="Benchmark case directory")
    parser.add_argument("--draft", required=True, type=Path, help="Systematization draft JSON")
    parser.add_argument("--review", type=Path, help="Optional measured human review JSON")
    parser.add_argument("--output", type=Path, help="Optional path for JSON report")
    parser.add_argument("--strict", action="store_true", help="Exit non-zero when an automated gate fails")
    args = parser.parse_args()

    expected = load_json(args.case / "expected-structure.json")
    draft = load_json(args.draft)
    review_input = load_json(args.review) if args.review else None

    validity = validate_draft(draft)
    quality = evaluate_quality(draft, expected)
    review = evaluate_review(review_input, draft)
    gates = gate_results(validity, quality, review, expected.get("thresholds", {}))

    report = {
        "caseId": expected.get("caseId"),
        "draft": str(args.draft),
        "validity": {"valid": validity["valid"], "errors": validity["errors"]},
        "quality": quality,
        "review": review,
        **gates,
    }

    rendered = json.dumps(report, indent=2, ensure_ascii=False)
    print(rendered)
    if args.output:
        args.output.write_text(rendered + "\n", encoding="utf-8")

    if args.strict and not report["automatedPass"]:
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
