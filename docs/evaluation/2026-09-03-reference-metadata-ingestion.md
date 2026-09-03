# Court-metadata reference ingestion checkpoint

Date: 2026-09-03

## Scope

This checkpoint implements only corpus-wide ingestion of references recorded
in court-system metadata. It does not expand document-text citation extraction,
the lookup API, or the search UI.

The ingested fields are `case_file.processo`, `case_file.idprocesso`,
`bucket.reference_number`, and `document.document_procinfo`. Case and occurrence
references use direct case/occurrence anchors. Source-document references use
one direct document anchor while retaining every occurrence as context.

## First application

The dry run proposed 2,200 new current observations and reconciliation of 38
older fixture-scoped metadata observations. The transactional write committed
those exact counts. It did not replace pilot document-text observations or
external-register observations.

The immediate post-write dry run reported:

- 2,200 unchanged current observations;
- no inserts, refreshes, reactivations, supersessions, or retirements; and
- no remaining pilot reconciliation work.

Rerunning the legacy pilot seeder and then repeating the metadata dry run
produced the same unchanged result. The legacy seeder therefore did not
reactivate reconciled fixture metadata or create new current duplicates in
this database state.

Follow-up correction: write mode builds the source and lifecycle plan after
opening a repeatable-read transaction. This removes the earlier gap in which
the plan was read before the transaction began. Dry-run planning remains
outside a transaction and issues only its three read queries.

## Semantics and limitations

Lifecycle history is append-only and distinct from human review history.
Current states are `current`, `superseded`, and `retired_source_absent`.
Reappearing values reuse a historical observation only when both the raw value
and normalization identity match; the transition does not imply renewed human
review.

Binary association is contextual rather than forced into a single file. The
recorded states distinguish no direct association, all files available, all
files missing, and mixed availability. No target references are inferred or
resolved by this ingestion.

The 2,200 count describes populated values in the four selected source fields,
not all identifiers mentioned inside documents and not external-register
coverage. API and UI exposure remain a later checkpoint.
