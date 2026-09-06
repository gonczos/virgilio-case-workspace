# Entity-specific external identifiers

Date: 2026-09-06. Status: agreed design direction; **not implemented**.

This records the agreement to use a shared identifier concept with separate
operational tables and real foreign keys. It does not authorize migration,
backfill, removal of existing identifier columns, or changes to search/display.

## Identity and references

Our internal primary key remains the stable identity of each object. External
identifiers form an optional collection: an object can have zero, one or several.
Do not invent an external reference to make an object admissible to the model.

| Identifier role | Meaning | Example |
| --- | --- | --- |
| Internal | Our object's stable PK | `document.id` |
| Source system | Identity of a record in the originating system | Citius `idprocesso` or `procinfo` |
| Authority | Official reference used for proceedings or procedural organization | Proceeding number or submission reference |
| Stakeholder | Reference assigned within another participant's system | A lawyer's own file reference |

These roles describe usage; they need not be mutually exclusive. The source
system can also be the issuer of an authoritative reference. External record
persistence is a property of the relevant source scheme, not a universal promise
made by our database. Values from different schemes need not match.

A reference may identify a grouping rather than an individual document. Record
it against the object it actually identifies; do not attach it indiscriminately
to every related object. For example, court bucket `18667032`, submission reference
`38642470`, document `procinfo` values and binary SHA-256 values are distinct
identities connected by evidence, not interchangeable identifiers.

## Agreed operational shape

| Proposed table | Required parent FK |
| --- | --- |
| `case_file_identifier` | `case_file_id` → `case_file.id` |
| `bucket_identifier` | `bucket_id` → `bucket.id` |
| `document_identifier` | `document_id` → `document.id` |

Each table follows the same conceptual field conventions, while joins, indexes
and referential integrity remain specific to its entity. Do not substitute a
generic `object_type` plus `object_id` pair that cannot enforce those foreign keys.
No common object supertable or database inheritance mechanism is agreed here.

Each assignment should describe:

| Conceptual field | Purpose |
| --- | --- |
| Parent object FK | Which internal object the identifier identifies |
| Namespace/reference scheme | Meaning and scope of the identifier vocabulary |
| Issuer | Who assigned it; distinct from who supplied the observed copy |
| Value | Identifier as text, preserving leading zeros, separators and case |
| Role/reference type | Source-system, authority or stakeholder use, including overlap where applicable |
| Provenance | Where the assignment was observed and supporting evidence |

These are conceptual requirements, not final DDL or a settled list of SQL column
names. The internal object PK is not duplicated as an external identifier row.
Binary hash identity remains in the existing binary model; additional identifier
tables for other entities have not been agreed by this decision.

## Multiplicity, uniqueness and evidence

An entity may have several identifiers in the same or different namespaces. Do
not impose one identifier per role or assume values are globally unique. Indexing
should support namespace/value lookup, with issuer and scope included wherever
the scheme requires them. Exact uniqueness constraints depend on those semantics
and are deliberately deferred.

Repeated observations should support the same identifier assignment rather than
create duplicate assignments. Retain their separate source lineage and conflicting
evidence. The provenance relationship must accommodate multiple observations;
its physical structure and review lifecycle are not defined by this agreement.

An observed reference is not automatically a confirmed identifier of the containing
document. Distinguish an assigned identifier from a mention of another proceeding,
submission or document. Existing `reference_observation` records already preserve
mentions, candidate targets and interpretation; assess their integration before
adding a competing mechanism. Missing or ambiguous assignments remain explicit.

## Relationship to metadata and existing fields

Descriptive metadata can continue in source JSON with an adapter identity.
Identifier tables are a deliberate relational choice for collections requiring
typed parent links and operational lookup. They do not replace original source
payloads, imply acceptance of source descriptions, or resolve source-versus-reviewed
metadata design questions.

Existing fields such as `case_file.processo`, `case_file.idprocesso`,
`bucket.bucket_id`, `bucket.reference_number` and `document.document_procinfo`
remain unchanged. Their indexes, importer identity rules, search filters and
display/export contracts remain in force. No dual-write, fallback or precedence
policy is introduced merely by documenting a future collection model.

## Decisions required before implementation

* Namespace/issuer representation and scope rules, including role overlap.
* Assignment keys and scheme-specific normalization, without losing raw values.
* Provenance links, review/decision history and handling of repeated observations.
* How existing columns and reference observations relate to the collections,
  including migration and compatibility for current readers/writers.

Next step, only when requested: define the first entity's concrete fields and
constraints against representative identifiers and existing query dependencies.
This documentation step adds no tables, fields, data or runtime behavior.

Related contracts: [current source dictionary](17-citius-source-data-dictionary.md),
[system adaptation](18-citius-system-adaptation.md),
[reference observations](10-reference-observations-and-search-pilot.md), and
[court-record consultation](12-court-record-consultation-read-model.md).
