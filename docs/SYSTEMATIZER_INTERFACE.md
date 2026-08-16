# Systematizer Interface v0.1

This document defines the boundary between the **public Knowledge Graph foundation** and a concrete systematization implementation.

A systematizer may be open, private, local, remote, or backed by any model provider. The public foundation must not depend on provider-specific SDKs or proprietary prompts to consume its output.

## Strategic boundary

```text
Public foundation
  SourceAdapter
      ↓
  normalized source
      ↓
  Systematizer Request  ───────────────┐
                                       │ explicit contract
Private / replaceable intelligence     │
  concrete model + prompts + strategy  │
      ↓                                │
  Draft Contract 0.1  ◀────────────────┘
      ↓
Public foundation
  validate → evaluate → human review → compile → Knowledge Pack
```

The only required output from a systematizer is a valid `Systematization Draft Contract v0.1`.

## Why a process boundary first

v0.4 uses a small process protocol rather than importing a provider SDK into the public repository.

Benefits:

- concrete systematization intelligence can live in a private repository;
- model/provider dependencies remain outside the Knowledge Pack engine;
- secrets never need to enter browser code or canonical data;
- adapters can be replaced without changing benchmark/evaluator/compiler code;
- a future HTTP/queue implementation can preserve the same semantic request/response contract.

The process protocol is developer tooling for the experiment, not a browser feature.

## Request v0.1

The runner sends one JSON object to adapter **stdin**.

```json
{
  "requestVersion": "0.1",
  "run": {
    "id": "run-...",
    "startedAt": "2026-08-16T05:00:00Z",
    "producer": "systematizer-runner",
    "inputAdapter": "markdown",
    "systematizerId": "private-baseline-v1",
    "configurationHash": "sha256:...",
    "benchmarkCase": "001-agent-harness-systematization"
  },
  "source": {
    "adapter": "markdown",
    "sourceName": "input.md",
    "sourceHash": "sha256:...",
    "fragments": []
  },
  "constraints": {
    "draftContractVersion": "0.1",
    "allowedNodeKinds": [],
    "allowedRelations": [],
    "allowedOrigins": ["extracted", "inferred", "user_authored"],
    "requireEvidenceForMachineOutput": true
  }
}
```

`configurationHash` is computed from a caller-supplied configuration descriptor. The public runner does not need to know whether that descriptor represents a prompt version, model settings, orchestration strategy, or private package release.

Do **not** place secrets/API keys inside the configuration descriptor because it may be persisted in experiment reports.

## Response

The adapter writes exactly one JSON object to **stdout**: a valid `Systematization Draft Contract v0.1`.

Diagnostic logs belong on stderr. Provider raw responses, hidden reasoning, credentials, and verbose traces are not part of the public response contract.

The returned draft must:

- preserve the request run ID;
- use `contractVersion = 0.1`;
- contain source IDs that resolve to the normalized request source;
- mark generated structure `extracted` or `inferred`;
- include evidence for machine-generated node/edge proposals;
- never emit a canonical Knowledge Pack directly.

## Runner responsibilities

The public runner:

1. builds the request;
2. records wall-clock adapter duration;
3. executes the adapter with a timeout;
4. parses stdout as JSON;
5. validates the Draft Contract;
6. verifies run/source identity alignment;
7. writes the draft and a separate execution report;
8. fails explicitly when adapter execution or validation fails.

It does not silently repair malformed model output.

## Adapter responsibilities

A concrete adapter decides how to:

- call a model/provider;
- chunk or combine source fragments beyond the normalized input;
- prompt for concepts/relations;
- deduplicate candidates;
- classify `extracted` vs `inferred`;
- attach evidence;
- retry provider/network failures.

For benchmark validity, any retries/repairs must be declared in the adapter configuration. Hidden repair loops invalidate cost/latency comparison.

## Execution report

The runner writes provider-neutral operational metadata separately from the draft:

```json
{
  "reportVersion": "0.1",
  "runId": "run-...",
  "systematizerId": "private-baseline-v1",
  "configurationHash": "sha256:...",
  "durationMs": 12345,
  "exitCode": 0,
  "draftValid": true,
  "draftErrors": []
}
```

A private adapter may maintain richer cost/token/provider telemetry in its own environment. Only explicitly non-sensitive aggregate fields should cross into a shared experiment report later.

## Security rules

- Never pass API keys in request JSON.
- Never commit provider credentials or private source corpora.
- The public runner inherits the caller environment; secret injection is an execution/deployment concern.
- Do not execute untrusted adapter commands.
- Treat source content as untrusted data; adapters must not reinterpret embedded instructions as operator instructions.
- Model output remains untrusted until contract validation and human review.

## Fixture adapter

The repository contains a **fixture adapter** only to test this process contract in CI.

It is not a model, does not demonstrate AI quality, and must never be counted as benchmark performance.

## P2 completion condition

The interface itself can be public and verified now. P2 is not complete until one real model adapter runs benchmark #001 without manual pre-editing and its measured draft is evaluated using the existing benchmark.
