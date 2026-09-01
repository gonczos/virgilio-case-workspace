Implement a small, opt-in repository mechanism for preserving selected Codex task prompts and their corresponding final task reports for later review and learning.

Follow the repository-root `AGENTS.md`.

This is a repository/process improvement only. Do not start or modify any Virgilio implementation phase.

## Objective

Support the repository's normal task-development workflow:

```text
docs/discussions/WIP-<topic>.md
        ↓
discussion / refinement
        ↓
agreed and ready for implementation
        ↓
helper snapshots
        ↓
docs/agent-runs/<task-id>/prompt.md
        ↓
helper-printed Codex command executes that frozen prompt
        ↓
Codex execution
        ↓
docs/agent-runs/<task-id>/report.md
        ↓
checkpoint commit
```

The critical invariant is:

> The prompt preserved in `docs/agent-runs/<task-id>/prompt.md` must be the prompt actually executed for that recorded run.

There must be no silent divergence between the archived prompt and the task Codex actually executes.

The intended historical chain is:

> discussion → agreed prompt → frozen execution prompt → implementation/decision → validation → outcome

This history exists for audit, retrospective review, and learning.

It is not architecture, setup, roadmap, requirements, or implementation authority.

## Discussion versus recorded prompt

The repository uses files under:

```text
docs/discussions/
```

to work out task details before implementation.

Preserve that workflow.

A discussion file may contain:

* evolving requirements;
* alternatives;
* questions;
* rejected approaches;
* review comments;
* draft prompts;
* uncertainty;
* implementation planning.

It remains mutable while the task is being developed.

Once the user decides that the discussion has converged and the prompt is ready for execution, the helper snapshots the exact agreed content into:

```text
docs/agent-runs/<task-id>/prompt.md
```

That frozen file becomes the authoritative execution input for that recorded run.

The source discussion file and the recorded prompt are independent after the snapshot.

Later changes to the discussion file must not alter the recorded prompt or the meaning of an already-started recorded run.

Do not automatically delete or move the source discussion file when creating the recorded run.

## Opt-in trigger

Do not require task-history recording for every Codex task.

A recorded run exists only when:

* the user explicitly requests that the task be recorded; or
* the task prompt explicitly identifies itself as a recorded run.

Do not infer whether a task is "substantial" enough.

Ordinary Codex tasks remain unaffected unless explicitly opted in.

## Repository convention

Use:

```text
docs/agent-runs/
  <task-id>/
    prompt.md
    report.md
```

Examples:

```text
docs/agent-runs/C5.3.2-preserve-complete-text/
docs/agent-runs/prompt-history-adoption/
```

Do not create fake historical runs for previous work.

Do not retrospectively reconstruct or backfill earlier prompts or reports.

## `prompt.md`

The normal source for `prompt.md` should be an agreed prompt developed under `docs/discussions/`.

When starting a recorded run, snapshot the exact current content of that agreed prompt into:

```text
docs/agent-runs/<task-id>/prompt.md
```

Do not:

* rewrite it;
* summarize it;
* clean it up during copying;
* normalize its wording;
* retrospectively correct it;
* inject additional task instructions into the preserved copy.

The recorded prompt must preserve what Codex was actually instructed to execute.

Ideally the snapshot is byte-for-byte equivalent to the source at snapshot time.

If platform newline behavior prevents strict byte identity, document the exact preservation semantics and keep transformation to the absolute minimum.

## Authoritative execution path

For a recorded run, the helper-created frozen prompt must be the execution source.

After the helper creates:

```text
docs/agent-runs/<task-id>/prompt.md
```

the exact Codex command printed by the helper must execute that frozen file.

It must not instruct the user to:

* paste the prompt from chat;
* execute the mutable `docs/discussions/` source;
* manually reconstruct the task prompt;
* execute a separately transformed version.

The required chain is:

```text
agreed discussion file
        ↓
helper snapshots
        ↓
frozen prompt.md
        ↓
helper-generated command executes frozen prompt.md
        ↓
Codex
```

This invariant is central to the task.

## `report.md`

For an explicitly opted-in recorded run only, Codex must create:

```text
docs/agent-runs/<task-id>/report.md
```

before that recorded run is considered complete.

This obligation does not apply to ordinary non-recorded tasks.

Use a concise structure equivalent to:

```markdown
# Task Report — <task-id>

## Outcome

Completed / Partial / Blocked

## Changes

- ...

## Validation

- ...

## Findings / deviations

- ...

## Remaining task-related residue

- ...

## Unrelated working-tree state

- ...

## Recommended next step

- ...
```

Align this with the existing final-report requirements in `AGENTS.md` rather than creating a competing reporting standard.

Do not require `report.md` to contain the hash of the commit that contains the report itself.

The Git commit containing the recorded run establishes the exact repository state.

## Historical semantics

Treat:

```text
docs/agent-runs/
```

as historical task material.

It must not become a source of implied requirements.

A statement appearing in an old `prompt.md` or `report.md` does not become current architecture, setup policy, roadmap, requirement, or implementation policy merely because it exists there.

Do not later mine recorded runs as implied requirements.

