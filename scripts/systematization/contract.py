from __future__ import annotations

from typing import Any

ALLOWED_NODE_KINDS = {"domain", "capability", "concept", "technique", "tool", "pattern", "artifact"}
ALLOWED_RELATIONS = {"contains", "requires", "relates_to", "supports", "implemented_by", "applied_in"}
ALLOWED_ORIGINS = {"extracted", "inferred", "user_authored"}
ALLOWED_DECISIONS = {"pending", "accept", "edit", "reject"}


def _validate_evidence(evidence: Any, source_ids: set[str], path: str, errors: list[str]) -> None:
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


def proposal_collections(draft: dict[str, Any]) -> tuple[list[dict[str, Any]], list[dict[str, Any]], list[dict[str, Any]], list[dict[str, Any]]]:
    proposals = draft.get("proposals", {}) if isinstance(draft.get("proposals", {}), dict) else {}
    result = []
    for key in ("nodes", "edges", "merges", "conflicts"):
        value = proposals.get(key, [])
        result.append(value if isinstance(value, list) else [])
    return tuple(result)  # type: ignore[return-value]


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
    for name in ("nodes", "edges", "merges", "conflicts"):
        if not isinstance(proposals.get(name, []), list):
            errors.append(f"proposals.{name} must be a list")

    nodes, edges, merges, conflicts = proposal_collections(draft)
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
            _validate_evidence(evidence, source_ids, path, errors)
            if not isinstance(evidence, list) or len(evidence) == 0:
                errors.append(f"{path} machine-generated proposal requires evidence")
        else:
            _validate_evidence(proposal.get("evidence", []), source_ids, path, errors)

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


def index_proposals(draft: dict[str, Any]) -> dict[str, dict[str, Any]]:
    nodes, edges, merges, conflicts = proposal_collections(draft)
    return {
        proposal["proposalId"]: proposal
        for proposal in [*nodes, *edges, *merges, *conflicts]
        if isinstance(proposal, dict) and proposal.get("proposalId")
    }
