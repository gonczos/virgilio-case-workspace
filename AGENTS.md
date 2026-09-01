# Virgilio Agent Operating Rules

## Instruction Precedence

* System, developer, and user instructions override this file.
* Within the repository, a more local `AGENTS.md` overrides a parent `AGENTS.md` for files in its scope.
* Task-specific instructions may deliberately narrow repository policy for the current task.

## Sources Of Truth

* Read applicable `AGENTS.md` files before changing code.
* Architecture source of truth lives under `docs/architecture/`, unless a task explicitly identifies a narrower authoritative file.
* Files under `docs/discussions/` are normally prompts, notes, results, or historical records; they are not automatically architecture authority.
* Do not silently contradict authoritative architecture documentation.
* If repository evidence contradicts documentation, report it and update the appropriate source of truth deliberately.

## Scope Discipline

* Implement only the requested phase or slice.
* Do not start the next phase unless explicitly requested.
* Prefer the smallest change that satisfies the requested objective.
* Inspect the relevant existing implementation before introducing a new abstraction.
* If a task assumption is materially wrong, do not force the design; report the finding and adjust only where the task permits.
* If unrelated defects or opportunities are discovered, record them separately unless they block the requested slice.

## Evidence And Provenance

* Original file binaries are immutable canonical evidence.
* Derived representations and artifacts are interpretations or derived observations, not canonical truth.
* Preserve processor identity, version/configuration identity, and input lineage where applicable.
* Every downstream derivation should remain traceable to the exact representation or evidence input from which it was produced.
* Do not silently merge independent extractor outputs into synthetic truth.
* Preserve historical processing failures/attempts where the current model supports it; do not collapse a historical failed attempt into a later success.
* Do not overwrite an existing successful representation merely because processing is retried.
* Explicit human representation selection overrides automatic consultation policy.
* Merely creating a human representation does not make it preferred.

## Task History

* Recorded runs are opt-in only: use them when the user explicitly requests a recorded run or the task prompt explicitly requires one.
* Prompts are normally developed under `docs/discussions/` and frozen only when agreed and ready for execution.
* For a recorded run, preserve the initiating prompt under `docs/agent-runs/<task-id>/prompt.md`.
* For a recorded run, `docs/agent-runs/<task-id>/report.md` is required before that recorded run is complete.
* For a recorded run, the frozen `prompt.md` is the execution source and must not be silently replaced by chat text or a later discussion revision.
* Recorded prompts and reports are historical/audit material. They are not architecture, setup, roadmap, requirements, or implementation authority merely because they exist in the repository.
* If a conclusion from a recorded run should become authoritative, deliberately promote it into the appropriate authoritative documentation.

## Storage And Processing Boundaries

* Access original binaries in application/runtime code through `BinaryStore` or the applicable storage abstraction.
* Do not introduce direct machine-specific file-path dependencies into application/runtime code when the storage abstraction should own resolution.
* Do not expose local filesystem paths through APIs or UI.
* Cheap evidence extraction, expensive interpretation, and downstream semantic derivation are distinct layers and should not be conflated.
* Core processing remains format-agnostic; file-type-specific behavior belongs at processor/adapter boundaries.
* Do not migrate current local processing paths to WSL or remote services unless the task explicitly justifies that change.
* Do not introduce message brokers, Redis, external queues, worker frameworks, distributed schedulers, ORMs, Kubernetes, service-mesh infrastructure, or similar machinery unless the task provides concrete justification.

## Derived Data

* Search indexes, chunks, embeddings, semantic observations, summaries, and AI outputs are derived data.
* Derived data must retain lineage to the exact input representation or evidence actually used.
* Treat PostgreSQL as the current authoritative derivation/provenance state in this repository unless the task explicitly changes that design.
* Search/vector indexes are disposable projections, not canonical truth.

## Consultation And UI

* Directus remains the raw/admin consultation surface where used; the custom UI is the human-friendly consultation surface.
* Do not expand UI work into search, workflow, annotation, semantic editing, or AI functionality unless explicitly requested.
* UI/viewing behavior must not silently mutate canonical state or representation preference.

## Setup And Portability Policy

* `docs/SETUP.md` is the operational source of truth for verified current setup instructions.
* `docs/TODO-setup-and-portability.md` is the source of truth for unresolved setup, portability, migration, automation, and deployment work.
* Any change that adds, removes, upgrades, relocates, or materially changes a runtime prerequisite, external executable, service, environment variable, storage requirement, database bootstrap step, processor dependency, port, or startup procedure must update `docs/SETUP.md` in the same change.
* Do not present clean-machine reproducibility, setup automation, readiness detection, or Docker-first portability as implemented unless the repository actually supports them.
* Dockerization is deployment infrastructure and must not become part of canonical evidence or provenance semantics.

## Git And Worktree Safety

* Inspect `git status` before making changes.
* Preserve unrelated user work.
* Never use destructive cleanup such as `git reset --hard` or `git clean` against unrelated work.
* Do not discard, overwrite, stage, or commit unrelated changes merely to obtain a clean working tree.
* When unrelated changes exist, stage intended files explicitly.
* Avoid `git add .` and `git add -A` when the working tree contains unrelated work.
* Review the staged diff before committing.
* Run `git diff --check` before committing.
* The checkpoint invariant is:
  * intended task changes are committed;
  * no intended task residue remains;
  * unrelated pre-existing work may remain untouched.

## Validation

* Run focused validation relevant to changed behavior.
* Do not trigger expensive corpus processing merely as regression validation.
* Use bounded samples for long-running or expensive processing validation.
* Preserve durable processing/database state during validation.
* If a task is documentation-only or architecture-only, prefer lightweight verification and avoid unnecessary runtime/test churn.

## Final Reports

Report concisely, as applicable:

* what changed;
* relevant validation;
* intentional deviations or findings;
* commit hash/message if committed;
* remaining task-related residue;
* unrelated working-tree state if relevant;
* exact recommended next step.
