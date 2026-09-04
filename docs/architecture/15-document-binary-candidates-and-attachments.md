# Document binary candidates and attachment relationships

Date: 2026-09-05. Status: agreed design direction; not implemented.

This records the agreed separation of uncertain binary backing from document
attachment membership. It narrows the future relationship layer anticipated in
[the consolidated architecture](07-consolidated-architecture-reference.md).
It does not authorize a migration, data promotion, or application changes.

## Meaning and boundaries

* `document_binary` continues to represent established document-to-binary links.
* `document_binary_candidate` records possible backing without asserting a link.
* `document_attachment` records that one document is an attachment of another,
  independently of whether its binary backing is known.

An attachment can reside within the same file as its parent or be a separate
file/document registered by the court. Membership, content location, and court
registration are separate assertions. An attachment relationship does not imply
physical containment, an independent binary, or an independently registered court
record. A page range/segment locator will be needed for content within a combined
file; the exact location model is deferred. Do not manufacture child binaries.

These are attributed relationships, not new canonical source facts. Original
bytes remain immutable. A SHA match proves byte identity, not all enrichment.

## Candidate binary relation

Proposed table: `document_binary_candidate`.

| Column | Intended meaning |
| --- | --- |
| `id` | Primary key |
| `document_id` | Required FK to `document` |
| `file_binary_id` | Required FK to `file_binary`; follows existing naming |
| `candidate_group_id` | Shared ambiguity group, where applicable; target model deferred |
| `status` | Proposed vocabulary: `proposed`, `confirmed`, `rejected` |
| `notes` | Why the pair is possible and why identity remains uncertain |
| `evidence_json` | Supporting evidence references and method/lineage |
| `created_by` | Human or processor attribution |
| `created_at` | Creation timestamp |

**AK `(document_id, file_binary_id)`**, enforced with a unique constraint. Both
directions permit multiple candidates; the same pair must not be duplicated.
There is no global one-to-one rule: the same binary may legitimately represent
multiple document records. A group-specific bijection requires evidence and must
not be inferred merely from equal set sizes.

Confirmation creates the established `document_binary` association through an
explicit reviewed operation. Preserve the candidate and decision history;
rejection likewise must not erase the original proposal/evidence. The exact
history table, transition rules and transaction design are implementation decisions
still to be specified. A unique pair can have multiple supporting observations.

Candidates must not enter existing joins as established backing, alter primary
binary or representation selection, or silently change missing-file status.
Recovered files must first receive legitimate binary registration and storage
provenance before a foreign-key candidate can reference them. Staging a filename
or hash alone does not perform that registration.

## Attachment abstraction

Proposed table: `document_attachment`.

| Column | Intended meaning |
| --- | --- |
| `id` | Primary key |
| `parent_document_id` | Required FK to `document` |
| `attachment_document_id` | Required FK to `document` |
| `attachment_label` | Nullable designation such as `Doc. 2` or `Anexo A` |
| `notes` | Explanation, including unresolved numbering |
| `evidence_json` | Supporting source references and locations |
| `evidence_observation_id` | Optional reference to shared evidence; target model deferred |
| `created_by` | Human or processor attribution |
| `created_at` | Creation timestamp |

**AK `(parent_document_id, attachment_document_id)`**. Prevent self-attachment.
There is no required binary and no global uniqueness constraint on labels.
Multiple parents are permitted. A label is an observation in its parent context,
not a global document identity or a proxy for HTML rendering order.

The agreed pair key represents one membership per logical document pair. If a
future case needs repeated slots for the same pair, preserve the observed slots
separately rather than silently weakening the agreed key. The exact parent
document must be established: a submission reference or bucket ID is not itself
a `document.id`. Do not arbitrarily substitute a manifest carrier for the parent.

The shared set assertion is recorded once and referenced by all relevant rows.
Do not duplicate it into independent notes that can diverge. Choosing its durable
observation/group model remains open; no FK to an invented table is yet specified.
An extension should support multiple independent evidence observations per pair.

## April 2021 worked example

For submission reference `38642470`, bucket `18667032`, dated 2021-04-23,
the agreed interpretation is that the three known court image records collectively
cover the three recovered attachments. The individual pairing is unresolved.

| Court `document_procinfo` | Internal `bucket_document_id` |
| --- | --- |
| `5115FE0F-FA98-4128-84B7-EB3276A53293` | 1288 |
| `882CECC0-1C73-47DD-8C90-1C41DD58F889` | 1289 |
| `B27780FF-07B3-4EEA-A22F-BF627DCEF67A` | 1290 |

These numeric IDs are occurrence-link IDs, **not `document_id` values**. Resolve
the actual document foreign keys before any future insertion.

The recovered image SHA-256 values match the manifest's Docs. 2, 3 and 6. Record
three parent-to-court-document attachment memberships with null individual labels,
supported by the attributed shared set observation. Preserve the known
label-to-image-hash associations in that observation without assigning labels to
individual court records. This records the agreed interpretation; it is not a
claim that a new court-system identity match was discovered.

The possible document-to-image pairs can be represented as nine candidate rows
(three by three) in one ambiguity group, without a preferred pairing. The actual
candidate population remains a future reviewed operation, not a completed import.

Reasons for ambiguity: HTML has no file hashes; all three reported image sizes
are zero; the bucket size equals its six PDFs' listed sizes; direct retrieval
returned failure HTML; and the user reports unstable rendering order. Court
UUIDs do not supply image hashes. Manifest membership survives this uncertainty.
Original-image/PDF-derivative correspondence is a separate assertion and must not
substitute derivative hashes for the original image hashes.

Supporting audit: [original scrape cross-check](../discussions/2026-09-04-ptdocs-original-scrape-crosscheck.md).
The historical audit remains evidence, not general architecture authority.

## Implementation impact and next boundary

Existing reference observations provide a precedent for candidate targets and
provenance, but are not already an attachment/group model. The isolated
`ptdocs_review` findings can preserve current evidence; they do not implement
these new relations or grant permission to promote them automatically.

A future implementation needs migration/bootstrap parity, keys and evidence
integrity, a review-history policy, and explicit consultation/export contracts.
Court-record consultation must retain its source-recorded meaning; attachment
and candidate results require separate, clearly attributed output. Current
exports and reference graphs will not automatically include new tables.
No corpus-wide OCR, search reindexing, or representation reselection is required
merely to introduce these relations. Future runtime/setup changes must update
`docs/SETUP.md` with the implementation.

Next design step: settle the shared observation/group and decision-history
model, exact parent identity, and same-file content-location contract before
writing migration SQL. No tables, candidates, attachment rows, or binaries are
created by this documentation change.
