#!/usr/bin/env python3
"""Deterministic evaluator for v0.4 systematization drafts.

This intentionally uses only the Python standard library so benchmark gates can run
in GitHub Actions without model/provider dependencies.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from datetime import datetime
from pathlib import Path
from typing import Any

ALLOWED_NODE_KINDS = {"domain", "capability", "concept", "technique", "tool", "pattern", "artifact"}
ALLOWED_RELATIONS = {"contains", "requires", "relates_to", "supports", "implemented_by", "applied_in"}
ALLOWED_ORIGINS = {"extracted", "inferred", "user_authored"}
ALLOWED_DECISIONS = {"pending", "accept", "edit", "reject"}


def load_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def normalize_title(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", value.lower()).strip()


def ratio(numerator: int, denominator: int) -> float:
    return 1.0 if denominator == 0 else numerator / denominator


def parse_iso(value: str) -> datetime:
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def validate_evidence(evidence: Any, source_ids: set[str], path: str, errors: list[str]) -> None:
    if not isinstance(evidence, list):
        errors.append(f"{path}.evidence must be a list")
        return
    for index, item in enumerate(evidence):
        if not isinstance(item, dict):
            errors.append(f"{path}.evidence[{index}] must be an object")
            continue
        source_id = item.get("sourceId")
        if source_id not in source_ids:
            errors.append(f"{path}.evidence[{index}] references unknown source: {source_id}")


def validate_draft(draft: dict[str, Any]) -> dict[str, Any]:
    errors: list[str] = []

    if draft.get("contractVersion") != "0.1":
        errors.append("contractVersion must be 0.1")

    run = draft.get("run")
    if not isinstance(run, dict):
        errors.append("run must be an object")
        run = {}
    for field in ("id", "startedAt", "producer", "inputAdapter"):
        if not run.get(field):
            errors.append(f"run.{field} is required")

    sources = draft.get("sources")
    if not isinstance(sources, list):
        errors.append("sources must be a list")
        sources = []

    source_ids: set[str] = set()
    for index, source in enumerate(sources):
        if not isinstance(source, dict):
            errors.append(f"sources[{index}] must be an object")
            continue
        source_id = source.get("id")
        if not source_id:
            errors.append(f"sources[{index}].id is required")
        elif source_id in source_ids:
            errors.append(f"duplicate source id: {source_id}")
        else:
            source_ids.add(source_id)
        if not source.get("type"):
            errors.append(f"sources[{index}].type is required")
        if not source.get("title"):
            errors.append(f"sources[{index}].title is required")

    proposals = draft.get("proposals")
    if not isinstance(proposals, dict):
        errors.append("proposals must be an object")
        proposals = {}

    nodes = proposals.get("nodes", [])
    edges = proposals.get("edges", [])
    merges = proposals.get("merges", [])
    conflicts = proposals.get("conflicts", [])
    for name, collection in (("nodes", nodes), ("edges", edges), ("merges", merges), ("conflicts", conflicts)):
        if not isinstance(collection, list):
            errors.append(f"proposals.{name} must be a list")

    if not isinstance(nodes, list):
        nodes = []
    if not isinstance(edges, list):
        edges = []
    if not isinstance(merges, list):
        merges = []
    if not isinstance(conflicts, list):
        conflicts = []

    proposal_ids: set[str] = set()
    node_ids: set[str] = set()
    edge_ids: set[str] = set()

    def validate_common(proposal: dict[str, Any], path: str) -> None:
        proposal_id = proposal.get("proposalId")
        if not proposal_id:
            errors.append(f"{path}.proposalId is required")
        elif proposal_id in proposal_ids:
            errors.append(f"duplicate proposalId: {proposal_id}")
        else:
            proposal_ids.add(proposal_id)

        origin = proposal.get("origin")
        if origin not in ALLOWED_ORIGINS:
            errors.append(f"{path}.origin is invalid: {origin}")
        if origin != "user_authored":
            confidence = proposal.get("confidence")
            if not isinstance(confidence, (int, float)) or isinstance(confidence, bool) or not 0 <= confidence <= 1:
                errors.append(f"{path}.confidence must be numeric in [0,1]")
            evidence = proposal.get("evidence")
            validate_evidence(evidence, source_ids, path, errors)
            if not isinstance(evidence, list) or len(evidence) == 0:
                errors.append(f"{path} machine-generated proposal requires evidence")
        else:
            validate_evidence(proposal.get("evidence", []), source_ids, path, errors)

    for index, proposal in enumerate(nodes):
        path = f"proposals.nodes[{index}]"
        if not isinstance(proposal, dict):
            errors.append(f"{path} must be an object")
            continue
        validate_common(proposal, path)
        if proposal.get("operation") != "add_node":
            errors.append(f"{path}.operation must be add_node")
        node = proposal.get("node")
        if not isinstance(node, dict):
            errors.append(f"{path}.node must be an object")
            continue
        node_id = node.get("id")
        if not node_id:
            errors.append(f"{path}.node.id is required")
        elif node_id in node_ids:
            errors.append(f"duplicate proposed node id: {node_id}")
        else:
            node_ids.add(node_id)
        if node.get("kind") not in ALLOWED_NODE_KINDS:
            errors.append(f"{path}.node.kind is invalid: {node.get('kind')}")
        if not node.get("title"):
            errors.append(f"{path}.node.title is required")
        if not node.get("summary"):
            errors.append(f"{path}.node.summary is required")
        if not isinstance(node.get("tags", []), list):
            errors.append(f"{path}.node.tags must be a list")

    existing_node_ids = set(draft.get("existingNodeIds", [])) if isinstance(draft.get("existingNodeIds", []), list) else set()
    resolvable_nodes = node_ids | existing_node_ids

    for index, proposal in enumerate(edges):
        path = f"proposals.edges[{index}]"
        if not isinstance(proposal, dict):
            errors.append(f"{path} must be an object")
            continue
        validate_common(proposal, path)
        if proposal.get("operation") != "add_edge":
            errors.append(f"{path}.operation must be add_edge")
        edge = proposal.get("edge")
        if not isinstance(edge, dict):
            errors.append(f"{path}.edge must be an object")
            continue
        edge_id = edge.get("id")
        if not edge_id:
            errors.append(f"{path}.edge.id is required")
        elif edge_id in edge_ids:
            errors.append(f"duplicate proposed edge id: {edge_id}")
        else:
            edge_ids.add(edge_id)
        if edge.get("kind") not in ALLOWED_RELATIONS:
            errors.append(f"{path}.edge.kind is invalid: {edge.get('kind')}")
        source = edge.get("source")
        target = edge.get("target")
        if source not in resolvable_nodes:
            errors.append(f"{path}.edge.source is unresolved: {source}")
        if target not in resolvable_nodes:
            errors.append(f"{path}.edge.target is unresolved: {target}")
        if source and source == target:
            errors.append(f"{path} self-edge is not allowed: {source}")

    for collection_name, collection in (("merges", merges), ("conflicts", conflicts)):
        for index, proposal in enumerate(collection):
            path = f"proposals.{collection_name}[{index}]"
            if not isinstance(proposal, dict):
                errors.append(f"{path} must be an object")
                continue
            validate_common(proposal, path)

    review = draft.get("review", {})
    if not isinstance(review, dict):
        errors.append("review must be an object")
        review = {}
    decisions = review.get("decisions", [])
    if not isinstance(decisions, list):
        errors.append("review.decisions must be a list")
        decisions = []
    seen_decisions: set[str] = set()
    for index, decision in enumerate(decisions):
        if not isinstance(decision, dict):
            errors.append(f"review.decisions[{index}] must be an object")
            continue
        proposal_id = decision.get("proposalId")
        if proposal_id not in proposal_ids:
            errors.append(f"review.decisions[{index}] references unknown proposal: {proposal_id}")
        if proposal_id in seen_decisions:
            errors.append(f"duplicate review decision: {proposal_id}")
        seen_decisions.add(proposal_id)
        if decision.get("decision") not in ALLOWED_DECISIONS:
            errors.append(f"review.decisions[{index}].decision is invalid: {decision.get('decision')}")

    return {
        "valid": not errors,
        "errors": errors,
        "sourceIds": sorted(source_ids),
        "proposalIds": sorted(proposal_ids),
        "nodeIds": sorted(node_ids),
        "edgeIds": sorted(edge_ids),
    }


def evaluate_quality(draft: dict[str, Any], expected: dict[str, Any]) -> dict[str, Any]:
    nodes = [item for item in draft.get("proposals", {}).get("nodes", []) if isinstance(item, dict) and isinstance(item.get("node"), dict)]
    edges = [item for item in draft.get("proposals", {}).get("edges", []) if isinstance(item, dict) and isinstance(item.get("edge"), dict)]

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

    expected_path = args.case / "expected-structure.json"
    expected = load_json(expected_path)
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
