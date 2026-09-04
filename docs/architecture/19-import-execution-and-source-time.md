# Import executions and source dates

Implemented 2026-09-05 for the saved-HTML importer. Migration 015 adds an execution
header without repurposing the package-specific `import_batch`: its unique package
and capture constraints are unsuitable for repeatable attempts. The package
importer is unchanged and does not yet emit these new headers.

## Source time versus import time

| Field | Meaning |
| --- | --- |
| `source_capture.captured_at` | Source capture/run start, nullable if unknown |
| `source_capture.capture_ended_at` | Optional source run end; not invented from import finish |
| `source_capture.capture_time_basis` | `unknown`, `source_reported`, `inferred_run_label`, or `legacy_unspecified` |
| `source_capture.created_at` | Local registration record creation |
| `import_execution.started_at` | Start of this DB import attempt; see historical exception below |
| `import_execution.finished_at` | Completion/failure time; null for running or unknown historical finish |

These are timestamptz instants, independently of the document/case calendar dates.
The run-label helper accepts only a valid terminal `YYYY-MM-DDTHH-mm-ss-SSSZ`.
Its date is an inference about run start, not proof of every row's acquisition time.
Unrecognized labels leave the source date null with basis `unknown`.

Capture 2 now has `captured_at = 2026-08-29T22:50:36.257Z`, basis
`inferred_run_label`, and unknown end. Its old registration value
`2026-09-04T23:34:28.381Z` (5 September 00:34:28 in Lisbon) survives in a historical
execution and `metadata_json.legacy_registration_at`. Original metadata also
survives in that header. No HTML bytes, findings or links are rewritten.
Other captures retain their existing timestamp and default `legacy_unspecified`;
for the older portable package the timestamp describes export, not original scrape.

## `casework.import_execution` field dictionary

| Column | Meaning |
| --- | --- |
| `id` | Generated primary key |
| `source_capture_id` | Nullable FK: known committed/reused capture; may be unavailable for failed attempt |
| `import_batch_id` | Optional FK for a future package execution adapter; unused by HTML importer |
| `execution_key` | Optional unique idempotency key for historical backfill; regular retries get separate IDs |
| `importer_key` | `citius-html-import` |
| `importer_version` | SHA-256 of executing loader |
| `input_sha256` | Full snapshot digest; required 64 lowercase hex characters |
| `source_label` | Source run label, retained even if capture insertion rolls back |
| `started_at` | Database attempt start; historical row uses preserved registration time as proxy |
| `finished_at` | Completion time; cannot precede start |
| `status` | `running`, `succeeded`, `failed`, `historical_completed` |
| `reused_capture` | Whether a successful attempt reused the existing evidence capture |
| `counts_json` | HTML artifact/link counts and coverage; backfill records available observation count |
| `error_json` | Failure code/name and rollback note; avoids persisting raw connection/source errors |
| `metadata_json` | Historical timing qualification and original capture metadata |

The historical row proves a completed registration, not measured execution start
and duration. The code does not invent headers for prior retries for which no
durable execution record exists. Foreign keys restrict deletion of referenced
captures/batches. There is no one-header-per-capture uniqueness constraint.

## Transaction and retry behavior

After input parsing/hash validation and DB connection, the importer inserts a
`running` header outside the evidence transaction. Source observations, links,
coverage report and header success update then commit together. On a handled
transaction error, evidence rolls back and the header is marked failed in a
separate statement. Input-read/hash failures before header creation and inability
to connect are not persisted; process/database crashes may leave `running` and
require explicit inspection. No automatic timeout reconciliation is implemented.

The DB success status means the import transaction committed. A later local report
write failure does not change that committed status to failed. A retry records a
new header and validates/reuses the capture without duplicating observations.
Newly persisted coverage reports contain their originating execution ID; historical
reports stay unchanged and are associated through capture ID. Retry headers store
counts; local retry reports carry their new execution ID.

Migration/backfill is repeatable. Bootstrap includes identical additive DDL; it
does not need historical repair on an empty database. The migration command infers
the original run-label time only for explicitly identified old HTML registrations.

## Verification and boundaries

Verified migration replay, source timestamp parsing (including invalid labels),
successful reuse, and a deliberately changed parsing snapshot rejected against
the existing source capture. The rejected validation attempt is retained as a
failed execution; all 3,874 existing observations remained intact. Historical
registration and unknown completion time were preserved. No canonical case,
document or binary correction was made.

See [setup](../SETUP.md), [raw field dictionary](17-citius-source-data-dictionary.md)
and [HTML capture contract](16-saved-citius-html-provenance.md).
