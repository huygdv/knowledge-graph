#!/usr/bin/env python3
import json
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
GRAPH_PATH = ROOT / "site" / "data" / "graph.json"
OVERLAY_PATH = ROOT / "site" / "data" / "overlays" / "huy.public.json"
PROFILE_PATH = ROOT / "site" / "data" / "profiles" / "backend-engineer.json"


def load(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


graph = load(GRAPH_PATH)
overlay = load(OVERLAY_PATH)
profile = load(PROFILE_PATH)

assert graph.get("version") == 2, "graph.version must be 2"
assert overlay.get("version") == 1, "overlay.version must be 1"
assert profile.get("version") == 1, "profile.version must be 1"
assert isinstance(graph.get("nodes"), list), "nodes must be an array"
assert isinstance(graph.get("edges"), list), "edges must be an array"

allowed_kinds = {"domain", "capability", "concept", "technique", "tool", "pattern", "artifact"}
allowed_relations = {"contains", "requires", "relates_to", "supports", "implemented_by", "applied_in"}
forbidden_canonical_fields = {"status", "mastery", "level", "expectedMastery", "learningState"}

node_ids = set()
node_by_id = {}
for node in graph["nodes"]:
    node_id = node.get("id")
    assert node_id and node_id not in node_ids, f"duplicate or missing node id: {node_id}"
    assert node.get("kind") in allowed_kinds, f"invalid node kind: {node.get('kind')}"
    assert node.get("title"), f"missing title: {node_id}"
    assert node.get("summary"), f"missing summary: {node_id}"
    assert isinstance(node.get("tags", []), list), f"tags must be list: {node_id}"
    assert not forbidden_canonical_fields.intersection(node), f"learner state leaked into canonical node: {node_id}"
    node_ids.add(node_id)
    node_by_id[node_id] = node

edge_ids = set()
parents = {}
children = defaultdict(list)
for edge in graph["edges"]:
    edge_id = edge.get("id")
    assert edge_id and edge_id not in edge_ids, f"duplicate or missing edge id: {edge_id}"
    assert edge.get("kind") in allowed_relations, f"invalid relation: {edge.get('kind')}"
    assert edge.get("source") in node_ids, f"unknown source: {edge.get('source')}"
    assert edge.get("target") in node_ids, f"unknown target: {edge.get('target')}"
    assert edge.get("source") != edge.get("target"), f"self edge: {edge_id}"
    edge_ids.add(edge_id)
    if edge["kind"] == "contains":
        assert edge["target"] not in parents, f"multiple canonical parents: {edge['target']}"
        parents[edge["target"]] = edge["source"]
        children[edge["source"]].append(edge["target"])

# Contains hierarchy must be acyclic and depth is derived, never stored.
depth_cache = {}


def depth(node_id, stack=None):
    if node_id in depth_cache:
        return depth_cache[node_id]
    stack = stack or set()
    assert node_id not in stack, f"cycle in contains hierarchy: {node_id}"
    stack.add(node_id)
    value = 0 if node_id not in parents else depth(parents[node_id], stack) + 1
    stack.remove(node_id)
    depth_cache[node_id] = value
    return value


for node_id in node_ids:
    depth(node_id)

for node in graph["nodes"]:
    if node["kind"] == "domain":
        assert node["id"] not in parents, f"domain cannot have canonical parent: {node['id']}"
    elif node["kind"] != "artifact":
        assert node["id"] in parents, f"non-artifact node missing contains parent: {node['id']}"

scale = graph.get("masteryScale", [])
assert [item.get("value") for item in scale] == list(range(7)), "mastery scale must be 0..6"

assessment_ids = set()
for item in overlay.get("assessments", []):
    node_id = item.get("nodeId")
    mastery = item.get("mastery")
    assert node_id in node_ids, f"overlay references unknown node: {node_id}"
    assert node_id not in assessment_ids, f"duplicate assessment: {node_id}"
    assert isinstance(mastery, int) and 0 <= mastery <= 6, f"invalid mastery: {node_id}"
    for evidence_id in item.get("evidenceIds", []):
        assert evidence_id in node_ids, f"unknown evidence: {evidence_id}"
        assert node_by_id[evidence_id]["kind"] == "artifact", f"evidence must be artifact: {evidence_id}"
    assessment_ids.add(node_id)

level_keys = set()
for level in profile.get("levels", []):
    key = level.get("key")
    assert key and key not in level_keys, f"duplicate career level: {key}"
    assert isinstance(level.get("rank"), int), f"rank missing: {key}"
    requirement_ids = set()
    for requirement in level.get("requirements", []):
        node_id = requirement.get("nodeId")
        expected = requirement.get("expectedMastery")
        assert node_id in node_ids, f"career profile references unknown node: {node_id}"
        assert node_id not in requirement_ids, f"duplicate requirement in {key}: {node_id}"
        assert isinstance(expected, int) and 0 <= expected <= 6, f"invalid expected mastery: {node_id}"
        assert requirement.get("importance") in {"core", "supporting"}, f"invalid importance: {node_id}"
        requirement_ids.add(node_id)
    level_keys.add(key)

kind_counts = Counter(node["kind"] for node in graph["nodes"])
print(
    "✓ Knowledge graph v2 valid: "
    f"{len(node_ids)} nodes, {len(edge_ids)} edges, "
    f"max depth {max(depth_cache.values())}, "
    f"{len(assessment_ids)} public assessments, "
    f"{len(level_keys)} career levels"
)
print("  node kinds:", ", ".join(f"{kind}={count}" for kind, count in sorted(kind_counts.items())))
