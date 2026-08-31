# Phase C3 Durable Async Multi-Representation Processing

Run date: 2026-08-31

## Scope

- Productionized the Phase C1/C2 processing model without changing canonical case/bucket/document/file-binary semantics.
- Kept extraction local-only through subprocess invocation of the pinned Docling and Xberg processors already validated in C2.
- Added durable asynchronous job execution, persisted representation comparisons, automatic representation selection, explicit selection overrides, and human-authored representation support.
- Validated only a small representative subset of imported PDFs, not the full corpus.

## Schema Added In C3

- `casework.document_representation`
  - added `representation_source_kind`
  - added `representation_variant_key`
  - added `based_on_representation_id`
  - widened output uniqueness to include `representation_variant_key`
  - added `(id, file_binary_id)` candidate key for same-binary selection/comparison FKs
- `casework.document_representation_selection`
  - explicit preferred representation per `(file_binary_id, selection_purpose)`
- `casework.document_representation_comparison`
  - generic pairwise comparison rows between immutable representations of the same `file_binary`

## Runtime Added In C3

- `app/processing-registry.mjs`
  - explicit processor registry for `docling`, `xberg`, and `plain_text_passthrough`
- `app/processing-store.mjs`
  - enqueue, claim, complete/fail, recover, selection, human representation, comparison, and inspection logic
- `app/processing-worker.mjs`
  - durable worker using PostgreSQL claiming and background local extraction
- `app/processing-admin.mjs`
  - enqueue, inspect, recover, create human representation, and explicit selection CLI
- `app/processing-comparison.mjs`
  - processor-agnostic normalized-text comparison logic reused by C2 and C3

## Worker Semantics

- Claiming uses `FOR UPDATE SKIP LOCKED`.
- The worker transitions queued jobs to `running` inside a short transaction, releases the transaction, performs extraction, then persists the result afterward.
- Consultation queries remain PostgreSQL-only and do not require a worker to be running.
- Recoverable failures requeue the same logical job row until `max_attempts` is exhausted.
- Terminal failures remain persisted as failed jobs; a later explicit retry is a new queued job row.

## Local Runtime/Offline Behavior

- The worker uses a dedicated processing runtime directory under `data/processing-runtime/`.
- For pinned Docling/Xberg model caches it reuses the existing C2 local cache roots under `data/exports/phase-c2/` when present.
- `HF_HUB_OFFLINE=1` and `TRANSFORMERS_OFFLINE=1` are set for worker extraction so court documents are not sent to external services during C3 processing.
- This was necessary because a fresh empty runtime cache caused Docling to attempt model download and fail under the restricted local environment.

## Validation Corpus Used For C3 Runtime Checks

- `3927b4143c2263b3b5051e34ed37de1a3bfa8677611ea2d7886cdd8dec604835`
  - 8-page `text_pdf`
- `10a5cee639d7ff6c82673389ec7cad59a376b58273e2d9303edafe1cebe375f1`
  - 8-page `mixed_pdf`
- `1d388e12b48fab95a03bc8fb98f8971195a7162d858d7d4839db7db11f75dbc7`
  - 8-page `image_only_pdf`
- `5f3ff23ac83931b4b7e9bf56dc2bf55f2abae43e9167f91da02761e611f29cb1`
  - 88-page `mostly_image_pdf`

## Runtime Validation Outcome

- Both Xberg and Docling completed through the background worker.
- The first Docling attempts on two files failed because the initial C3 worker path used a fresh runtime cache and therefore could not resolve Hugging Face model artifacts offline.
- Those failures remained persisted as `processing_job` rows with `status='failed'`.
- After switching the worker to reuse the existing local C2 cache roots directly, later explicit Docling retries succeeded for the same processor version.
- Pairwise comparison rows were created automatically when both Docling and Xberg representations existed for the same `file_binary`.

## Final Live C3 Sample Outcomes

- File `281` (`text_pdf`)
  - Xberg completed first
  - later Docling completed via explicit retry
  - comparison disagreement level: `low`
  - automatic consultation selection: Docling
