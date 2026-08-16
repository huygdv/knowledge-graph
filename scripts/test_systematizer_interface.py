#!/usr/bin/env python3
from __future__ import annotations

import copy
import unittest

from systematization.systematizer import (
    build_request,
    configuration_hash,
    validate_request,
    verify_response_alignment,
)


NORMALIZED = {
    "adapter": "markdown",
    "sourceName": "input.md",
    "sourceHash": "sha256:document",
    "fragments": [
        {
            "id": "source.fragment-1",
            "type": "markdown",
            "title": "Alpha",
            "locator": "input.md#fragment-1",
            "contentHash": "sha256:fragment",
            "content": "Alpha body",
            "ordinal": 1,
        }
    ],
}


class SystematizerInterfaceTests(unittest.TestCase):
    def test_configuration_hash_is_order_independent(self):
        first = configuration_hash({"model": "x", "temperature": 0, "nested": {"b": 2, "a": 1}})
        second = configuration_hash({"nested": {"a": 1, "b": 2}, "temperature": 0, "model": "x"})
        self.assertEqual(first, second)
        self.assertTrue(first.startswith("sha256:"))

    def test_request_contains_provider_neutral_constraints(self):
        request = build_request(
            NORMALIZED,
            systematizer_id="private-baseline-v1",
            benchmark_case="case-001",
            configuration={"promptVersion": "v1"},
            run_id="run-test",
        )
        self.assertEqual(validate_request(request), [])
        self.assertEqual(request["run"]["id"], "run-test")
        self.assertEqual(request["constraints"]["draftContractVersion"], "0.1")
        self.assertTrue(request["constraints"]["requireEvidenceForMachineOutput"])
        self.assertNotIn("provider", request)
        self.assertNotIn("apiKey", request)

    def test_empty_source_is_rejected(self):
        request = build_request({"adapter": "markdown", "fragments": []}, systematizer_id="x", run_id="run-empty")
        errors = validate_request(request)
        self.assertTrue(any("cannot be empty" in error for error in errors))

    def test_response_run_identity_mismatch_is_rejected(self):
        request = build_request(NORMALIZED, systematizer_id="x", benchmark_case="case-001", run_id="run-a")
        draft = {
            "run": {"id": "run-b", "inputAdapter": "markdown", "benchmarkCase": "case-001"},
            "sources": [
                {"id": "source.fragment-1", "locator": "input.md#fragment-1", "contentHash": "sha256:fragment"}
            ],
        }
        errors = verify_response_alignment(request, draft)
        self.assertTrue(any("run.id mismatch" in error for error in errors))

    def test_source_locator_mismatch_is_rejected(self):
        request = build_request(NORMALIZED, systematizer_id="x", run_id="run-a")
        draft = {
            "run": {"id": "run-a", "inputAdapter": "markdown"},
            "sources": [{"id": "source.fragment-1", "locator": "wrong#locator"}],
        }
        errors = verify_response_alignment(request, draft)
        self.assertTrue(any("locator mismatch" in error for error in errors))


if __name__ == "__main__":
    unittest.main()
