# Task Report - prompt-history-adoption

## Outcome

Completed

## Changes

- Added an opt-in `Task History` section to `AGENTS.md`.
- Added `scripts/start-agent-run.ps1` to create `docs/agent-runs/<task-id>/`, snapshot the agreed prompt, create a `report.md` template, and print the exact `codex exec` command that uses the frozen prompt.
- Added `docs/agent-runs/README.md` documenting the discussion -> frozen prompt -> execution -> report workflow.
- Renamed `docs/discussions/WIP.prompt_history..md` to `docs/discussions/WIP-prompt-history.md` as a content-preserving filename correction.
- Bootstrapped the first recorded run by freezing the agreed discussion prompt into `docs/agent-runs/prompt-history-adoption/prompt.md` before implementing the helper.

## Validation

- `node --test ./test/agent-run.test.mjs`
- Verified `docs/discussions/WIP-prompt-history.md` and `docs/agent-runs/prompt-history-adoption/prompt.md` match byte-for-byte at snapshot time.
- `git diff --check`

## Findings / deviations

- The first recorded run required a one-time bootstrap because the helper did not exist before this task. That bootstrap was documented rather than hidden.
- Local Codex CLI inspection showed a working `codex exec` path, so the helper prints an exact execution command instead of a placeholder or a brittle interactive wrapper.
- The helper prints the exact command but does not launch Codex directly. That keeps the archived-prompt/executed-prompt invariant simple and avoids interactive shell assumptions.
- The report intentionally does not embed the hash of the commit that contains it. The containing Git commit establishes exact repository identity without creating a circular dependency.

## Remaining task-related residue

- None in the working tree once this checkpoint commit is created.

## Unrelated working-tree state

- `package.json` modified before this task
- `test/phase-c5.3.1.test.mjs` modified before this task
- `app/phase-c5.3.2-rollout.mjs` untracked before this task
- `tmp/` untracked before this task

## Recommended next step

- If you want this workflow in normal use immediately, start the next explicitly recorded run with `scripts/start-agent-run.ps1` instead of freezing the prompt manually.

## Checkpoint note

- Commit hash/message are intentionally not embedded here. Per the task design, the Git commit containing this recorded run is the authoritative checkpoint identity.
