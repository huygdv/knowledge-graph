#!/usr/bin/env python3
from __future__ import annotations

import copy
import json
import tempfile
import unittest
from pathlib import Path

from systematization.contract import validate_draft
from systematization.pack import compile_reviewed_draft, validate_pack
from systematization.source_adapters import MarkdownSourceAdapter

ROOT = Path(__file__).resolve().parents[1]
CASE = ROOT / "benchmarks" / "cases" / "001-agent-harness-systematization"


def load_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


class SourceAdapterTests(unittest.TestCase):
    def test_markdown_adapter_is_stable(self):
        text = "## Fragment 1 — Alpha\n\nFirst body.\n\n## Fragment 2 — Beta\n\nSecond body.\n"
        adapter = MarkdownSourceAdapter()
        first = adapter.normalize(text, source_name="input.md")
        second = adapter.normalize(text, source_name="input.md")
        self.assertEqual([item.as_dict() for item in first], [item.as_dict() for item in second])
        self.assertEqual(first[0].id, "source.fragment-1")
        self.assertEqual(first[0].locator, "input.md#fragment-1")
        self.assertTrue(first[0].content_hash.startswith("sha256:"))

    def test_plain_document_falls_back_to_single_fragment(self):
        fragment = MarkdownSourceAdapter().normalize("plain source", source_name="notes.md")[0]
        self.assertEqual(fragment.id, "source.document")
        self.assertEqual(fragment.title, "notes")


class DraftContractTests(unittest.TestCase):
    def setUp(self):
        self.draft = load_json(CASE / "gold.draft.json")

    def test_gold_draft_is_valid(self):
        self.assertTrue(validate_draft(self.draft)["valid"])

    def test_unknown_evidence_source_is_rejected(self):
        broken = copy.deepcopy(self.draft)
        broken["proposals"]["nodes"][0]["evidence"][0]["sourceId"] = "source.missing"
        result = validate_draft(broken)
        self.assertFalse(result["valid"])
        self.assertTrue(any("unknown source" in error for error in result["errors"]))

    def test_dangling_edge_is_rejected(self):
        broken = copy.deepcopy(self.draft)
        broken["proposals"]["edges"][0]["edge"]["target"] = "concept.missing"
        result = validate_draft(broken)
        self.assertFalse(result["valid"])
        self.assertTrue(any("unresolved" in error for error in result["errors"]))


class CompilerTests(unittest.TestCase):
    def setUp(self):
        self.draft = load_json(CASE / "gold.draft.json")
        self.review = load_json(CASE / "gold.compile-review.json")

    def test_compile_gold_fixture(self):
        pack, sidecar = compile_reviewed_draft(
            self.draft,
            self.review,
            workspace_id="test-agent-harness",
            title="Test Agent Harness",
        )
        result = validate_pack(pack)
        self.assertTrue(result["valid"], result["errors"])
        self.assertEqual(len(pack["graph"]["nodes"]), 13)
        self.assertEqual(len(pack["graph"]["edges"]), 16)
        self.assertEqual(len(sidecar["acceptedProposals"]), 29)
        self.assertEqual(len(sidecar["sources"]), 7)
        self.assertNotIn("provenance", pack["graph"]["nodes"][0])

    def test_rejected_proposal_is_not_compiled(self):
        review = copy.deepcopy(self.review)
        review["decisions"][0]["decision"] = "reject"
        pack, sidecar = compile_reviewed_draft(
            self.draft,
            review,
            workspace_id="test-agent-harness-reject",
            title="Test Agent Harness",
        )
        ids = {node["id"] for node in pack["graph"]["nodes"]}
        self.assertNotIn("domain.agent-harness", ids)
        # Removing the root causes contained edges to dangle, so compilation must fail before this assertion.

    def test_unknown_review_proposal_is_rejected(self):
        review = copy.deepcopy(self.review)
        review["decisions"].append({"proposalId": "p.missing", "decision": "accept"})
        with self.assertRaisesRegex(ValueError, "unknown proposal"):
            compile_reviewed_draft(
                self.draft,
                review,
                workspace_id="test-agent-harness-review",
                title="Test Agent Harness",
            )


if __name__ == "__main__":
    unittest.main()
