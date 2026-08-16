from __future__ import annotations

import copy
from datetime import datetime, timezone
from typing import Any

from .contract import ALLOWED_NODE_KINDS, ALLOWED_RELATIONS, index_proposals, validate_draft

DEFAULT_MASTERY_SCALE = [
    {"value": 0, "key": "unexplored", "label": "Unexplored"},
    {"value": 1, "key": "recognize", "label": "Recognize"},
    {"value": 2, "key": "understand", "label": "Understand"},
    {"value": 3, "key": "apply", "label": "Apply"},
    {"value": 4, "key": "diagnose", "label": "Diagnose"},
    {"value": 5, "key": "design", "label": "Design"},
    {"value": 6, "key": "teach", "label": "Teach"},
]

FORBIDDEN_CANONICAL_FIELDS = {"status", "mastery", "level", "expectedMastery", "learningState"}


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def validate_review(review: dict[str, Any], proposal_ids: set[str]) -> list[str]:
    errors: list[str] = []
    if not isinstance(review, dict):
        return ["review must be an object"]
    decisions = review.get("decisions")
    if not isinstance(decisions, list):
        return ["review.decisions must be a list"]

    seen: set[str] = set()
    for index, item in enumerate(decisions):
        if not isinstance(item, dict):
            errors.append(f"review.decisions[{index}] must be an object")
            continue
        proposal_id = item.get("proposalId")
        if proposal_id not in proposal_ids:
            errors.append(f"review.decisions[{index}] references unknown proposal: {proposal_id}")
        if proposal_id in seen:
            errors.append(f"duplicate review decision: {proposal_id}")
        seen.add(proposal_id)
        if item.get("decision") not in {"accept", "edit", "reject", "pending"}:
            errors.append(f"review.decisions[{index}].decision is invalid: {item.get('decision')}")
        if item.get("decision") == "edit" and not isinstance(item.get("editedValue"), dict):
            errors.append(f"review.decisions[{index}].editedValue is required for edit")
    return errors


def _apply_edit(value: dict[str, Any], edited_value: dict[str, Any], container_key: str) -> dict[str, Any]:
    result = copy.deepcopy(value)
    patch = edited_value.get(container_key) if isinstance(edited_value.get(container_key), dict) else edited_value
    for key, patch_value in patch.items():
        result[key] = copy.deepcopy(patch_value)
    return result


