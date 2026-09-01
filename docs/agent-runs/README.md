# Agent Runs

`docs/agent-runs/` stores opt-in historical records of selected Codex
tasks.

Normal lifecycle:

```text
docs/discussions/WIP-<topic>.md
        ->
agreed prompt
        ->
docs/agent-runs/<task-id>/prompt.md
        ->
task runs normally using the frozen prompt
        ->
docs/agent-runs/<task-id>/report.md
```

Rules:

* recorded runs are opt-in only;
* prompts are normally developed under `docs/discussions/`;
* freeze a prompt only when it is agreed and ready for execution;
* the frozen `prompt.md` is the authoritative execution input for that recorded run;
* `report.md` is required before an opted-in recorded run is complete;
* existing recorded runs are historical records and must not be silently overwritten;
* historical prompt/report files are not architecture, setup, roadmap, or requirements authority.

Helper workflow:

```powershell
.\scripts\start-agent-run.ps1 `
    -TaskId prompt-history-adoption `
    -Prompt docs/discussions/WIP-prompt-history.md
```

The helper:

* creates `docs/agent-runs/<task-id>/`;
* snapshots the agreed prompt as `prompt.md`;
* creates a `report.md` template;
* prints a suggested `codex exec` command that uses the frozen prompt.

The helper does not own process supervision or progress tracking.
Its job is only to register the agreed prompt and initialize the durable
report location before the task runs normally.

If a task is revised and run again, create a new task id such as
`<task-id>-r2`.
