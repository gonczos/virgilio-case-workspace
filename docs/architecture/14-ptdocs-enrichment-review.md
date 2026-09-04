# Isolated PTDocs enrichment review

Status: implemented experimental review area, 4 September 2026. This extends the
current PostgreSQL setup with staging only; it does not change canonical evidence,
representation selection, court-record semantics, or application consultation.

`ptdocs_review` holds attributed external observations from Virgílio's workbook
exports. A SHA match establishes byte identity, not correctness of enrichment.
Occurrence, binary, submission package, embedded act, event, and thread are distinct
identities. A certificate occurrence can contain an email binary without making
that binary intrinsically a certificate.

The four relations are:

| Relation | Purpose |
| --- | --- |
| `import_batch` | Input digests, attribution, source manifest and loader identity |
| `source_row` | Immutable workbook/sheet/row coordinates, workbook hash, raw cell observations including cached values/formulas |
| `row_match` | Explicit crosswalk and matching evidence; unresolved identities retained |
| `validation_finding` | Append-only claim assessments, evidence, method/reviewer and proposed values |

The restricted `ptdocs_reviewer` role can read canonical tables and insert/read
review records. It cannot update/delete review records or write canonical tables.
Loaders explicitly switch to this role and reject canonical table write privileges.
Bootstrap requires an administrative connection. The configured session login can
have greater privileges: `SET ROLE` is an application guard, not a separate security
credential against a malicious administrator. No reviewer login/password is added.

Batch keys derive from six snapshot files. Repeating the same input reuses its
batch. Changed snapshots create another batch. Findings deduplicate identical JSON
payloads; different assessments remain separate. `supersedes_id` is available for
explicit later review records; no automatic conflict resolution exists. Operators
must not interpret the newest assessment as approved truth without a policy.

Source rows and row matches enforce same-batch foreign keys. Canonical links use
database foreign keys without cascading deletes. This means referenced canonical
rows cannot be removed without explicitly handling review lineage first.

The initial automated pass inventories enrichment fields, flags conflicting values
for identical binaries, checks single-hash format and cached spreadsheet errors,
and selects 40 distinct binaries across ten document families. This is targeted
sampling, not statistical estimation. Existing text representations retain their
processor/version, segment IDs and text digest; explicit human consultation
selection takes precedence. Mixed PDFs require relevant original-page inspection
because literal extraction can omit scanned pages. Original access uses BinaryStore.

An assessment applies only to its stated claim/component. `supported` means the
cited evidence supports that assertion; it does not verify all row fields, the
truth of quoted allegations, legal conclusions, or cryptographic signatures.
Workbook reliability labels remain external assertions. Promotion into canonical
or semantic models is a separate future phase and is not implemented.

See `docs/SETUP.md` for commands and
`docs/discussions/2026-09-04-ptdocs-validation-results.md` for this snapshot's results.