def validate_pack(pack: dict[str, Any]) -> dict[str, Any]:
    errors: list[str] = []
    warnings: list[str] = []

    if pack.get("schemaVersion") != "1.0":
        errors.append("schemaVersion must be 1.0")
    manifest = pack.get("manifest") if isinstance(pack.get("manifest"), dict) else {}
    manifest_id = str(manifest.get("id", ""))
    if not manifest_id:
        errors.append("manifest.id is required")
    if not (2 <= len(manifest_id) <= 80) or any(char not in "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789._-" for char in manifest_id):
        errors.append("manifest.id must use letters, numbers, dot, underscore or dash (2-80 chars)")
    if not str(manifest.get("title", "")).strip():
        errors.append("manifest.title is required")

    graph = pack.get("graph") if isinstance(pack.get("graph"), dict) else {}
    if graph.get("version") != 2:
        errors.append("graph.version must be 2")
    nodes = graph.get("nodes") if isinstance(graph.get("nodes"), list) else []
    edges = graph.get("edges") if isinstance(graph.get("edges"), list) else []

    node_ids: set[str] = set()
    node_by_id: dict[str, dict[str, Any]] = {}
    for index, node in enumerate(nodes):
        if not isinstance(node, dict):
            errors.append(f"graph.nodes[{index}] must be an object")
            continue
        node_id = node.get("id")
        if not node_id:
            errors.append(f"graph.nodes[{index}].id is required")
        elif node_id in node_ids:
            errors.append(f"duplicate node id: {node_id}")
        else:
            node_ids.add(node_id)
            node_by_id[node_id] = node
        if node.get("kind") not in ALLOWED_NODE_KINDS:
            errors.append(f"unsupported node kind: {node.get('kind')}")
        if not str(node.get("title", "")).strip():
            errors.append(f"node title is required: {node_id or index}")
        if not str(node.get("summary", "")).strip():
            errors.append(f"node summary is required: {node_id or index}")
        leaked = FORBIDDEN_CANONICAL_FIELDS.intersection(node)
        if leaked:
            errors.append(f"canonical node contains learner state {sorted(leaked)}: {node_id or index}")

    edge_ids: set[str] = set()
    parent_by_child: dict[str, str] = {}
    for index, edge in enumerate(edges):
        if not isinstance(edge, dict):
            errors.append(f"graph.edges[{index}] must be an object")
            continue
        edge_id = edge.get("id")
        if not edge_id:
            errors.append(f"graph.edges[{index}].id is required")
        elif edge_id in edge_ids:
            errors.append(f"duplicate edge id: {edge_id}")
        else:
            edge_ids.add(edge_id)
        if edge.get("kind") not in ALLOWED_RELATIONS:
            errors.append(f"unsupported relation: {edge.get('kind')}")
        if edge.get("source") not in node_ids:
            errors.append(f"edge source does not exist: {edge.get('source')}")
        if edge.get("target") not in node_ids:
            errors.append(f"edge target does not exist: {edge.get('target')}")
        if edge.get("source") == edge.get("target"):
            errors.append(f"self-referencing edge is not allowed: {edge.get('source')}")
        if edge.get("kind") == "contains" and edge.get("target") in node_ids:
            target = edge["target"]
            source = edge.get("source")
            if target in parent_by_child and parent_by_child[target] != source:
                errors.append(f"node has multiple contains parents: {target}")
            else:
                parent_by_child[target] = source

    visiting: set[str] = set()
    visited: set[str] = set()

    def check_cycle(node_id: str) -> None:
        if node_id in visited:
            return
        if node_id in visiting:
            errors.append(f"cycle in contains hierarchy at {node_id}")
            return
        visiting.add(node_id)
        parent = parent_by_child.get(node_id)
        if parent:
            check_cycle(parent)
        visiting.remove(node_id)
        visited.add(node_id)

    for node_id in node_ids:
        check_cycle(node_id)

    overlay = pack.get("overlay") if isinstance(pack.get("overlay"), dict) else {}
    assessments = overlay.get("assessments") if isinstance(overlay.get("assessments"), list) else []
    for item in assessments:
        if item.get("nodeId") not in node_ids:
            errors.append(f"overlay references missing node: {item.get('nodeId')}")
        mastery = item.get("mastery")
        if not isinstance(mastery, int) or isinstance(mastery, bool) or not 0 <= mastery <= 6:
            errors.append(f"overlay mastery must be 0-6: {item.get('nodeId')}")

    profiles = pack.get("profiles") if isinstance(pack.get("profiles"), list) else []
    for profile in profiles:
        levels = profile.get("levels") if isinstance(profile, dict) else None
        if not isinstance(levels, list):
            warnings.append(f"profile {profile.get('id') if isinstance(profile, dict) else '(unnamed)'} has no levels")
            continue
        for level in levels:
            for requirement in level.get("requirements", []) if isinstance(level, dict) else []:
                if requirement.get("nodeId") not in node_ids:
                    errors.append(f"profile requirement references missing node: {requirement.get('nodeId')}")

    domains = sum(1 for node in nodes if isinstance(node, dict) and node.get("kind") == "domain")
    if nodes and domains == 0:
        warnings.append("no domain root found")
    if not profiles:
        warnings.append("no career profile included; UI will use General Explorer fallback")

    return {
        "valid": not errors,
        "errors": errors,
        "warnings": warnings,
        "stats": {"nodes": len(nodes), "edges": len(edges), "domains": domains, "profiles": len(profiles), "assessments": len(assessments)},
    }


