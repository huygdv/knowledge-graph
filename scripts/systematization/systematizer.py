from __future__ import annotations

import hashlib
import json
import shlex
import subprocess
import time
import uuid
from datetime import datetime, timezone
from typing import Any

from .contract import ALLOWED_NODE_KINDS, ALLOWED_ORIGINS, ALLOWED_RELATIONS, validate_draft


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def canonical_json(value: Any) -> str:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def configuration_hash(configuration: dict[str, Any]) -> str:
    return "sha256:" + hashlib.sha256(canonical_json(configuration).encode("utf-8")).hexdigest()


def build_request(
    normalized_source: dict[str, Any],
    *,
    systematizer_id: str,
    benchmark_case: str | None = None,
    configuration: dict[str, Any] | None = None,
    run_id: str | None = None,
) -> dict[str, Any]:
    configuration = configuration or {}
    return {
        "requestVersion": "0.1",
        "run": {
            "id": run_id or f"run-{uuid.uuid4()}",
            "startedAt": now_iso(),
            "producer": "systematizer-runner",
            "inputAdapter": normalized_source.get("adapter", "unknown"),
            "systematizerId": systematizer_id,
            "configurationHash": configuration_hash(configuration),
            **({"benchmarkCase": benchmark_case} if benchmark_case else {}),
        },
        "source": normalized_source,
        "constraints": {
            "draftContractVersion": "0.1",
            "allowedNodeKinds": sorted(ALLOWED_NODE_KINDS),
            "allowedRelations": sorted(ALLOWED_RELATIONS),
            "allowedOrigins": sorted(ALLOWED_ORIGINS),
            "requireEvidenceForMachineOutput": True,
        },
    }


def validate_request(request: dict[str, Any]) -> list[str]:
    errors: list[str] = []
    if request.get("requestVersion") != "0.1":
        errors.append("requestVersion must be 0.1")
    run = request.get("run") if isinstance(request.get("run"), dict) else {}
    for field in ("id", "startedAt", "producer", "inputAdapter", "systematizerId", "configurationHash"):
        if not run.get(field):
            errors.append(f"run.{field} is required")
    source = request.get("source") if isinstance(request.get("source"), dict) else {}
    fragments = source.get("fragments") if isinstance(source.get("fragments"), list) else None
    if fragments is None:
        errors.append("source.fragments must be a list")
    elif not fragments:
        errors.append("source.fragments cannot be empty")
    else:
        seen: set[str] = set()
        for index, fragment in enumerate(fragments):
            if not isinstance(fragment, dict):
                errors.append(f"source.fragments[{index}] must be an object")
                continue
            fragment_id = fragment.get("id")
            if not fragment_id:
                errors.append(f"source.fragments[{index}].id is required")
            elif fragment_id in seen:
                errors.append(f"duplicate normalized fragment id: {fragment_id}")
            seen.add(fragment_id)
            if not fragment.get("locator"):
                errors.append(f"source.fragments[{index}].locator is required")
            if not fragment.get("contentHash"):
                errors.append(f"source.fragments[{index}].contentHash is required")
    return errors


def verify_response_alignment(request: dict[str, Any], draft: dict[str, Any]) -> list[str]:
    errors: list[str] = []
    run = draft.get("run") if isinstance(draft.get("run"), dict) else {}
    request_run = request.get("run", {})
    if run.get("id") != request_run.get("id"):
        errors.append(f"draft run.id mismatch: expected {request_run.get('id')}, got {run.get('id')}")
    if run.get("inputAdapter") != request_run.get("inputAdapter"):
        errors.append("draft run.inputAdapter does not match request")
    if run.get("benchmarkCase") != request_run.get("benchmarkCase"):
        errors.append("draft run.benchmarkCase does not match request")

    normalized = {
        item.get("id"): item
        for item in request.get("source", {}).get("fragments", [])
        if isinstance(item, dict) and item.get("id")
    }
    draft_sources = draft.get("sources") if isinstance(draft.get("sources"), list) else []
    for source in draft_sources:
        if not isinstance(source, dict):
            continue
        source_id = source.get("id")
        expected = normalized.get(source_id)
        if expected is None:
            errors.append(f"draft references source not present in request: {source_id}")
            continue
        if source.get("locator") != expected.get("locator"):
            errors.append(f"draft source locator mismatch: {source_id}")
        if source.get("contentHash") and source.get("contentHash") != expected.get("contentHash"):
            errors.append(f"draft source hash mismatch: {source_id}")
    return errors


def run_process_adapter(
    command: str,
    request: dict[str, Any],
    *,
    timeout_seconds: int = 120,
) -> tuple[dict[str, Any], dict[str, Any]]:
    request_errors = validate_request(request)
    if request_errors:
        raise ValueError("Invalid systematizer request:\n- " + "\n- ".join(request_errors))

    started = time.perf_counter()
    completed = subprocess.run(
        shlex.split(command),
        input=canonical_json(request),
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        timeout=timeout_seconds,
        check=False,
    )
    duration_ms = round((time.perf_counter() - started) * 1000, 3)

    report = {
        "reportVersion": "0.1",
        "runId": request["run"]["id"],
        "systematizerId": request["run"]["systematizerId"],
        "configurationHash": request["run"]["configurationHash"],
        "durationMs": duration_ms,
        "exitCode": completed.returncode,
        "draftValid": False,
        "draftErrors": [],
        "stderr": completed.stderr[-4000:] if completed.stderr else "",
    }

    if completed.returncode != 0:
        raise RuntimeError(
            f"Systematizer adapter exited with {completed.returncode}. stderr:\n{report['stderr']}"
        )
    try:
        draft = json.loads(completed.stdout)
    except json.JSONDecodeError as exc:
        raise ValueError(f"Systematizer stdout is not valid JSON: {exc}") from exc
    if not isinstance(draft, dict):
        raise ValueError("Systematizer response must be a JSON object")

    validation = validate_draft(draft)
    alignment_errors = verify_response_alignment(request, draft)
    errors = [*validation["errors"], *alignment_errors]
    report["draftValid"] = len(errors) == 0
    report["draftErrors"] = errors
    if errors:
        raise ValueError("Systematizer draft failed validation:\n- " + "\n- ".join(errors))

    return draft, report
