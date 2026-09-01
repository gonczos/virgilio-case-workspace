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
Codex executes the frozen prompt
        ->
docs/agent-runs/<task-id>/report.md
```

Rules:

* recorded runs are opt-in only;
* prompts are normally developed under `docs/discussions/`;
* freeze a prompt only when it is agreed and ready for execution;
* the frozen `prompt.md` is the execution source for that recorded run;
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
* prints the exact `codex exec` command that uses the frozen prompt.

If a task is revised and run again, create a new task id such as
`<task-id>-r2`.
