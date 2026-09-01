# Virgilio AGENTS.md Operating Rules

## Instruction precedence

* System, developer, and user instructions override this file.
* Within the repository, a more local `AGENTS.md` overrides a parent `AGENTS.md` for files in its scope.
* Task-specific instructions may deliberately narrow the rules below for that task.

## Sources of truth

* Read applicable `AGENTS.md` files before changing code.
* Architecture source of truth lives under `docs/architecture/`, unless a task explicitly identifies a narrower authoritative file.
* Files under `docs/discussions/` are normally prompts, implementation notes, decisions, and historical records; they are not automatically architecture authority.
* Do not silently contradict authoritative architecture documentation.
* If repository evidence contradicts documentation, identify the discrepancy and update the appropriate source of truth deliberately rather than silently choosing one.

## Scope discipline

* Implement only the requested phase or slice.
* Do not start the next phase unless explicitly requested.
* Do not broaden a narrow task into unrelated refactoring, infrastructure, UI, search, semantic, or deployment work.
* Prefer the smallest change that satisfies the requested objective.
* Inspect the relevant existing implementation before introducing a new abstraction.
* If inspection shows that a task assumption is materially wrong, do not force the requested design; report the finding and adjust only where the task permits.
* If unrelated defects or opportunities are discovered, record them separately unless they block the requested slice.

## Evidence and provenance invariants

* Original file binaries are immutable canonical evidence.
* Derived representations and artifacts are interpretations of evidence, not canonical truth.
* Preserve processor identity, version/configuration identity, and input lineage where applicable.
* Every downstream derivation should be traceable to the exact representation or evidence input from which it was produced.
* Independent extractor outputs remain independent interpretations; do not silently merge them into a synthetic truth.
* Preserve historical processing failures/attempts where the current model supports it; do not collapse a historical failed attempt into a later success.
* Do not overwrite an existing successful representation merely because processing is retried.
* Execution-policy changes are distinct from representation/content identity unless they materially change output semantics.
* Explicit human representation selection overrides automatic consultation policy.
* Merely creating a human representation does not make it preferred.

## Storage

* Access original binaries through `BinaryStore` or the applicable runtime storage abstraction.
* Do not introduce direct machine-specific file-path dependencies into application code when the storage abstraction should own resolution.
* Do not expose local filesystem paths through APIs or UI.
* Derived artifacts remain representation-scoped and provenance-aware.
* Preserve the distinction between canonical binary storage and derived artifact storage.

## Processing architecture

* Core processing remains format-agnostic.
* File-type-specific behavior belongs at processor/adapter boundaries.
* Near-term formats are primarily PDF and plain text; DOC/DOCX and spreadsheet formats are expected later.
* Processing may be architecturally separate without becoming a network microservice.
* Cheap evidence extraction, expensive interpretation, and downstream semantic derivation are distinct layers and should not be conflated.
* Local processing is a valid deployment model.
* Do not migrate local processors to WSL or remote services unless explicitly required.
* Do not introduce message brokers, Redis, external queues, worker frameworks, distributed schedulers, ORMs, Kubernetes, service-mesh infrastructure, or similar operational machinery unless the task provides concrete justification.

## Derived data

* Search indexes, chunks, embeddings, semantic observations, summaries, and AI outputs are derived data.
* Derived data must retain lineage to its actual input representation/evidence.
* PostgreSQL remains authoritative for derivation and provenance state unless the architecture explicitly changes.
* Search/vector indexes are disposable projections, not canonical truth.
* Do not allow downstream AI/search convenience to weaken evidence provenance.

## Consultation and UI

* Directus is the raw/admin consultation surface.
* The custom consultation UI is a thin human-facing inspection and validation surface.
* Do not expand UI work into search, workflow, annotation, semantic editing, or AI functionality unless explicitly requested.
* UI state used only for viewing must not silently mutate representation preference or canonical state.

## Git and worktree safety

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
* A globally clean working tree is not required when unrelated user work was already present.

## Validation

* Run focused tests relevant to changed behavior.
* Do not trigger expensive corpus processing merely as regression validation.
* Use bounded samples for long-running or expensive processing validation.
* Preserve durable processing/database state during validation.
* Stop further heavy validation on orphan processes, inconsistent persisted state, overwrite/provenance risk, corrupted output, or runaway resource behavior.
* If a task is documentation-only or architecture-only, prefer lightweight verification and avoid unnecessary runtime/test churn.
* Distinguish automated tests, build validation, and live/local smoke validation in reports.

## Setup documentation policy

* The repository must maintain one explicit operational setup source of truth.
* Until that source is formally established, do not invent competing setup documents.
* Once `docs/SETUP.md` is adopted as that source of truth, any change that adds, removes, upgrades, relocates, or materially changes a runtime prerequisite, external executable, service, environment variable, storage requirement, database bootstrap step, processor dependency, port, or startup procedure must update `docs/SETUP.md` in the same change.
* Unresolved portability/setup work should be tracked separately from instructions that are known to work.
* Current-behavior documentation must be repository-verifiable.
* Speculative or planned behavior must be clearly identified as TODO/future work.

## Final task reports

Keep final implementation reports concise but sufficient to establish the checkpoint.

Report, as applicable:

* what changed;
* relevant architectural or operational findings;
* validation performed and results;
* intentional deviations from the task;
* persisted/live validation results where relevant;
* commit hash and message if committed;
* whether intended task-related residue remains;
* unrelated working-tree state when relevant;
* exact recommended next step.

Do not inflate reports with repeated policy text that is already defined here.