- File `88` (`mixed_pdf`)
  - Xberg completed first
  - later Docling completed via explicit retry
  - comparison disagreement level: `high`
  - automatic consultation selection: Docling
- File `152` (`image_only_pdf`)
  - Docling completed
  - Xberg completed
  - comparison disagreement level: `high`
  - automatic consultation selection: Docling
  - derived attention state: `review_needed = true`
- File `455` (`mostly_image_pdf`, 88 pages)
  - Docling completed through the background worker
  - used for consultation-isolation validation during long-running extraction

## Selection Behavior

- Automatic selection is purpose-based, not processor-authority-based.
- Current `consultation_default` automatic policy prefers:
  - Docling
  - then Xberg
  - then plain-text passthrough
  - then human-authored representation if no machine representation is available
- `quick_preview` is intentionally separate and currently prefers:
  - plain-text passthrough
  - then Xberg
  - then Docling
  - then human-authored representation
- Explicit human selection of a specific immutable representation overrides automatic policy.
- Merely creating a human-authored representation does not automatically make it preferred.

## Attention / Review State

- No separate workflow table was added in C3.
- Review-needed state is derived from persisted representations, explicit selections, and comparison rows.
- Current derived reasons include:
  - `human_representation_present`
  - `representation_disagreement`
  - `newer_representation_after_explicit_selection`

## Consultation Isolation Validation

- While the 88-page Docling job was running:
  - `pg_stat_activity` showed `application_name = 'processing-worker'`
  - `state = 'idle'`
  - `xact_start IS NULL`
  - `backend_xid IS NULL`
- During that same period, the baseline consultation views still returned:
  - `v_case_summary`: `5 / 897 / 1550`
  - `v_bucket_summary`: `897 / 2070 / 2091`
  - `v_document_summary`: `1293 / 2070 / 1257`
  - `v_unresolved_document`: `39`
- After the worker stopped, consultation remained available and there were zero active worker jobs.

## Tests Run

- `node --test ./test/phase-c2.test.mjs`
- `node --test --test-concurrency=1 ./test/phase-c3.test.mjs`

Focused C3 tests covered:

- processor policy selection
- processor-agnostic comparison behavior
- automatic versus explicit selection
- human representation not automatically overriding machine selection
- attention derivation
- duplicate-claim prevention for the same queued job
- successful completion through the generic worker path
- persisted failure plus explicit recovery/requeue
- avoidance of duplicate active jobs and duplicate same-version satisfied output

## Live Counts After C3 Validation

- canonical counts unchanged:
  - `case_file = 5`
  - `bucket = 897`
  - `document = 1293`
  - `bucket_document = 2070`
  - `file_binary = 1238`
  - `document_binary = 1257`
- processing counts:
  - `processing_job = 23`
  - `document_representation = 21`
  - `document_segment = 21`
  - `document_representation_selection = 0`
  - `document_representation_comparison = 3`
- processing job status counts:
  - `completed = 21`
  - `failed = 2`

## Fresh Bootstrap Validation

- A genuinely empty temporary PostgreSQL database was created.
- `db/init/001-bootstrap.sql` loaded successfully from start to finish.
- The new C3 columns and tables existed in the temp DB:
  - `representation_source_kind`
  - `representation_variant_key`
  - `based_on_representation_id`
  - `document_representation_selection`
  - `document_representation_comparison`
- New processing/selection/comparison tables started empty there.
- The temporary database was dropped afterward.

## Known Limitations

- No queue helper or backlog seeding was added beyond the CLI/admin commands in this slice.
- No web UI, viewer, or review workflow was added.
- No semantic extraction or Phase D processing was started.
- Human representation creation and explicit selection were validated through DB-backed tests rather than persisted live review data.
- The current comparison is normalized-text only; it is intentionally conservative and does not select truth or reconcile disagreements.

## Recommended Next Step

- Proceed to the next narrow phase with:
  - backlog seeding for selected binaries
  - a small operational queue helper around the existing worker/admin primitives
  - first downstream consumers that explicitly declare which `document_representation` they use
- Do not collapse Docling and Xberg into one canonical extracted-text field.
- Keep selection separate from processing and keep downstream lineage pinned to the exact representation used.