def compile_reviewed_draft(
    draft: dict[str, Any],
    review: dict[str, Any],
    *,
    workspace_id: str,
    title: str,
    description: str = "",
    author: str = "systematization-prototype",
) -> tuple[dict[str, Any], dict[str, Any]]:
    draft_validation = validate_draft(draft)
    if not draft_validation["valid"]:
        raise ValueError("Draft validation failed:\n- " + "\n- ".join(draft_validation["errors"]))

    proposals = index_proposals(draft)
    review_errors = validate_review(review, set(proposals))
    if review_errors:
        raise ValueError("Review validation failed:\n- " + "\n- ".join(review_errors))

    decision_by_id = {item["proposalId"]: item for item in review.get("decisions", []) if isinstance(item, dict) and item.get("proposalId")}
    nodes: list[dict[str, Any]] = []
    edges: list[dict[str, Any]] = []
    accepted_provenance: list[dict[str, Any]] = []

    for proposal_id, proposal in proposals.items():
        decision = decision_by_id.get(proposal_id, {"decision": "pending"})
        outcome = decision.get("decision", "pending")
        if outcome in {"reject", "pending"}:
            continue
        operation = proposal.get("operation")
        edited_value = decision.get("editedValue", {}) if outcome == "edit" else {}

        if operation == "add_node":
            canonical = copy.deepcopy(proposal["node"])
            if outcome == "edit":
                canonical = _apply_edit(canonical, edited_value, "node")
            nodes.append(canonical)
            canonical_ref = canonical.get("id")
        elif operation == "add_edge":
            canonical = copy.deepcopy(proposal["edge"])
            if outcome == "edit":
                canonical = _apply_edit(canonical, edited_value, "edge")
            edges.append(canonical)
            canonical_ref = canonical.get("id")
        elif operation == "merge_nodes":
            raise ValueError(f"Accepted merge proposal requires a future deterministic merge strategy: {proposal_id}")
        elif operation == "flag_conflict":
            raise ValueError(f"Accepted conflict cannot be compiled as canonical truth: {proposal_id}")
        else:
            raise ValueError(f"Unsupported accepted operation: {operation} ({proposal_id})")

        accepted_provenance.append(
            {
                "proposalId": proposal_id,
                "canonicalRef": canonical_ref,
                "operation": operation,
                "origin": proposal.get("origin"),
                "confidence": proposal.get("confidence"),
                "evidence": copy.deepcopy(proposal.get("evidence", [])),
                "reviewDecision": outcome,
                "reviewNote": decision.get("note"),
            }
        )

    timestamp = now_iso()
    pack = {
        "schemaVersion": "1.0",
        "manifest": {
            "id": workspace_id,
            "title": title,
            "description": description,
            "author": author,
            "createdAt": timestamp,
            "updatedAt": timestamp,
        },
        "graph": {
            "version": 2,
            "meta": {"id": workspace_id, "title": title, "description": description},
            "masteryScale": copy.deepcopy(DEFAULT_MASTERY_SCALE),
            "nodes": nodes,
            "edges": edges,
        },
        "overlay": {"version": 1, "id": f"overlay.{workspace_id}", "assessments": []},
        "profiles": [],
        "views": {"defaultMode": "library", "defaultDepth": 4},
        "inbox": [],
    }

    pack_validation = validate_pack(pack)
    if not pack_validation["valid"]:
        raise ValueError("Compiled Knowledge Pack is invalid:\n- " + "\n- ".join(pack_validation["errors"]))

    sidecar = {
        "provenanceVersion": "0.1",
        "packId": workspace_id,
        "compiledAt": timestamp,
        "run": copy.deepcopy(draft.get("run", {})),
        "sources": copy.deepcopy(draft.get("sources", [])),
        "acceptedProposals": accepted_provenance,
        "rejectedOrPending": [
            {
                "proposalId": proposal_id,
                "decision": decision_by_id.get(proposal_id, {}).get("decision", "pending"),
            }
            for proposal_id in proposals
            if decision_by_id.get(proposal_id, {}).get("decision", "pending") in {"reject", "pending"}
        ],
        "reviewVerdict": copy.deepcopy(review.get("verdict")),
    }

    return pack, sidecar