If a conclusion from a historical run should become authoritative, a later task must deliberately promote that conclusion into the appropriate authoritative architecture, setup, roadmap, requirements, or other repository documentation.

Historical analysis of prior runs is permitted when explicitly requested, but that analysis does not itself change repository authority.

## Historical immutability

Existing recorded runs are historical records.

Do not silently modify, reuse, or overwrite:

```text
docs/agent-runs/<existing-task-id>/
```

If a task is revised and executed again, use a new task/run id.

For example:

```text
C5.3.2-preserve-complete-text
C5.3.2-preserve-complete-text-r2
```

or another simple repository-consistent convention.

Do not build complicated run-versioning machinery.

The filesystem structure and Git history should remain sufficient.

## AGENTS.md policy

Add a concise opt-in `Task History` section to the repository-root `AGENTS.md`.

It must explicitly establish that:

* recorded runs exist only when explicitly requested by the user or task prompt;
* prompts are normally developed under `docs/discussions/` and frozen when agreed for execution;
* the initiating prompt is preserved under `docs/agent-runs/<task-id>/prompt.md`;
* for a recorded run only, `report.md` is required before that recorded run is considered complete;
* the frozen `prompt.md` is the execution source for the recorded run;
* recorded prompts and reports are historical and must not be rewritten to reflect later decisions;
* `docs/agent-runs/` is historical/audit material, not architecture, setup, roadmap, requirements, or implementation authority;
* conclusions become authoritative only when deliberately promoted into the appropriate authoritative documentation.

Keep this section concise.

Do not duplicate existing source-of-truth, scope, Git, setup, provenance, or validation rules already present in `AGENTS.md`.

## Helper

Implement the smallest practical helper for converting an agreed discussion prompt into a recorded run.

Inspect the repository's existing script conventions first.

Prefer a standalone helper under:

```text
scripts/
```

if consistent with the repository.

For example:

```text
scripts/start-agent-run.ps1
```

or another repository-consistent name.

## `package.json`

Do not modify `package.json` in this task unless repository inspection proves that doing so is genuinely necessary.

An existing dirty `package.json` must otherwise remain untouched.

Do not add a convenience script there merely because it would make invocation shorter.

A standalone helper is preferred.

If inspection unexpectedly demonstrates that `package.json` is necessary, preserve unrelated edits exactly and explain why bringing the file into scope was unavoidable.

## Normal helper workflow

The intended usage should be equivalent to:

```powershell
scripts/start-agent-run.ps1 `
    -TaskId C5.3.2-preserve-complete-text `
    -Prompt docs/discussions/WIP-C5.3.2-preserve-complete-text.md
```

Exact argument naming may follow existing repository conventions.

The helper should:

1. validate the task id;
2. validate that the source prompt exists;
3. create:

```text
docs/agent-runs/<task-id>/
```

4. snapshot the exact current content of the agreed discussion prompt into:

```text
docs/agent-runs/<task-id>/prompt.md
```

5. refuse to overwrite an existing run;
6. clearly identify where the eventual report must be written;
7. print the exact Codex command that executes the newly frozen `prompt.md`.

The user should not need to manually duplicate or paste the prompt.

## Codex invocation

Treat non-launching behavior as the default design.

The preferred helper behavior is:

```text
prepare
    ↓
freeze prompt
    ↓
print exact Codex command using frozen prompt.md
```

rather than wrapping an interactive Codex process.

Inspect the locally available Codex CLI only as needed to determine a correct command for executing the frozen prompt.

Direct Codex launching is optional.

Only implement direct launching if repository/local CLI inspection demonstrates that it is clearly simpler, stable, and does not weaken the archived-prompt/executed-prompt invariant.

A helper that prepares the run and prints the exact invocation is a complete and acceptable implementation.

Do not introduce brittle interactive shell automation merely for convenience.

## Documentation

Add only the minimum documentation needed to explain:

```text
discussion
    ↓
agreed prompt
    ↓
helper snapshot
    ↓
frozen execution prompt
    ↓
Codex execution
    ↓
report
    ↓
checkpoint
```

Document:

* what a recorded run is;
* that recording is opt-in;
* that prompts are normally developed under `docs/discussions/`;
* when a discussion prompt becomes ready to freeze;
* how to invoke the helper;
* where the frozen prompt is stored;
* that the helper-generated Codex command executes the frozen prompt;
* where the final report is written;
* that `report.md` is required before an opted-in recorded run is complete;
* how revised/repeated runs are handled;
* that historical run files are not authoritative requirements or architecture.

A small:

```text
docs/agent-runs/README.md
```

is reasonable if repository inspection supports that location.

Do not duplicate architecture or setup documentation.

Do not change `docs/SETUP.md` unless this implementation genuinely changes verified setup/runtime prerequisites.

## Current discussion artifact

The current implementation discussion is expected to exist as:

```text
docs/discussions/WIP.prompt_history..md
```

Treat renaming this file as part of this checkpoint.

Rename it to:

```text
docs/discussions/WIP-prompt-history.md
```

unless repository inspection reveals a concrete reason that filename is inappropriate.

The rename must preserve the file content unchanged.

Do not combine the rename with editorial changes.

