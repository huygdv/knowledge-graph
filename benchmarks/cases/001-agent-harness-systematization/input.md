# Benchmark 001 — Agent Harness Systematization

> Frozen internal benchmark corpus curated from prior research discussions and working notes about coding-agent harnesses. The benchmark evaluates **systematization fidelity**: whether important concepts and relationships are recovered from fragmented material. It is not an independent fact-check of external vendor claims.

## Fragment 1 — From prompt quality to harness quality

A coding agent should not be understood as only a model waiting for a better prompt. In practice the agent sits inside a system that decides what context it sees, which tools it may use, how it repeats work, where it executes, what requires approval, and how results are verified.

A useful mental model is:

`model + tools + control loop + context/memory + policy + execution environment + evaluation = agent system`

This means model quality matters, but system quality also depends on the harness around the model.

## Fragment 2 — The loop controls reliability

The visible code change is an output of a longer loop. A practical coding workflow repeatedly moves through stages similar to:

`understand → plan → execute → verify → close`

or, at a more general agent level:

`observe → plan → act → observe`

The exact labels matter less than having explicit state transitions and a verification step. A long-running agent without a clear stop condition, iteration budget, retry policy, or verification gate can waste tokens and continue after it should have escalated to a human.

The loop should therefore track progress, failures, retry/iteration limits, and completion evidence.

## Fragment 3 — Tools, environment, and safety are separate concerns

Giving an agent a shell or repository does not automatically make it safe to execute actions. The harness needs explicit tool contracts and an execution boundary.

Useful safety controls include:

- sandboxing untrusted execution;
- limiting network egress;
- preventing credentials from being exposed to arbitrary commands;
- approval gates before high-impact or irreversible actions;
- command/action logs for audit;
- distinguishing identity from permission;
- preventing an agent from treating instructions found inside an untrusted repository as trusted operator instructions.

Safety is therefore not just a stronger system prompt. It is partly an infrastructure and policy problem.

## Fragment 4 — Verification and observability

An agent saying “done” is not strong evidence of completion. Verification can include tests, lint/type checks, diff review, staging evidence, requirement checks, or other task-specific acceptance criteria.

Observability should help answer:

- what the agent attempted;
- which tools it called;
- where it retried;
- when a human intervened;
- which verification steps passed or failed;
- how much context/cost/latency the run consumed.

Session analysis can expose recurring anti-patterns such as repeated prompting to fix the same problem, accepting broad multi-file changes without review, weak context, missing tests, or treating “it runs” as the only definition of done.

## Fragment 5 — Skills, workflows, and reusable engineering knowledge

Repeated good behavior should not live only in one person's prompt history. Useful engineering discipline can be packaged into reusable skills or workflows with a contract such as:

`trigger → inputs → artifacts → guardrails → feedback loop → handoff`

A workflow may coordinate several stages or specialist agents, while a skill can encode a narrower reusable capability or discipline. Reusable knowledge should make both humans and agents less dependent on repeatedly asking the original expert how to work in a codebase.

This suggests an agent harness can become infrastructure for organizational knowledge, not only a runtime wrapper around a model.

## Fragment 6 — Evaluation should judge the system, not only the final text

Agent evaluation should not be reduced to whether the final answer looks plausible. Useful dimensions include:

- task completion;
- tool-call correctness;
- trajectory/workflow quality;
- verification evidence;
- human intervention rate;
- retries;
- latency and cost;
- safety-policy violations.

Production traces are especially useful because they reveal failure patterns that a few hand-written prompts may not expose. However, not every failure is a prompt problem: provider outages, tool errors, permissions, quotas, infrastructure, or bad orchestration should be classified separately so the fix is applied to the correct layer.

## Fragment 7 — Product boundary question

There is a strategic distinction between an agent **toolkit/harness** and an **orchestrator/product** above it. The harness provides reusable loops, tools, policy, execution, evaluation, and observability primitives. A higher-level product can schedule work, coordinate multiple specialists, expose dashboards or remote channels, and manage workflows across projects.

That distinction matters because the lower layer should remain reusable while product-specific orchestration can evolve independently.
