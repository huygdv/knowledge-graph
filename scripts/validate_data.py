#!/usr/bin/env python3
import json
from pathlib import Path

path = Path(__file__).resolve().parents[1] / "site" / "data" / "knowledge.json"
graph = json.loads(path.read_text(encoding="utf-8"))

assert graph.get("version") == 1, "version must be 1"
assert isinstance(graph.get("nodes"), list), "nodes must be an array"
assert isinstance(graph.get("edges"), list), "edges must be an array"

node_ids = set()
allowed_kinds = {"area", "topic", "artifact"}
allowed_statuses = {"planned", "learning", "known", "practiced", "confident"}
allowed_relations = {"contains", "requires", "relates_to", "applied_in"}

for node in graph["nodes"]:
    assert node["id"] not in node_ids, f"duplicate node id: {node['id']}"
    node_ids.add(node["id"])
    assert node["kind"] in allowed_kinds, f"invalid node kind: {node['kind']}"
    assert node["status"] in allowed_statuses, f"invalid status: {node['status']}"
    assert node.get("title"), f"missing title: {node['id']}"
    assert node.get("summary"), f"missing summary: {node['id']}"
    assert isinstance(node.get("tags", []), list), f"tags must be list: {node['id']}"
    assert isinstance(node.get("evidence", []), list), f"evidence must be list: {node['id']}"

edge_ids = set()
for edge in graph["edges"]:
    assert edge["id"] not in edge_ids, f"duplicate edge id: {edge['id']}"
    edge_ids.add(edge["id"])
    assert edge["kind"] in allowed_relations, f"invalid relation: {edge['kind']}"
    assert edge["source"] in node_ids, f"unknown source: {edge['source']}"
    assert edge["target"] in node_ids, f"unknown target: {edge['target']}"

for node in graph["nodes"]:
    if node.get("area"):
        assert node["area"] in node_ids, f"unknown area: {node['area']}"

print(f"✓ Knowledge graph valid: {len(node_ids)} nodes, {len(edge_ids)} edges")