If content changes are required to incorporate this final agreed prompt, perform those deliberately and make it possible in the diff/history to distinguish the content update from the content-preserving filename correction.

Do not delete the discussion file after freezing the recorded prompt.

## This implementation as the first recorded run

Use this task itself to validate the lifecycle end to end.

Treat this implementation as an explicitly recorded run.

Use:

```text
prompt-history-adoption
```

as the task id unless repository inspection reveals a concrete naming conflict.

The lifecycle should be:

```text
docs/discussions/WIP-prompt-history.md
        ↓
agreed prompt
        ↓
helper snapshots
        ↓
docs/agent-runs/prompt-history-adoption/prompt.md
        ↓
helper-generated command executes that exact frozen file
        ↓
implementation
        ↓
docs/agent-runs/prompt-history-adoption/report.md
        ↓
checkpoint commit
```

Do not fabricate previous runs or earlier discussion history.

## Bootstrap consideration

Because the helper does not exist before this task implements it, inspect the repository state and choose the smallest auditable bootstrap necessary for this first run.

The first frozen prompt must still represent the exact agreed implementation prompt actually used.

Do not pretend the new helper was used before it existed.

Document any one-time bootstrap step clearly in the first report.

After adoption, normal recorded runs should use the helper-created snapshot and helper-generated invocation path.

## Do not introduce

Do not introduce:

* a database;
* a service;
* a message queue;
* Git hooks;
* a new framework;
* external persistence;
* telemetry;
* automatic prompt rewriting;
* automatic prompt summarization;
* conversation/session parsing;
* automatic requirement extraction from history;
* a complex task registry;
* background Codex orchestration;
* synchronization machinery between mutable discussion files and already-recorded prompts.

Keep this a small repository utility.

## Git/worktree safety

There may already be unrelated changes in the working tree.

Follow `AGENTS.md` strictly.

Before changing anything:

* inspect `git status`;
* identify existing unrelated changes;
* preserve them untouched.

During the task:

* do not discard unrelated work;
* do not overwrite unrelated files;
* do not stage unrelated files;
* do not use `git add .` or `git add -A` when unrelated changes exist;
* explicitly stage only files belonging to this task.

Treat an already-dirty `package.json` as out of scope unless repository inspection proves it is genuinely necessary.

## Validation

Keep validation proportional to this repository/process-only change.

At minimum verify:

1. an agreed discussion prompt can be snapshotted into a new recorded run;
2. `prompt.md` preserves the source according to the documented exactness semantics;
3. the command emitted by the helper executes the frozen `prompt.md`, not the mutable discussion source;
4. the source discussion can subsequently differ without changing the recorded prompt;
5. an existing run cannot be silently overwritten;
6. an invalid or unsafe task id is rejected;
7. a missing source prompt is handled clearly;
8. generated paths are correct;
9. the helper identifies the required future `report.md`;
10. documentation matches actual helper behavior;
11. ordinary non-recorded tasks remain unaffected.

Where practical, use temporary/test locations so validation does not leave fake historical runs under `docs/agent-runs/`.

Do not run expensive corpus/document-processing tests.

Run:

```text
git diff --check
```

## Review before commit

Before committing, perform a narrow final review of this task only.

Confirm that:

* the workflow matches the repository's actual practice of refining prompts under `docs/discussions/`;
* freezing occurs only after a prompt is agreed and ready for execution;
* recording remains explicitly opt-in;
* ordinary Codex tasks do not acquire a new reporting obligation;
* `report.md` is required only for opted-in recorded runs;
* Codex executes the frozen prompt rather than chat text or the mutable discussion source;
* later discussion edits cannot silently alter historical execution input;
* old runs cannot be silently overwritten;
* `docs/agent-runs/` cannot reasonably be mistaken for current architecture or requirements authority;
* the helper does not unnecessarily depend on interactive Codex CLI behavior;
* `package.json` remains untouched unless inspection proved modification necessary;
* the WIP filename correction is included in the checkpoint and preserves content;
* the mechanism remains materially simpler than manual prompt/report bookkeeping.

Then commit the completed repository/process change as a checkpoint.

Do not start another Virgilio implementation phase afterward.

## Durable report for this task

Ensure:

```text
docs/agent-runs/prompt-history-adoption/report.md
```

records:

* files created/changed/removed;
* final discussion → frozen prompt → execution → report → checkpoint lifecycle;
* exact opt-in trigger added to `AGENTS.md`;
* explicit recorded-run completion rule;
* helper location and usage;
* how the discussion source is snapshotted;
* exact prompt-preservation semantics;
* confirmation that the helper-generated command executes the frozen prompt;
* overwrite-protection behavior;
* handling of repeated/revised runs;
* whether the helper launches Codex or prints the next command, and why;
* documentation added;
* content-preserving rename of the WIP discussion artifact;
* any bootstrap procedure needed for this first recorded run;
* validation performed;
* confirmation that `docs/agent-runs/` is historical and non-authoritative;
* commit hash/message;
* remaining task-related residue;
* unrelated working-tree state;
* exact recommended next step.

Also provide the normal concise terminal final report required by `AGENTS.md`.
