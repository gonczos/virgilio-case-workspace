# PostgreSQL Schema V2 Evolution Plan

Last updated: 2026-08-31

## Status

This document is the concrete phased plan for evolving the PostgreSQL application database in `virgilio-case-workspace`.

It is based on:

- [07-consolidated-architecture-reference.md](D:\attila\projects\virgilio-case-workspace\docs\architecture\07-consolidated-architecture-reference.md)
- the current PostgreSQL schema in `db/init/001-bootstrap.sql`
- the current portable-package importer in `app/import-package.mjs`
- the current import contract in `docs/architecture/02-import-contract.md`
- the currently imported Portuguese package and live PostgreSQL data

This document remains the implementation specification for later phases.
Phases A1, A2a, A2b, A2c, and B are now implemented in repository SQL and importer code, but the document still serves as the forward plan for later phases.

## Terminology

This repository now has two distinct data/schema flows.
They are related, but they are not the same process and should not be described interchangeably.

### 1. Legacy corpus extraction/import

This means:

- extracting data from the scraping-era database
- producing the portable case package
- importing that package into the PostgreSQL application database

This flow currently spans:

- the scraper-side SQL Server corpus
- the package builder in the scraper repository
- the portable package on disk under `data/imports/`
- the importer CLI in `app/import-package.mjs`

### 2. PostgreSQL schema migration/evolution

This means:

- changing the schema of the PostgreSQL application database itself

Examples:

- adding `case_workspace`
- adding `case_file.case_workspace_id`
- adding processing tables later

This is implemented through the repository's PostgreSQL migration files under `db/migrations/`.

### 3. PostgreSQL backfill

This means:

- populating newly introduced PostgreSQL structures from data already present in PostgreSQL

Examples:

- deriving `case_workspace` membership from the existing `case_file.parent_case_file_id` tree
- later deriving `case_workspace_document` from existing imported bucket/document links

Backfill is not the same as legacy import.
It operates inside the PostgreSQL application database.

### 4. Importer enhancement

This means:

- changing the portable-package importer so future legacy/package imports populate the evolved PostgreSQL schema correctly

Example:

- after adding `case_workspace_id`, enhancing the importer so future imports assign new or updated `case_file` rows to the correct workspace

Importer enhancement is not the same as PostgreSQL schema migration, though it may be required for ongoing compatibility after a schema evolution.

## Current Baseline In Repository Terms

Current PostgreSQL schema:

- `source_capture`
- `import_batch`
- `country`
- `court`
- `case_file`
- `bucket`
- `document`
- `bucket_document`
- `file_binary`
- `document_binary`
- `source_observation`
- `source_observation_link`
- `consultation_note`
- `document_issue`

Current legacy/package importer behavior:

1. validate package shape
2. create/find package `source_capture` when Phase B schema is present
3. upsert `import_batch`
4. attach `import_batch.source_capture_id` when Phase B schema is present
5. upsert `court`
6. upsert `case_file`
7. resolve `parent_case_file_id`
8. upsert `bucket`
9. upsert `document`
10. upsert `bucket_document`
11. upsert `file_binary`
12. upsert `document_binary`
13. create/update `source_observation` rows when Phase B schema is present
14. create/update `source_observation_link` rows when Phase B schema is present
15. commit one transaction

Current portable package shape:

- `package.json`
- `cases/*.jsonl`
- `files/sha256/...`
- `artifacts/*`
- `provenance/export-notes.json`

Current package/import provenance already retained:

- package manifest fields in `import_batch.package_metadata_json`
- capture-level package/export evidence in `source_capture.metadata_json`
- package-derived observation rows in `source_observation`
- canonical mapping provenance in `source_observation_link`
- on-disk `package.json`
- on-disk `provenance/export-notes.json`
- canonical source-facing fields on `case_file`, `bucket`, `document`
- canonical occurrence aggregates on `bucket_document.source_observation_count`
- canonical binary-link aggregates on `document_binary.source_observation_count`

Current PT corpus fact relevant to backfill:

- base case `13608/14.8T2SNT`
- descendants linked explicitly by `parent_case_file_id`
- `parent_case_file_id` already populated by the current importer

## Fixed Architectural Decisions

These are already fixed by the baseline architecture and should not be reopened during the first implementation slices unless the repository reveals a direct contradiction:

1. `case_workspace` is the application-level legal workspace.
2. `case_file` remains an official proceeding.
3. `parent_case_file_id` and `case_workspace_id` have different semantics.
4. `bucket` remains source-specific.
5. `file_binary.sha256` remains the cross-origin binary identity anchor.
6. provenance is additive through `document_origin`.
7. user organization uses `work_group` with M:N document membership.
8. source capture/observation is a planned explicit layer.
9. processing is format-agnostic at orchestration level.
10. `document_representation` and `document_segment` are the planned processing-derived content layer.
11. processing jobs use typed target FKs plus a one-target CHECK.
12. PDF is the first processor, not the universal model.

## Repository-Specific Implementation Decisions

These decisions follow from the actual repository as it exists now:

1. The first PostgreSQL schema work should preserve current importer upsert keys and add nullable FKs/new tables around them.
2. Workspace backfill for the current PT corpus should use the explicit `parent_case_file_id` tree already stored in `case_file`.
3. Imported canonical rows should remain query-compatible with current Directus consultation views during the first slice.
4. `document` should stay the shared logical document table for now; do not add another logical-document root above it in v2.
5. The current importer should remain a conservative CLI and be extended incrementally rather than rewritten into the worker.
6. The current package format should remain valid through Phase A and Phase C; Phase B may later add optional source-observation payloads.

## Open Decisions That Must Be Resolved Before Later Implementation

These are genuine pre-implementation decisions, not hypothetical future design debates:

1. Whether imported official occurrences should later receive explicit `document_origin` rows in addition to `bucket_document`, or remain represented only by canonical official structure plus later source-observation provenance.

## Deliberately Deferred Concerns

- container decomposition for attachments/archives
- entity/party/institution model
- event/timeline schema
- graph acceptance/review schema
- hybrid search implementation details
- vector storage details
- public deployment hardening
- managed runtime binary storage migration away from package-relative paths

## Identity Model Before Any `document` Change

The later `document` evolution must be driven by explicit identity semantics.

### Binary identity

Binary identity is:

- `file_binary.sha256`

Automatic deduplication:

- two binaries with the same SHA-256 are the same stored binary

Not deduplicated by binary identity alone:

- logical documents
- document occurrences
- provenance/origin

### Logical document identity

Logical document identity is:

- one `document` row representing one logical document as interpreted by the canonical layer

Current imported guarantee:

- imported documents deduplicate on
  `(source_system, document_procinfo, document_name, document_date, document_type, claimed_size_bytes)`

That imported guarantee should remain strict for imported-source rows.

### Source occurrence / origin identity

Source occurrence or origin identity is not the same as document identity.
It is the event/context in which a logical document is observed or introduced.

Examples:

- imported official bucket occurrence
- manual upload by user
- external letter received by email
- user-authored draft

This is the role of `document_origin`.

### When two occurrences should share one `document`

They should share one `document` when the system has enough reason to conclude they are the same logical document.

Examples:

- the same imported court document appearing in more than one bucket
- a manually received PDF later confirmed to be the same official filing already represented canonically

This sharing should be explicit and conservative.

### When identical SHA-256 binaries may still be distinct logical documents

Same binary does not force same logical document.

Examples:

- the same blank form reused for different intended legal acts
- the same attachment binary sent in two different external contexts and intentionally tracked as separate logical documents until proven equivalent

Therefore:

- `file_binary` deduplicates bytes
- `document` does not automatically collapse just because binaries match

### What is automatically deduplicated

Automatically deduplicated now:

- `file_binary` by `sha256`
- imported `document` by the current imported tuple
- `document_binary` by `(document_id, file_binary_id)`
- imported `bucket_document` by `(bucket_id, document_id)`

Not automatically deduplicated:

- future manual documents
- future document origins
- user organization
- processing outputs across processor versions

## Phase Dependencies Across The Whole Plan

1. Phase A must leave `document` strong enough for imported data so Phase B mappings remain trustworthy.
2. Phase A should add `case_workspace` before Phase B so source observations can already map into the correct application root if needed.
3. Phase B should precede heavy importer changes for Phase C/D so source provenance is not lost once processing starts.
4. Phase C should introduce a stable processing target model before Phase D writes real extraction outputs.
5. Phase D must seed backlog from existing `file_binary` and not depend on re-import.

## Phase A: Case Workspace Plus Document Provenance

### Goal

Broaden the application root from official proceedings to a real legal workspace while preserving all current official-import semantics.

### Phase A1: First PostgreSQL Schema-Evolution Slice

This is the first concrete implementation slice.
It is intentionally narrow.

Implement only:

- `case_workspace`
- nullable `case_file.case_workspace_id`
- PostgreSQL backfill of workspace membership from the existing explicit `parent_case_file_id` tree
- importer enhancement only if required for compatibility with this slice

Do not implement yet:

- `work_group`
- `document_origin`
- `document` uniqueness changes
- any Phase B structures
- any processing infrastructure

### Phase A1 Tables And Columns

#### New `case_workspace`

Purpose:

- top-level legal workspace across prospective, partial, and official phases

Columns:

- `id BIGSERIAL PRIMARY KEY`
- `workspace_code TEXT NOT NULL`
- `title TEXT NOT NULL`
- `description TEXT NULL`
- `lifecycle_status TEXT NOT NULL`
- `primary_country_id CHAR(2) NULL`
- `opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
- `closed_at TIMESTAMPTZ NULL`
- `created_by TEXT NULL`
- `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
- `updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`

Constraints:

- `UNIQUE (workspace_code)`
- `FOREIGN KEY (primary_country_id) REFERENCES casework.country(id)`
- `CHECK (lifecycle_status IN ('prospective','preparing','filed','active','closed','archived'))`

Indexes:

- `ix_case_workspace_primary_country_id`
- `ix_case_workspace_lifecycle_status`

Classification:

- application core

#### Change `case_file`

Add:

- `case_workspace_id BIGINT NULL`

Constraints:

- `FOREIGN KEY (case_workspace_id) REFERENCES casework.case_workspace(id)`

Indexes:

- `ix_case_file_case_workspace_id`

Existing constraints to preserve:

- `UNIQUE (source_system, processo)`
- `UNIQUE (source_system, idprocesso)`
- `parent_case_file_id` stays untouched

Classification:

- canonical imported source fact

### Phase A1 PostgreSQL Backfill Rules

Use the explicit stored `parent_case_file_id` graph.

Do not:

- infer relationships from process-number suffixes
- rewrite `parent_case_file_id`

Backfill rule:

1. identify every root `case_file` where `parent_case_file_id IS NULL`
2. walk all transitive descendants recursively
3. validate that:
   - there are no cycles
   - every reachable node resolves to exactly one root
4. create one `case_workspace` per root
5. assign that workspace to the root and all transitive descendants

Current expected PT outcome:

- one workspace containing `13608/14.8T2SNT` and all of its descendants

Important scope note:

- this root `case_file` to `case_workspace` creation rule is the bootstrap/backfill policy for the currently imported corpus
- it is not a universal future attachment rule
- later importer-enhancement logic may need to attach a newly imported root proceeding to an already existing workspace instead of creating a new one

### Phase A1 Importer Enhancement

Compatibility requirement:

- future legacy/package imports should not leave new `case_file` rows permanently outside any workspace

Minimum importer enhancement:

1. keep the existing legacy/package import flow unchanged in structure
2. after parent links are resolved, resolve/create `case_workspace`
3. assign `case_workspace_id` by the same root/descendant rule

This is an importer enhancement, not part of the PostgreSQL schema migration itself.

### Phase A1 Directus Impact

- existing consultation views should continue to function
- current case-centric UI remains usable
- no new Directus collections are required yet

### Phase A1 Validation Queries / Invariants

- every `case_file` has non-null `case_workspace_id`
- all rows in a parent/descendant family share the same `case_workspace_id`
- `parent_case_file_id` values are unchanged
- there are no cycles in the current `case_file` graph
- no `case_file` resolves to more than one root
- imported counts for `bucket`, `document`, `bucket_document`, `file_binary`, `document_binary` remain unchanged

### Phase A1 Rollback / Recovery

Low risk because changes are additive.

Recovery strategy:

- take DB backup before schema migration/backfill
- run schema migration and backfill in controlled steps
- if backfill validation fails, stop before importer enhancement rollout

### Phase A1 Completion Criteria

Phase A1 is complete when:

- `case_workspace` exists
- `case_file.case_workspace_id` exists and is populated
- grouping is derived from explicit `parent_case_file_id` roots/descendants
- graph validation passes
- importer remains able to import the current package
- existing canonical data and parent relationships are unchanged

### Proposed Phase A2a: Workspace Reference Plus Workspace-Document Closure

Purpose:

- make `case_workspace` useful beyond the current imported PT family
- keep workspace-level organization distinct from official court structure
- avoid introducing manual-document provenance before `document_origin` is ready
- create the dependency base that later `work_group` can safely build on

Recommended PostgreSQL schema-evolution scope:

- `case_workspace_reference`
- `case_workspace_document`
- minimal importer enhancement so future package imports keep `case_workspace_document` current

Deliberately defer from A2a:

- `work_group`
- `work_group_document`
- `document_origin`
- `consultation_note` workspace/group linkage
- `document` uniqueness transition

Why this is the smallest useful boundary:

- `case_workspace_reference` is the minimum structure that makes a workspace meaningful before or without an imported official `case_file`
- `case_workspace_document` is the minimum structure that makes a workspace document-bearing rather than only a parent of proceedings
- `work_group` should follow, not precede, `case_workspace_document`, because group membership should be constrained inside a workspace document universe rather than floating directly against `document`
- `document_origin` must remain separate so workspace association does not become a provenance table

#### New `case_workspace_reference`

Purpose:

- workspace-level legal/external reference registry
- supports known identifiers and labels before, after, or without a canonical `case_file`

Recommended semantic choice:

- Option A: avoid duplication

Reason:

- official proceeding identity already lives authoritatively on `case_file`
- duplicating `case_file.processo` into `case_workspace_reference` would create a second stored representation of the same canonical imported fact without adding new semantics
- `case_workspace_reference` is most useful precisely where no authoritative `case_file` representation exists yet, or where the reference is contextual rather than the canonical proceeding identifier
- this preserves the boundary that `case_file` is the canonical official-proceeding record and `case_workspace_reference` is additive workspace context

Option B was considered and rejected for A2a:

- adding `case_file_id` to support derived official-case-number rows would avoid an unlinked duplicate, but it would still create redundant storage of an authoritative canonical fact
- it would also introduce synchronization responsibility for little immediate gain
- if a later repository need emerges for explicitly denormalized workspace-level official references, that can still be added then with a deliberate derivation model

This table means:

- a reference the application associates with the broader workspace

This table does not mean:

- an official proceeding row
- source-observation evidence
- document provenance
- a copy of official proceeding identity already structurally represented by `case_file`

Columns:

- `id BIGSERIAL PRIMARY KEY`
- `case_workspace_id BIGINT NOT NULL`
- `reference_kind TEXT NOT NULL`
- `country_id CHAR(2) NULL`
- `court_name TEXT NULL`
- `reference_value TEXT NOT NULL`
- `reference_label TEXT NULL`
- `is_primary BOOLEAN NOT NULL DEFAULT FALSE`
- `valid_from DATE NULL`
- `valid_to DATE NULL`
- `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
- `updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`

Constraints:

- `FOREIGN KEY (case_workspace_id) REFERENCES casework.case_workspace(id) ON DELETE CASCADE`
- `FOREIGN KEY (country_id) REFERENCES casework.country(id)`
- `CHECK (reference_kind IN ('external_reference', 'internal_reference', 'prospective_reference'))`
- `CHECK (BTRIM(reference_value) <> '')`
- `CHECK (valid_to IS NULL OR valid_from IS NULL OR valid_to >= valid_from)`

Indexes:

- `ix_case_workspace_reference_case_workspace_id`
- `ix_case_workspace_reference_country_id`
- `ix_case_workspace_reference_reference_kind`
- unique expression index on workspace/reference identity:
  - `(case_workspace_id, reference_kind, COALESCE(country_id, ''), COALESCE(court_name, ''), reference_value)`
- partial unique index for one primary reference per workspace:
  - `(case_workspace_id) WHERE is_primary`

Backfill recommendation:

- no automatic backfill for the current imported Portuguese workspace
- the authoritative official proceeding numbers remain represented by `case_file.processo`
- `case_workspace_reference` starts empty unless there are workspace-level references not already structurally represented by attached `case_file` rows

Examples that do belong here:

- a French reference known before a structured official importer exists
- a pre-filing/prospective matter reference
- a user-assigned internal reference
- a contextual external reference not equivalent to a canonical `case_file` identifier

Implication for the current PT corpus:

- the current workspace can be valid and useful with zero `case_workspace_reference` rows
- workspace identity continues to come from `case_workspace`
- official proceeding identity continues to come from the attached `case_file` rows

#### New `case_workspace_document`

Purpose:

- workspace-level membership of logical documents
- defines which canonical `document` rows belong to a workspace regardless of which official bucket exposed them

This table means:

- the workspace currently includes this logical document

This table does not mean:

- why the document entered the application
- how the document was observed at the source
- official bucket occurrence

Those later concerns belong to:

- `document_origin`
- `source_observation`
- `bucket_document`

Columns:

- `id BIGSERIAL PRIMARY KEY`
- `case_workspace_id BIGINT NOT NULL`
- `document_id BIGINT NOT NULL`
- `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
- `updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`

Constraints:

- `FOREIGN KEY (case_workspace_id) REFERENCES casework.case_workspace(id) ON DELETE CASCADE`
- `FOREIGN KEY (document_id) REFERENCES casework.document(id) ON DELETE CASCADE`
- `UNIQUE (case_workspace_id, document_id)`

Indexes:

- `ix_case_workspace_document_document_id`

Backfill recommendation:

- automatically populate from the canonical imported path:
  - `case_workspace -> case_file -> bucket -> bucket_document -> document`
- insert distinct pairs only
- use `ON CONFLICT (case_workspace_id, document_id) DO NOTHING`

This backfill is a pure PostgreSQL backfill.
It does not alter `bucket_document`, `document`, or provenance semantics.

Importer enhancement recommendation:

- after `bucket_document` import is complete and workspaces are assigned, insert distinct workspace/document pairs for all imported `bucket_document` rows whose `case_file.case_workspace_id` is not null
- do not infer anything from package artifacts or source-observation data in this slice
- treat this as insert-safe maintenance for the normal importer path where `case_file.case_workspace_id` is stable or only grows through fresh imports
- do not treat it as a full reconciliation mechanism for arbitrary later workspace reassignment

If `case_file.case_workspace_id` is later reassigned:

- existing `case_workspace_document` rows would need an explicit reconciliation/backfill routine
- insert-only importer logic would not remove stale workspace/document membership rows from the old workspace
- that reassignment case should therefore be considered outside normal A2a importer behavior unless a dedicated reconciliation step is added

Why no `association_kind` in A2a:

- the row should remain a simple workspace-membership closure
- a single document may later have multiple reasons for being known in the same workspace
- encoding one reason here would either become misleading or force provenance semantics into the wrong table
- later provenance belongs in `document_origin`

#### Why `work_group` And `work_group_document` Stay Deferred

They are intentionally not part of A2a.

Reasons:

- they are user-organization structures, not a prerequisite for establishing workspace identity or workspace document closure
- once `case_workspace_document` exists, later `work_group_document` can safely point to workspace-scoped document membership rather than free-floating `document` rows
- adding `work_group` first would create UI structure without solving the more fundamental workspace/document boundary
- the repository does not yet have a workspace-first Directus model, so adding grouping now would add schema without immediate stable UI semantics

#### Manual/External Document Path After A2a

A2a does not yet complete the manual-document path.

After A2a, the system will support:

- a workspace with references but no `case_file`
- official imported documents visible at workspace level
- later attachment of official `case_file` rows to an existing workspace without changing workspace identity

What still remains missing for a principled manual/external document path:

- additive `document_origin`
- a resolved `document` identity/uniqueness transition for non-imported documents
- importer-agnostic manual upload/write path into `document` plus `file_binary`
- workspace/group note linkage if notes must exist before any `case_file`

This means:

- a partially known French proceeding can be represented as a workspace plus references after A2a
- a prospective proceeding can be represented as a workspace plus references after A2a
- but manually uploaded letters, drafts, and user-authored work product should wait for the next provenance/document slice rather than being forced through imported-document assumptions

#### Directus And Consultation Impact

Existing consultation views should remain unchanged.

No existing view depends on the new A2a tables.

Immediate utility after A2a:

- PostgreSQL can answer workspace-level document inventory
- PostgreSQL can answer workspace-level reference inventory
- the current PT workspace becomes queryable as one workspace-level document set rather than only as five separate proceedings

Directus changes are not required for the schema slice itself.
If a small UI follow-up is wanted later, the lowest-risk addition would be:

- expose `case_workspace_reference`
- add a read-oriented workspace-document view

#### Validation Criteria For A2a

Before moving past A2a, validate:

- every imported `case_file` with a `case_workspace_id` contributes its canonical documents into exactly one matching `case_workspace_document` set
- no `case_workspace_document` row exists without a valid workspace and document
- `case_workspace_reference` remains empty for the current PT workspace unless non-duplicative workspace-level references are intentionally added
- existing `case_file`, `bucket`, `bucket_document`, `document`, and `document_binary` counts remain unchanged
- existing consultation views still return the same results unless new optional workspace views are explicitly added

### Proposed Phase A2b: Manual Documents And Additive Document Provenance

Purpose:

- allow the workspace to contain manually received documents
- allow manual uploads and user-authored documents without weakening imported-document guarantees
- preserve additive provenance without collapsing it into `case_workspace_document`
- keep official imported occurrence semantics in `bucket_document`

Recommended smallest implementation slice:

- evolve `document` identity rules so non-imported logical documents are possible
- add `document_origin`
- add one narrow `document_binary` integrity rule so multiple binaries can exist but only one primary binary is current

Deliberately defer from A2b:

- `work_group`
- `work_group_document`
- workspace/group expansion of `consultation_note`
- explicit document-merge tooling
- source-capture/source-observation provenance
- processing/revision lineage beyond basic logical-document-to-binary linking

Why this is the smallest safe slice:

- A2a already made documents visible at workspace level through `case_workspace_document`
- the next missing capability is not grouping but the ability to create non-imported documents and explain how they entered the workspace
- `document_origin` is necessary before any manual-document workflow, because otherwise manual documents would have workspace membership but no provenance
- `work_group` becomes more coherent after manual/user documents exist in the shared workspace document pool

#### `document` Identity Transition

Current repository constraint:

- `document.source_system` is `NOT NULL`
- imported identity is enforced globally by
  `(source_system, document_procinfo, document_name, document_date, document_type, claimed_size_bytes)`

This works for imported court material but blocks:

- documents with no source system
- user-authored drafts
- incomplete manually received material
- workspace-native documents that later gain additional origins

Recommended A2b change:

- keep one shared `document` table
- add `document_identity_class TEXT NOT NULL DEFAULT 'imported_source_keyed'`
- relax `document.source_system` to nullable
- replace the current global unique index with a partial imported-only unique index

Recommended `document_identity_class` values:

- `imported_source_keyed`
- `workspace_native`

Why identity class instead of provenance kind:

- provenance belongs in `document_origin`, not on `document`
- the same logical document may later have both manual and imported origins
- what needs to differ on `document` is the identity rule, not the historical path by which it became known

Proposed `document` constraints:

- `CHECK (document_identity_class IN ('imported_source_keyed', 'workspace_native'))`
- `CHECK (document_identity_class <> 'imported_source_keyed' OR source_system IS NOT NULL)`

Imported uniqueness rule to preserve:

- drop `ux_document_source_identity`
- create partial unique index on
  `(source_system, document_procinfo, document_name, document_date, document_type, claimed_size_bytes)`
  `WHERE document_identity_class = 'imported_source_keyed'`

Important PostgreSQL behavior:

- the current importer uses
  `ON CONFLICT (source_system, document_procinfo, document_name, document_date, document_type, claimed_size_bytes) DO UPDATE`
- once the global index becomes a partial unique index, that conflict target is no longer sufficient for PostgreSQL index inference by itself
- for A2b, importer compatibility therefore does require a small change

Smallest importer compatibility strategy:

- keep pre-A2b compatibility by detecting whether `document.document_identity_class` exists
- if it does not exist, keep the current document upsert
- if it does exist:
  - insert imported rows with `document_identity_class = 'imported_source_keyed'`
  - use
    `ON CONFLICT (source_system, document_procinfo, document_name, document_date, document_type, claimed_size_bytes) WHERE document_identity_class = 'imported_source_keyed' DO UPDATE`
  - keep the package contract unchanged

This is the minimum A2b importer enhancement required so current PT package reruns continue to work after the schema evolution.

Backfill for existing imported corpus:

- set all existing rows to `document_identity_class = 'imported_source_keyed'`
- preserve all existing source-facing values
- preserve the imported uniqueness guarantee exactly for those rows

Actual current nullability and corpus behavior:

- current schema nullability:
  - `source_system`: `NOT NULL`
  - `document_procinfo`: nullable
  - `document_name`: nullable
  - `document_date`: nullable
  - `document_type`: nullable
  - `claimed_size_bytes`: nullable
- current imported corpus state in PostgreSQL:
  - `source_system NULLs = 0`
  - `document_procinfo NULLs = 0`
  - `document_name NULLs = 0`
  - `document_date NULLs = 0`
  - `document_type NULLs = 0`
  - `claimed_size_bytes NULLs = 0`
  - duplicate imported identity tuples under current values = 0

Implication:

- the current imported uniqueness claim is strict for the current corpus and current observed package behavior, because every imported identity column is populated
- the claim should still be qualified at the schema level, because ordinary PostgreSQL unique indexes treat `NULL` values as distinct

Recommendation for A2b:

- keep ordinary partial unique index behavior
- do not introduce `NULLS NOT DISTINCT` or expression-normalized identity in A2b
- explicitly document that imported uniqueness remains strict for the current observed imported packages, while future null-bearing imported packages would require a deliberate follow-up decision if they appear

Non-imported documents after A2b:

- use `document_identity_class = 'workspace_native'`
- may have `source_system = NULL`
- may have sparse metadata
- are not automatically deduplicated by metadata alone

Repository-specific note:

- `canonical_confidence` remains an imported/canonical confidence field
- it is required for `document_identity_class = 'imported_source_keyed'`
- it may be `NULL` for `document_identity_class = 'workspace_native'`
- a broader terminology cleanup is not required to start A2b

#### New `document_origin`

Purpose:

- additive provenance describing how a logical document became known in a workspace/application context

This table means:

- an origin/event/context by which one workspace-level logical document entered or became known in that workspace

This table does not mean:

- official bucket occurrence
- source-observation evidence
- workspace membership itself

Those remain:

- `bucket_document`
- future `source_observation`
- `case_workspace_document`

Recommended scoping:

- `document_origin` should be workspace-scoped
- implement that by referencing `case_workspace_document`

Why:

- the same logical document may legitimately belong to multiple workspaces
- each workspace may know that document through different origins
- tying origin to `case_workspace_document` enforces that origin is about a specific workspace/document membership, not just a global document row

Recommended columns:

- `id BIGSERIAL PRIMARY KEY`
- `case_workspace_document_id BIGINT NOT NULL`
- `origin_kind TEXT NOT NULL`
- `origin_reference TEXT NULL`
- `origin_label TEXT NULL`
- `origin_at TIMESTAMPTZ NULL`
- `actor_name TEXT NULL`
- `created_by TEXT NULL`
- `note_text TEXT NULL`
- `metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb`
- `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
- `updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`

Recommended `origin_kind` values:

- `manual_received`
- `manual_uploaded`
- `user_authored`

Recommended constraints:

- `FOREIGN KEY (case_workspace_document_id) REFERENCES casework.case_workspace_document(id) ON DELETE CASCADE`
- `CHECK (origin_kind IN ('manual_received', 'manual_uploaded', 'user_authored'))`

Recommended indexes:

- `ix_document_origin_case_workspace_document_id`
- `ix_document_origin_origin_kind`
- `ix_document_origin_origin_at`

Why imported official origin is deferred from A2b:

- `bucket_document` already remains the authoritative canonical official occurrence model
- adding `document_origin(imported_official)` in A2b would require cross-table integrity proving that the referenced official occurrence belongs to the same logical document and workspace membership
- the straightforward FK shape does not provide that guarantee
- introducing it now would either rely on application-only validation or force a larger composite-key redesign than A2b needs

Therefore:

- A2b origin kinds are limited to manual/user paths only
- imported official occurrence remains represented only by
  `case_file -> bucket -> bucket_document -> document`
- a future convergence/reconciliation slice may add an explicit official-origin representation if a real need appears and a clean PostgreSQL-enforced model is identified

#### `document_binary` Rule For A2b

The existing table is already the correct place for logical-document-to-binary association.

Small A2b refinement recommended:

- add a partial unique index on `(document_id) WHERE is_primary`

Why:

- a manual or user-authored document may accumulate multiple binaries over time
- one logical document should have at most one currently primary binary
- this supports cases such as Markdown draft plus later PDF export without adding a full revision system yet

What A2b deliberately does not solve here:

- explicit revision numbering
- semantic distinction between source, export, and attachment binaries
- merge history across documents

Preflight validation required before migration:

- run:
  `SELECT document_id FROM casework.document_binary WHERE is_primary GROUP BY document_id HAVING COUNT(*) > 1`
- current corpus result: `0` rows

Primary-binary invariant:

- zero primary binaries is valid
- one primary binary is valid
- more than one primary binary for the same logical document is invalid

Those can be added later if the repository proves a real need.

#### Manual Document Transaction Path

Smallest repository-safe transactional path:

1. require an existing `case_workspace`
2. decide whether this should attach to an existing logical `document` or create a new one
3. if creating new:
   - insert `document`
   - `document_identity_class = 'workspace_native'`
   - set available metadata such as `document_name`, `document_date`, `document_type`
4. ensure workspace membership:
   - insert into `case_workspace_document`
   - `ON CONFLICT (case_workspace_id, document_id) DO NOTHING`
5. if a binary exists:
   - compute SHA-256
   - upsert/find `file_binary`
   - insert `document_binary`
   - if this is the current preferred binary, set `is_primary = TRUE` and clear any prior primary in the same transaction
6. insert `document_origin`
   - `origin_kind = 'manual_received'`, `manual_uploaded`, or `user_authored`
   - include `origin_at`, `actor_name`, `origin_reference`, and `metadata_json` as available
7. commit one transaction

Required fields in practice:

- `case_workspace_id`
- either an existing `document_id` or enough metadata to create a new logical document
- one `document_origin.origin_kind`

Optional fields:

- binary payload / SHA-256
- `document_name`
- `document_date`
- `document_type`
- origin timestamp/reference/notes

Dedupe rule:

- never collapse logical documents by SHA-256 alone
- reuse existing `file_binary` when the same SHA-256 already exists
- reuse existing `document` only by explicit decision or strong matching logic outside the bare storage transaction

If the binary already exists:

- reuse the existing `file_binary`
- still create or reuse the intended logical `document`
- still create `case_workspace_document`
- still create a new `document_origin`

This preserves the invariant that binary dedupe does not force logical-document dedupe.

#### Convergence With Later Imported Official Material

Scenario:

- a manual workspace document later also appears in imported official court material

Repository-safe convergence rule:

- do not merge silently on binary match alone
- do not create a second logical document if the application already has enough evidence, at import/attach time, to link the official occurrence to the existing logical document
- if enough evidence is not available and two logical documents are created, require an explicit later reconciliation step

How provenance remains intact:

- the earlier manual/user `document_origin` rows stay as historical facts
- the later official occurrence stays represented by `bucket_document`

What remains deferred:

- a full document-merge procedure for the case where two logical documents already exist and are later proven equivalent
- any explicit `document_origin` representation of official imported occurrence

That merge/reconciliation workflow should be explicit, audited, and separate from the first A2b schema slice.

#### User-Authored Documents

Recommendation:

- use the same `document` table

Why:

- user-authored drafts are still logical documents in the same workspace corpus
- they may later gain binaries, exports, official filing status, and cross-links to imported material
- a separate draft-document system would undermine later convergence

Minimum A2b semantics:

- a draft may exist with no binary yet
- that means:
  - `document`
  - `case_workspace_document`
  - `document_origin(user_authored)`
- a draft stored as Markdown/text can create a `file_binary` and `document_binary`
- a later generated PDF can create another `file_binary` and another `document_binary`
- one binary can be primary at a time

Revision policy for A2b:

- do not create a new `document` row for every revision by default
- one logical draft may have multiple linked binaries over time
- full revision lineage/version control is deliberately deferred

#### `work_group` Recommendation

Recommendation:

- defer `work_group` and `work_group_document` to a small A2c immediately after A2b

Reason:

- A2b can solve manual documents without any user-organization schema
- grouping becomes cleaner once workspace-native documents and their origins exist
- keeping A2b focused reduces risk in the `document` identity transition

When implemented, `work_group_document` should not point directly to `document`.

Preferred direction:

- `work_group_document` should point to `case_workspace_document`

Reason:

- a work group must not include a document outside its workspace
- `case_workspace_document` is already the workspace-scoped document membership table

Preferred integrity approach for A2c:

- make workspace consistency database-enforced, even if that requires composite keys or paired FKs, rather than relying only on application discipline

#### `consultation_note` Recommendation

Recommendation:

- defer workspace/group linkage on `consultation_note` to A2c

Reason:

- note linkage is not required to make manual documents and origins possible
- the current note table remains usable for existing official-case consultation
- once `work_group` direction is settled, note targeting can be expanded coherently rather than incrementally patched twice

If a small earlier note follow-up becomes necessary, the smallest addition would be:

- nullable `case_workspace_id` on `consultation_note`

But that is not required to start A2b.

#### Scenario Check

##### A. Current Portuguese imported PDF

- remains authoritative through `case_file -> bucket -> bucket_document -> document`
- no A2b `document_origin` backfill is required
- imported uniqueness remains preserved through `document_identity_class = 'imported_source_keyed'`

##### B. French manually received letter

- create a workspace
- create or choose a logical `document`
- optionally link a `file_binary`
- create `case_workspace_document`
- create `document_origin(manual_received)`

No `case_file` is required.

##### C. Same French letter later officially imported

- if enough evidence exists at import/attach time, reuse the same logical `document`
- add official canonical occurrence via `bucket_document`
- earlier manual origin remains intact

If enough evidence does not exist and two logical documents are created, explicit later reconciliation is required.

##### D. User-authored hearing-preparation draft

- create `document` with `document_identity_class = 'workspace_native'`
- create `case_workspace_document`
- create `document_origin(user_authored)`
- binary may be absent initially
- later Markdown and PDF binaries can both attach through `document_binary`

##### E. Shared binary

- one `file_binary` row by SHA-256
- two distinct `document` rows may still reference it through two `document_binary` rows
- each logical document can have its own workspace memberships and origins

##### F. Multi-workspace relevance

- one logical `document` may have two `case_workspace_document` rows
- provenance should then use multiple `document_origin` rows, one per workspace/document membership as applicable

#### PostgreSQL Backfill And Importer Implications

PostgreSQL schema evolution in A2b should include:

- `document.document_identity_class`
- `document.source_system` nullable
- partial imported-only unique index
- `document_origin`
- partial unique primary-binary index on `document_binary`

PostgreSQL backfill in A2b should include only:

- set existing imported `document` rows to `document_identity_class = 'imported_source_keyed'`

Do not backfill:

- manual/user origins
- imported official `document_origin` rows for the current PT corpus

Importer enhancement for A2b:

- required for the current settled PT package import path because imported document upsert must target the new imported-only partial unique index correctly
- keep that enhancement minimal and schema-detected so pre-A2b schema compatibility remains intact
- do not add non-imported/workspace-native document import behavior to the portable package importer
- any later importer enhancement for convergence between imported official material and existing workspace-native documents should be explicit and conservative

#### Validation Criteria For A2b

Before moving past A2b, validate:

- all existing imported documents are marked `document_identity_class = 'imported_source_keyed'`
- imported uniqueness is preserved by the new partial unique index
- existing imported counts remain unchanged
- new workspace-native `document` rows can be inserted with `source_system = NULL`
- one logical document can exist with zero binaries
- one logical document can have multiple binaries but at most one primary binary
- one binary can be shared by multiple logical documents
- one logical document can have multiple `document_origin` rows
- one logical document can belong to multiple workspaces through multiple `case_workspace_document` rows
- manual document transaction path succeeds atomically
- current importer reruns still succeed after the A2b schema evolution because the importer uses the imported-only conflict predicate when `document_identity_class` exists

### Proposed Phase A2c: Work Groups And Workspace-Level Notes

Purpose:

- introduce user organization inside a workspace without confusing it with official legal structure
- add workspace-aware notes that can exist before or without an official `case_file`
- preserve a strict boundary between organization, provenance, and official court structure

Recommended smallest implementation slice:

- `work_group`
- `work_group_document`
- evolve `consultation_note` so new notes always belong to a `case_workspace`
- move document-scoped note targeting from raw `document_id` to `case_workspace_document_id`

Deliberately defer from A2c:

- nested or parent work groups
- tags / ontology / topic systems
- task management
- calendar/deadline features
- bucket-level note targeting
- binary-level note targeting redesign
- generic polymorphic annotation framework

Why this is the smallest safe slice:

- `case_workspace`, `case_workspace_document`, and `document_origin` already exist and define the canonical/provenance baseline
- the next missing capability is organization and annotation in the workspace layer
- work groups should organize workspace documents, not redefine documents or their provenance
- notes should gain required workspace context before additional workflow features are layered on top

#### New `work_group`

Meaning:

- user-created organizational grouping inside exactly one `case_workspace`

This table does not mean:

- official court structure
- provenance
- source-observation evidence

Recommended columns:

- `id BIGSERIAL PRIMARY KEY`
- `case_workspace_id BIGINT NOT NULL`
- `title TEXT NOT NULL`
- `description TEXT NULL`
- `archived_at TIMESTAMPTZ NULL`
- `created_by TEXT NULL`
- `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
- `updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`

Recommended constraints:

- `FOREIGN KEY (case_workspace_id) REFERENCES casework.case_workspace(id) ON DELETE CASCADE`
- `CHECK (BTRIM(title) <> '')`
- `UNIQUE (id, case_workspace_id)`

Recommended indexes:

- `ix_work_group_case_workspace_id` on `(case_workspace_id)`
- `ix_work_group_archived_at` on `(archived_at)`

What is intentionally omitted in A2c:

- `group_kind`
- `status`
- `sort_order`
- parent/nesting columns

Reason:

- none of those are required to satisfy the current repository scenarios
- `archived_at` is enough to support soft-retirement without inventing a status taxonomy
- ordering and hierarchy can be added later if real usage demonstrates a need

Uniqueness semantics:

- `id` is the identity
- `title` is user-facing, not canonical identity
- two groups in the same workspace may have the same title if the user intentionally creates them

Lifecycle semantics:

- work groups should normally be archived, not physically deleted
- physical deletion may still be allowed, but note FKs should make accidental loss of human notes unlikely

#### New `work_group_document`

Meaning:

- membership of a workspace-scoped logical document in a user work group

This table does not mean:

- provenance
- official occurrence
- document identity

Recommended shape:

- `id BIGSERIAL PRIMARY KEY`
- `case_workspace_id BIGINT NOT NULL`
- `work_group_id BIGINT NOT NULL`
- `case_workspace_document_id BIGINT NOT NULL`
- `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`

Recommended constraints:

- `FOREIGN KEY (case_workspace_id) REFERENCES casework.case_workspace(id) ON DELETE CASCADE`
- `FOREIGN KEY (work_group_id, case_workspace_id) REFERENCES casework.work_group(id, case_workspace_id) ON DELETE CASCADE`
- `FOREIGN KEY (case_workspace_document_id, case_workspace_id) REFERENCES casework.case_workspace_document(id, case_workspace_id) ON DELETE CASCADE`
- `UNIQUE (work_group_id, case_workspace_document_id)`

Recommended indexes:

- `ix_work_group_document_case_workspace_id` on `(case_workspace_id)`
- `ix_work_group_document_case_workspace_document_id` on `(case_workspace_document_id)`

Recommended supporting parent constraints:

- `UNIQUE (id, case_workspace_id)` on `casework.work_group`
- `UNIQUE (id, case_workspace_id)` on `casework.case_workspace_document`

Why the redundant `case_workspace_id` is recommended:

- independent FKs on `work_group_id` and `case_workspace_document_id` do not prove same-workspace membership
- the redundant workspace key allows PostgreSQL to enforce that the group and workspace-document pair both belong to the same workspace
- this is a small, explicit integrity cost for a strong correctness gain

Why application-only validation is not recommended:

- the cross-workspace failure mode is real
- the required redundancy is modest
- this is precisely the kind of invariant PostgreSQL should enforce directly

Minimal membership metadata:

- `created_at` only

Deliberately omitted in A2c:

- `added_by`
- membership notes
- membership sort order

Reason:

- these are helpful but not required to solve the current organization problem
- they can be added later without changing the core relational shape

#### `consultation_note` Evolution

Current repository state:

- table exists
- columns are:
  - `case_file_id`
  - `bucket_id`
  - `document_id`
  - `file_binary_id`
  - `note_kind`
  - `note_text`
  - `author_name`
- current live row count: `0`

Recommended A2c evolution:

- add `case_workspace_id BIGINT NOT NULL`
- add `work_group_id BIGINT NULL`
- add `case_workspace_document_id BIGINT NULL`
- keep `case_file_id BIGINT NULL`
- drop legacy `bucket_id`, `document_id`, and `file_binary_id`
- do not add generic polymorphic targeting

Smallest recommended target model:

- `case_workspace_id` is the required context
- optional `work_group_id` is organizational context
- optional `case_file_id` is an official-proceeding subject
- optional `case_workspace_document_id` is a workspace-scoped document subject

Recommended A2c omission:

- do not retain `bucket_id` in the evolved target model
- do not retain `file_binary_id` in the evolved target model

Reason:

- neither is required by the current concrete scenarios
- `file_binary_id` is not naturally workspace-scoped because binaries may be shared
- bucket-specific notes can be deferred until there is a concrete workflow need and a clean workspace-consistent model
- current repository search shows no runtime dependency that requires these legacy note target columns to survive one transitional migration

#### Note Targeting Semantics

Recommended model:

- context plus optional subject

Required context:

- every new note belongs to exactly one `case_workspace`

Optional organizational context:

- `work_group_id`

Optional subject:

- `case_file_id`
- or `case_workspace_document_id`
- or neither

Recommended constraint:

- `num_nonnulls(case_file_id, case_workspace_document_id) <= 1`

This means:

- workspace strategy note:
  - workspace only
- work-group note:
  - workspace + work group
- official-case note:
  - workspace + case file
- document note:
  - workspace + case workspace document
- group-specific document note:
  - workspace + work group + case workspace document
- group-specific case note:
  - workspace + work group + case file

Why not exactly one target:

- a work-group note naturally has workspace context plus group context
- a document note may also belong to a work group
- requiring exactly one target FK would force artificial duplication of note meaning

Why not allow both `case_file_id` and `case_workspace_document_id` in A2c:

- that would invite a more complex “case-specific meaning of a document” model
- PostgreSQL cannot cheaply enforce that the selected document is official/relevant to the selected case file without a more elaborate cross-table design
- that scenario can be added later if it becomes a demonstrated need

#### Note Workspace Integrity

Recommended constraints:

- `FOREIGN KEY (case_workspace_id) REFERENCES casework.case_workspace(id)`
- `FOREIGN KEY (work_group_id, case_workspace_id) REFERENCES casework.work_group(id, case_workspace_id)`
- `FOREIGN KEY (case_file_id, case_workspace_id) REFERENCES casework.case_file(id, case_workspace_id)`
- `FOREIGN KEY (case_workspace_document_id, case_workspace_id) REFERENCES casework.case_workspace_document(id, case_workspace_id)`
- `CHECK (num_nonnulls(case_file_id, case_workspace_document_id) <= 1)`

Recommended indexes:

- `ix_consultation_note_case_workspace_id` on `(case_workspace_id)`
- `ix_consultation_note_work_group_id` on `(work_group_id)`
- `ix_consultation_note_case_file_id` on `(case_file_id)`
- `ix_consultation_note_case_workspace_document_id` on `(case_workspace_document_id)`

Recommended supporting parent constraints:

- `UNIQUE (id, case_workspace_id)` on `casework.case_file`
- `UNIQUE (id, case_workspace_id)` on `casework.case_workspace_document`
- `UNIQUE (id, case_workspace_id)` on `casework.work_group`

Result:

- a note cannot point to a `case_file` from another workspace
- a note cannot point to a `work_group` from another workspace
- a note cannot point to a workspace-document membership from another workspace

Document note targeting recommendation:

- target `case_workspace_document`, not raw `document`

Reason:

- `document` alone is not workspace-scoped
- the same logical document may belong to multiple workspaces
- `case_workspace_document` preserves the intended note context naturally

#### Relationship Between Work Groups And Notes

Recommendation:

- work-group notes should directly reference `work_group`

Reason:

- the group itself is the organizational object
- storing group meaning in note metadata would weaken integrity and make querying clumsier

Deletion/archive behavior:

- work groups should normally be archived via `archived_at`
- `work_group_document` may cascade on physical group deletion
- `consultation_note.work_group_id` should not cascade-delete notes
- preferred FK behavior for `consultation_note.work_group_id` is `ON DELETE RESTRICT` / `NO ACTION`
- `consultation_note.case_file_id` and `consultation_note.case_workspace_document_id` should also default to `ON DELETE RESTRICT` / `NO ACTION` in A2c
- `consultation_note.case_workspace_id` should also use `ON DELETE RESTRICT` / `NO ACTION`; notes must not be cascade-deleted at workspace deletion time

This encourages archiving rather than deletion and avoids silent loss of human notes.

#### Relationship Between Work Groups And Provenance

This must remain explicit:

- `document_origin` = how a document became known in a workspace
- `work_group_document` = how a user organizes that workspace document

Example:

- a French letter may have `document_origin = manual_received`
- and also belong to:
  - “French proceedings”
  - “Hearing preparation”
  - “Evidence”
  - “Documents to translate”

Those group memberships are organization, not provenance.

#### Scenario Check

##### A. Portuguese hearing preparation

- create `work_group = 'Hearing 3 November'` under the PT workspace
- add multiple `case_workspace_document` memberships to it
- those documents may come from different official `case_file` / `bucket` paths
- no canonical official structure changes

##### B. French prospective workspace

- create workspace with no `case_file`
- create `work_group = 'Initial French material'`
- create workspace-native documents and origins
- add workspace notes and work-group notes

No official proceeding is required.

##### C. Same document in several groups

- one `case_workspace_document`
- many `work_group_document` rows
- still one logical `document`
- still one provenance history per workspace/document membership

##### D. Cross-workspace integrity failure

Example attempted insert:

- `work_group_id = group from workspace A`
- `case_workspace_document_id = membership from workspace B`
- `case_workspace_id = workspace A`

Why PostgreSQL rejects it:

- `(work_group_id, case_workspace_id)` must match `work_group(id, case_workspace_id)`
- `(case_workspace_document_id, case_workspace_id)` must match `case_workspace_document(id, case_workspace_id)`
- the workspace key cannot satisfy both parents if they belong to different workspaces

##### E. Workspace-level strategy note

- `case_workspace_id` set
- `work_group_id` null
- `case_file_id` null
- `case_workspace_document_id` null

Valid.

##### F. Work-group note

- `case_workspace_id` set
- `work_group_id` set
- `case_file_id` null
- `case_workspace_document_id` null

Valid.

##### G. Document-specific note

- target `case_workspace_document_id`, not raw `document_id`
- optional `work_group_id` may also be set

This preserves workspace integrity naturally.

##### H. Existing consultation notes

- current live row count is `0`
- therefore no destructive data rewrite is required for the current repository state
- if future non-empty rows appear before A2c lands, deterministic workspace derivation should use:
  - `case_file.case_workspace_id` when `case_file_id` is present
  - otherwise `case_workspace_document.case_workspace_id` when document-targeted rows have already been migrated

#### Directus Implications

This relational shape should be straightforward for Directus to expose:

- workspace page:
  - workspace metadata
  - work-group list
  - workspace notes
- work-group page:
  - group metadata
  - group notes
  - group document memberships via `work_group_document`
- document note view:
  - note joined through `case_workspace_document`

The model should not be distorted for Directus.
Directus can consume the explicit relations once they exist.

#### PostgreSQL Backfill And Migration Requirements

Current live data:

- `consultation_note` row count = `0`
- current target combinations present = none
- ambiguous workspace resolution count = `0`

Repository dependency check for legacy note target columns:

- no SQL views reference `consultation_note.bucket_id`, `consultation_note.document_id`, or `consultation_note.file_binary_id`
- no app importer/runtime code references those note target columns
- no Directus-specific runtime SQL/config in the repository depends on those note target columns
- the only concrete repository references are the current `consultation_note` table definition and the bootstrap index `ix_consultation_note_document_id`

Recommended A2c backfill for the current repository:

- no `work_group` backfill
- no `work_group_document` backfill
- no `consultation_note` data backfill required because there are no live rows
- drop the legacy `consultation_note.bucket_id`, `document_id`, and `file_binary_id` columns directly in A2c rather than carrying them as deprecated compatibility columns

Deterministic migration pattern to preserve if notes become non-empty before implementation:

1. add `case_workspace_id` nullable
2. backfill from `case_file.case_workspace_id` for case-targeted notes
3. migrate document-targeted notes to `case_workspace_document_id`
4. validate no ambiguous or unresolved workspace assignments remain
5. set `case_workspace_id` to `NOT NULL`
6. add composite workspace-integrity FKs

Recommended validation queries:

- count notes with null resolved workspace after backfill
- count notes whose target rows disagree on workspace
- count notes with both `case_file_id` and `case_workspace_document_id` non-null if that shape is disallowed

#### Fresh-Bootstrap Dependency Implications

Required creation order:

1. `case_workspace`
2. `case_file`
3. `document`
4. `case_workspace_document`
5. `document_origin`
6. `work_group`
7. `work_group_document`
8. evolved `consultation_note`

Important detail:

- any composite unique constraints required for child FKs should exist before the child FK declarations that reference them

#### Validation Criteria For A2c

Before moving past A2c, validate:

- a work group cannot exist without a workspace
- a work group cannot span workspaces
- a workspace document can be added to zero, one, or many groups
- duplicate `(work_group_id, case_workspace_document_id)` memberships are rejected
- cross-workspace `work_group_document` inserts are rejected by PostgreSQL
- workspace note, group note, case note, and document note shapes all insert successfully
- notes with mismatched workspace/context targets are rejected by PostgreSQL
- document notes target `case_workspace_document`, not raw `document`
- existing canonical imported counts remain unchanged
- `document_origin` semantics remain unchanged
- current consultation views remain unchanged unless explicit new workspace/group views are added

## Phase B: Source Capture, Source Observation, Canonical Mapping Provenance

### Goal

Preserve acquisition evidence and canonical mapping without duplicating the whole canonical schema.

### Existing Evidence To Reuse

Already available in repository/package:

- `import_batch` manifest data
- package `package.json`
- package `provenance/export-notes.json`
- package `artifacts/*`
- package-level counts and notes
- canonical source-facing fields already persisted

What is missing in PostgreSQL:

- explicit capture event layer
- explicit observation rows
- explicit mapping provenance from observation to canonical entity

Current repository-specific meaning of `import_batch`:

- one row per imported `package_id`
- inserted/upserted by the importer before canonical row upserts
- not one row per import attempt or retry
- currently mixes package identity with a first-import timestamp via `imported_at`

Practical implication:

- the current repository does not yet have a true import-execution table
- Phase B should not force `import_batch` into a many-to-many capture/execution model it does not currently implement
- if true execution logging is needed later, add a separate table then rather than overloading Phase B

### Tables

#### New `source_capture`

Purpose:

- captured evidence unit that can exist before, without, or independently of import

Repository-specific meaning:

- for the current repository, the first concrete `source_capture` is the exported portable package snapshot identified by `package_id`
- later captures may also represent a live scrape snapshot that has not been imported yet
- later captures may also represent manually captured external evidence that never enters the legacy package importer

What makes two captures distinct:

- they represent different acquired evidence sets
- or they were emitted under different stable capture identifiers
- repeated import or retry of the same package does not create a new capture

Columns:

- `id BIGSERIAL PRIMARY KEY`
- `source_system TEXT NOT NULL`
- `capture_kind TEXT NOT NULL`
- `capture_key TEXT NULL`
- `external_source_label TEXT NULL`
- `captured_at TIMESTAMPTZ NOT NULL`
- `scraper_key TEXT NULL`
- `scraper_version TEXT NULL`
- `source_locator TEXT NULL`
- `metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb`
- `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`

Constraints:

- `CHECK (capture_kind IN ('portable_package_export','live_scrape_snapshot','manual_source_capture'))`
- partial unique key for idempotent external capture identity:
  - `UNIQUE (capture_kind, source_system, capture_key) WHERE capture_key IS NOT NULL`

Indexes:

- `ix_source_capture_source_system`
- `ix_source_capture_captured_at`
- `ix_source_capture_capture_kind`

Classification:

- source capture / ingestion provenance

Resolved Phase B recommendation:

- add nullable `import_batch.source_capture_id`
- direction is `import_batch -> source_capture`
- for portable-package imports the Phase B schema should enforce one `source_capture` to zero-or-one `import_batch`
- do not add `source_capture.import_batch_id`
- do not add a `source_capture_import_batch` link table in Phase B

Reason:

- the current importer and schema already treat `import_batch` as one row per package identity, not one row per import execution
- one captured package imported repeatedly/idempotently still resolves to the same `import_batch` row today
- live scrape captures and manual captures may exist without any import at all
- a many-to-many link would model a future execution log the repository does not yet have

Current-package idempotency key:

- for `capture_kind = 'portable_package_export'`, use `capture_key = package_id`

Required import-batch constraint:

- add a partial unique index on `import_batch(source_capture_id) WHERE source_capture_id IS NOT NULL`

Reason:

- this makes the zero-or-one package-import relationship explicit in the database rather than merely observational in current repository behavior

Future note:

- if the repository later needs one row per import attempt, add a separate import-execution table rather than changing the Phase B capture model

#### New `source_observation`

Purpose:

- one captured row or coarse evidence record inside a `source_capture`

Repository-specific meaning for the current package contract:

- this is not a raw HTML/page-scrape replay table
- it stores the package-level row evidence that survives export
- it may also store artifact rows such as unresolved-document and size-mismatch reports that are currently only on disk
- it should preserve capture lineage without pretending the repository still has per-click or per-page source evidence

Columns:

- `id BIGSERIAL PRIMARY KEY`
- `source_capture_id BIGINT NOT NULL`
- `observation_kind TEXT NOT NULL`
- `observation_key TEXT NOT NULL`
- `source_native_id TEXT NULL`
- `parent_source_native_id TEXT NULL`
- `source_path TEXT NOT NULL`
- `display_title TEXT NULL`
- `display_status TEXT NULL`
- `display_date TEXT NULL`
- `payload_json JSONB NOT NULL DEFAULT '{}'::jsonb`
- `observed_at TIMESTAMPTZ NULL`
- `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`

Constraints:

- `FOREIGN KEY (source_capture_id) REFERENCES casework.source_capture(id)`
- `CHECK (observation_kind IN ('case_row','bucket_row','document_occurrence_group','package_artifact'))`
- `UNIQUE (source_capture_id, observation_kind, observation_key)`

Indexes:

- `ix_source_observation_source_capture_id`
- `ix_source_observation_observation_kind`
- `ix_source_observation_source_path`
- `ix_source_observation_source_native_id`
- `ix_source_observation_parent_source_native_id`

Classification:

- source observation

Recommended first Phase B observation kinds:

- `case_row`
  - produced from `cases/cases.jsonl`
  - useful because it preserves which captured package contained which exported case rows, even though the row fields are also normalized canonically
  - `source_native_id = idprocesso` when present
  - `parent_source_native_id = parent_processo`
  - `display_title = processo`
  - `display_status = estado`
  - `display_date = data_autuacao`
- `bucket_row`
  - produced from `cases/buckets.jsonl`
  - useful because it preserves bucket membership in a specific capture and the exported row snapshot
  - `source_native_id = bucket_id`
  - `parent_source_native_id = processo`
  - `display_title = COALESCE(modal_title, designation, reference_number)`
  - `display_date = bucket_date`
- `document_occurrence_group`
  - produced from `cases/bucket_documents.jsonl`
  - represents one exported bucket-document relation row, not each raw source occurrence separately
  - preserves the important surviving multiplicity signal through `source_observation_count` and `has_intra_bucket_duplication`
  - `source_native_id` is usually null because the package does not retain a true per-occurrence native identifier here
  - `parent_source_native_id = bucket_id`
- `package_artifact`
  - produced from retained artifact files such as `artifacts/unresolved-documents.jsonl` and `artifacts/size-mismatches.jsonl`
  - useful because these rows preserve evidence that is otherwise only on disk today

Observation kinds to omit from the first Phase B slice:

- do not add a separate raw `document_row` observation kind yet
- do not add a separate `document_binary_row` observation kind yet

Reason:

- the current package does not retain richer per-row source-display evidence for those files beyond what the canonical imported tables already store
- the first useful non-canonical gain comes from case/bucket capture lineage, grouped bucket-document occurrence evidence, and artifact preservation

Observation payload guidance for the first slice:

- required normalized fields:
  - `source_capture_id`
  - `observation_kind`
  - `observation_key`
  - `source_path`
- usually optional normalized fields:
  - `source_native_id`
  - `parent_source_native_id`
  - `display_title`
  - `display_status`
  - `display_date`
  - `observed_at`
- omit `display_order` from the first implementation unless a future package actually preserves stable source ordering
- `payload_json` should contain the minimal row snapshot or artifact detail that is not worth normalizing further
- do not copy every canonical field into dedicated columns when the same evidence can live in `payload_json`

#### New `source_observation_link`

Purpose:

- mapping provenance from a source observation to a canonical entity

Columns:

- `id BIGSERIAL PRIMARY KEY`
- `source_observation_id BIGINT NOT NULL`
- `case_file_id BIGINT NULL`
- `bucket_id BIGINT NULL`
- `document_id BIGINT NULL`
- `mapper_key TEXT NOT NULL`
- `mapper_version TEXT NOT NULL`
- `mapped_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`

Constraints:

- `FOREIGN KEY (source_observation_id) REFERENCES casework.source_observation(id)`
- FKs to `case_file`, `bucket`, `document`
- `CHECK` exactly one canonical target FK is non-null
- partial unique indexes preventing duplicate links to the same populated target:
  - `(source_observation_id, case_file_id) WHERE case_file_id IS NOT NULL`
  - `(source_observation_id, bucket_id) WHERE bucket_id IS NOT NULL`
  - `(source_observation_id, document_id) WHERE document_id IS NOT NULL`

Indexes:

- `ix_source_observation_link_source_observation_id`
- `ix_source_observation_link_case_file_id`
- `ix_source_observation_link_bucket_id`
- `ix_source_observation_link_document_id`
- `ix_source_observation_link_mapper_key`

Classification:

- canonical mapping provenance

Recommended first Phase B mapping semantics:

- keep exactly one canonical target FK per mapping row
- allow one observation to have multiple mapping rows when it meaningfully maps to more than one canonical entity
  - example: one `document_occurrence_group` observation may map once to its canonical `bucket` and once to its canonical `document`
- omit `mapping_kind` in the first slice because, with exactly one target FK, it duplicates the populated target type rather than adding new semantics
- omit `mapping_confidence` and `mapping_note` in the first slice because current importer mappings are deterministic or should fail loudly
- use partial unique indexes rather than plain multi-column `UNIQUE` constraints so the invariant is explicit under PostgreSQL null semantics

Mapper fields:

- `mapper_key = 'app/import-package.mjs'`
- `mapper_version` should be an explicit importer mapping-version constant added when Phase B is implemented
- do not reuse package `schema_version` as the mapper version; that is package-contract versioning, not importer-mapping versioning

Package/import identity on mapping rows:

- do not duplicate `package_id` or `import_batch_id` on `source_observation_link`
- that provenance is already reachable through:
  - `source_observation -> source_capture`
  - and, for imported package captures, `import_batch.source_capture_id`

### Phase B Boundary Clarification

These three concepts must stay distinct:

- `bucket_document`: canonical official bucket membership/occurrence
- `source_observation`: acquisition evidence of what the source showed
- `document_origin`: provenance of how the logical document entered or became known in the application/workspace

This sharpening does not block Phase A1, but it must be preserved before implementing `document_origin` or Phase B.

### Migration Ordering And Dependencies

- depends on Phase A only insofar as `case_workspace` exists for later workspace-aware provenance use
- does not depend on Phase C

### PostgreSQL Backfill Strategy

Phase B has three distinct implementation steps and they should not be described as one mechanism:

1. schema migration
   - create the new tables and `import_batch.source_capture_id`
   - this step alone cannot reconstruct package-only evidence
2. PostgreSQL-only backfill
   - limited to relationships derivable from rows already stored in PostgreSQL
   - this may attach `import_batch` to an already-created `source_capture` if the capture row already exists
   - this cannot reconstruct package-only artifacts or export metadata that were never copied into PostgreSQL
3. package-aware importer/backfill execution
   - required to create the package-derived `source_capture.metadata_json`
   - required to create `source_observation` rows from retained package/artifact files
   - required to create `source_observation_link` rows from package rows to canonical entities

Smallest viable package-aware Phase B backfill for current data:

1. create one `source_capture` row for the currently retained package/export
2. populate `source_capture.metadata_json` from package manifest fields plus `provenance/export-notes.json`
3. create `source_observation` rows from retained package rows for:
   - `case_row`
   - `bucket_row`
   - `document_occurrence_group`
   - `package_artifact`
4. create `source_observation_link` rows to canonical entities

Important limitation:

- current package contract does not include full raw scrape observation rows
- migration SQL by itself cannot reconstruct package-only evidence such as:
  - `provenance/export-notes.json`
  - `artifacts/unresolved-documents.jsonl`
  - `artifacts/size-mismatches.jsonl`
- therefore Phase B backfill will preserve package-export observation lineage, not reconstruct every original live scrape detail

### Importer Enhancement

Required in Phase B:

- create/find `source_capture`
- attach the package-keyed `import_batch` row to that `source_capture`
- store `provenance/export-notes.json` in `source_capture.metadata_json` for the first slice
- create idempotent `source_observation` rows from retained package/artifact records
- create `source_observation_link` rows during canonical upsert mapping

Recommended mapper fields:

- `mapper_key = 'app/import-package.mjs'`
- `mapper_version = explicit importer mapping-version constant`

### Directus Impact

- not necessary for first consultation UI
- useful later for audit/admin views

### Validation Queries / Invariants

- observation links map to exactly one canonical entity
- source capture and import execution are distinguishable
- repeated import of the same package does not duplicate `source_capture` or `source_observation`
- canonical counts do not change due to Phase B
- `bucket_document.source_observation_count` remains unchanged as a useful canonical aggregate and is not recalculated from Phase B rows

### Completion Criteria

Phase B is complete when:

- source capture, source observation, and mapping provenance are queryable
- `source_observation` is clearly distinct from `document_origin`
- import execution provenance is not collapsed into source capture

## Phase C: Processing Jobs Plus Representation/Segment Infrastructure

### Goal

Introduce a format-agnostic processing system without forcing PDF-specific assumptions into orchestration or content structure.

### Tables

#### New `document_representation`

Purpose:

- one immutable successful machine-derived representation emitted for a specific source binary, representation kind, and processor version
- failed attempts do not create representation rows
- an existing successful representation for the same `(file_binary_id, representation_kind, processor_key, processor_version)` normally means the requested same-version output is already satisfied

Columns:

- `id BIGSERIAL PRIMARY KEY`
- `file_binary_id BIGINT NOT NULL`
- `produced_by_job_id BIGINT NOT NULL`
- `representation_kind TEXT NOT NULL`
- `format_family TEXT NOT NULL`
- `processor_key TEXT NOT NULL`
- `processor_version TEXT NOT NULL`
- `metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb`
- `content_json JSONB NULL`
- `artifact_rel_path TEXT NULL`
- `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`

Constraints:

- `FOREIGN KEY (file_binary_id) REFERENCES casework.file_binary(id) ON DELETE RESTRICT`
- `FOREIGN KEY (produced_by_job_id) REFERENCES casework.processing_job(id) ON DELETE RESTRICT`

Indexes:

- `ix_document_representation_file_binary_id`
- `ix_document_representation_format_family`
- `ix_document_representation_processor`
- `ix_document_representation_produced_by_job_id`

Unique:

- `UNIQUE (file_binary_id, representation_kind, processor_key, processor_version)`
- `UNIQUE (produced_by_job_id)`

Classification:

- machine-derived

Semantics:

- the durable idempotent identity is `(file_binary_id, representation_kind, processor_key, processor_version)`
- `produced_by_job_id` identifies the exact successful job that created that immutable representation
- one producing job creates at most one representation in the first slice
- PostgreSQL should enforce the `produced_by_job_id` FK and uniqueness directly
- semantic consistency between the producing job target and the representation `file_binary_id` remains runtime-enforced
- do not add cross-table composite enforcement for that consistency in C1
- `representation_kind` identifies the output type, not the stage
- `format_family` identifies the source-binary family such as `pdf`
- `processor_key` identifies the implementation
- `processor_version` identifies the behavior/version lineage of that implementation
- `metadata_json` stores compact summary metadata and diagnostics
- `content_json` is allowed for compact structured representation-level content only
- `artifact_rel_path` is allowed for optional large/raw sidecar artifacts and must not duplicate segment text

#### New `document_segment`

Purpose:

- one ordered normalized content fragment emitted from a `document_representation`
- the abstraction is format-agnostic; page is optional metadata, not the universal unit

Columns:

- `id BIGSERIAL PRIMARY KEY`
- `document_representation_id BIGINT NOT NULL`
- `segment_kind TEXT NOT NULL`
- `sequence_no INTEGER NOT NULL`
- `text_content TEXT NULL`
- `structural_path TEXT NULL`
- `page_no INTEGER NULL`
- `char_start INTEGER NULL`
- `char_end INTEGER NULL`
- `metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb`
- `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`

Constraints:

- `FOREIGN KEY (document_representation_id) REFERENCES casework.document_representation(id) ON DELETE CASCADE`
- `CHECK (sequence_no >= 1)`
- `CHECK (char_start IS NULL OR char_start >= 0)`
- `CHECK (char_end IS NULL OR char_end >= 0)`
- `CHECK (char_start IS NULL OR char_end IS NULL OR char_end >= char_start)`

Unique:

- `UNIQUE (document_representation_id, sequence_no)`

Indexes:

- `ix_document_segment_representation_id`
- `ix_document_segment_page_no`

Classification:

- machine-derived

First-slice segment guidance:

- retain:
  - `segment_kind`
  - `sequence_no`
  - `text_content`
  - `structural_path`
  - `page_no`
  - `char_start`
  - `char_end`
  - `metadata_json`
- defer dedicated `sheet_name` and `bbox_json` columns from the first implementation
- if Phase D later needs bounding boxes or sheet identifiers, they can first live in `metadata_json` and only be promoted if a real query need appears

Text storage policy:

- Phase C/D should store extracted segment text inline in `document_segment.text_content`
- the current corpus scale supports this comfortably:
  - `1238` PDFs
  - about `509 MB` total binary size
  - about `6.8 million` currently extracted characters across `file_binary`
  - about `6715` total pages
- inline text keeps PostgreSQL-backed querying, inspection, backup, and future FTS simpler
- do not introduce external text-artifact indirection for first-slice PDF extraction
- very large raw/debug artifacts may still live outside PostgreSQL and be referenced from representation-level `artifact_rel_path`

#### New `processing_job`

Purpose:

- one logical processing intent for one exact target, stage, processor implementation, and processor version
- a row persists across bounded retries
- a row is not an execution-attempt history record
- later explicit rerun behavior depends on stage semantics rather than following one universal rule for every terminal row

Columns:

- `id BIGSERIAL PRIMARY KEY`
- `stage_key TEXT NOT NULL`
- `status TEXT NOT NULL`
- `file_binary_id BIGINT NULL`
- `document_representation_id BIGINT NULL`
- `processor_key TEXT NOT NULL`
- `processor_version TEXT NOT NULL`
- `requested_by TEXT NULL`
- `requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
- `started_at TIMESTAMPTZ NULL`
- `completed_at TIMESTAMPTZ NULL`
- `attempt_count INTEGER NOT NULL DEFAULT 0`
- `max_attempts INTEGER NOT NULL DEFAULT 3`
- `error_code TEXT NULL`
- `error_text TEXT NULL`
- `depends_on_job_id BIGINT NULL`

Constraints:

- `FOREIGN KEY (file_binary_id) REFERENCES casework.file_binary(id) ON DELETE RESTRICT`
- `FOREIGN KEY (document_representation_id) REFERENCES casework.document_representation(id) ON DELETE RESTRICT`
- `FOREIGN KEY (depends_on_job_id) REFERENCES casework.processing_job(id) ON DELETE RESTRICT`
- `CHECK` exactly one target FK is non-null
- `CHECK (status IN ('queued','running','completed','failed','cancelled','blocked'))`
- `CHECK (max_attempts >= 1)`
- `CHECK (attempt_count >= 0)`
- `CHECK (depends_on_job_id IS NULL OR depends_on_job_id <> id)`

Indexes:

- `ix_processing_job_status`
- `ix_processing_job_stage_key`
- `ix_processing_job_claimable`
- `ix_processing_job_file_binary_id`
- `ix_processing_job_document_representation_id`
- `ix_processing_job_depends_on_job_id`

Uniqueness / idempotency:

- use target-specific partial unique indexes rather than a polymorphic generated key
- file-binary target:
  - `(file_binary_id, stage_key, processor_key, processor_version)`
  - `WHERE file_binary_id IS NOT NULL AND status IN ('queued','running')`
- representation target:
  - `(document_representation_id, stage_key, processor_key, processor_version)`
  - `WHERE document_representation_id IS NOT NULL AND status IN ('queued','running')`

Classification:

- machine operational state

First-slice target model:

- retain `file_binary_id`
  - for `IDENTIFY_FORMAT`
  - for `VERIFY_BINARY`
  - for `EXTRACT_STRUCTURE`
  - for `OCR_FALLBACK`
- retain `document_representation_id`
  - for `NORMALIZE_CONTENT`
  - for later chunking/index-preparation work that operates on derived content
- defer `document_id` as a processing target from the first Phase C slice

Reason:

- the current repository and planned Phase D PDF path do not need document-level processing targets yet
- keeping only the target classes Phase D actually uses avoids schema bloat while preserving typed FK integrity

Recommended first-slice `stage_key` examples:

- `IDENTIFY_FORMAT`
- `VERIFY_BINARY`
- `EXTRACT_STRUCTURE`
- `OCR_FALLBACK`
- `NORMALIZE_CONTENT`

Job semantics:

- `stage_key` identifies the capability/stage, not the processor implementation
- `processor_key` identifies the concrete implementation, for example `worker/pdfium-text`
- `processor_version` identifies the implementation behavior/version, for example `2026-09-01`
- `requested_by` is informational only and must not participate in idempotency
- `attempt_count` starts at `0`
- atomic claim/start increments `attempt_count` to `1` for the first attempt
- retries reuse the same row and increment `attempt_count` again on the next claim/start
- `requested_at` is the original enqueue timestamp and is never reset on retry
- `started_at` records the most recent attempt start
- first-attempt start history is deliberately not retained separately
- `completed_at` is the terminal timestamp for the row despite the historical column name
- `completed_at` is set when the row transitions to `completed`, `failed`, `cancelled`, or `blocked`
- `completed_at` remains `NULL` while the row is `queued` or `running`
- `error_code` and `error_text` reflect the latest failure/blocking reason on the row

Status model:

- `queued`
  - enqueued and eligible to run once dependency rules are satisfied
  - inbound: initial insert, retry after a non-terminal failure
  - outbound: `running`, `cancelled`, `blocked`
- `running`
  - atomically claimed and actively owned by a worker
  - inbound: from `queued`
  - outbound: `completed`, `queued`, `failed`, `cancelled`, `blocked`
- `completed`
  - terminal successful completion
  - inbound: from `running`
- `failed`
  - terminal exhaustion or unrecoverable failure
  - inbound: from `running`
- `cancelled`
  - terminal manual/operator cancellation before or during execution
  - inbound: from `queued`, `running`
- `blocked`
  - terminal state for jobs whose declared dependency cannot be satisfied within the current chain
  - inbound: from `queued`, `running`

Retried failure behavior:

- if an attempt fails and `attempt_count < max_attempts`, update the same row back to `queued`
- preserve `requested_at`
- keep the latest `error_code` / `error_text`
- clear `completed_at`
- if an attempt fails and `attempt_count >= max_attempts`, mark the row `failed`

Dependency semantics:

- one nullable `depends_on_job_id` is sufficient for the first PDF pipeline
- a dependent job is claimable only when:
  - `depends_on_job_id IS NULL`
  - or the parent job is `completed`
- if the parent job reaches `failed`, `cancelled`, or `blocked`, the dependent should be marked `blocked`
- if the parent is `queued` or `running`, the dependent remains `queued` but ineligible
- C1 only stores and supports the `blocked` state
- automatic dependency-failure propagation is future queue-helper/worker behavior rather than schema behavior
- reject self-dependency in the database
- do not build a general cycle-detection/DAG engine in first Phase C

Atomic claiming:

- use `FOR UPDATE SKIP LOCKED`
- claimable statuses: only `queued`
- eligible dependency predicate:
  - no dependency
  - or parent status = `completed`
- ordering:
  - `requested_at ASC, id ASC`
- atomic claim transition:
  - `queued -> running`
  - `attempt_count = attempt_count + 1`
  - `started_at = NOW()`
  - `error_code = NULL`
  - `error_text = NULL`

Stale worker recovery:

- defer `stale_after` from the first Phase C slice
- the current repository has no existing background worker or heartbeat model
- first-slice recovery can be an explicit administrative requeue of `running` jobs if a local worker crashes
- lease/heartbeat recovery can be added later if multi-worker or unattended processing justifies it

Active-job uniqueness:

- `processor_key` and `processor_version` must both participate in active-job identity
- `requested_by` must not participate
- `completed`, `failed`, `cancelled`, and `blocked` rows must not block creation of a later new job with the same target/stage/processor/version
- `blocked` is not active for uniqueness
- these partial unique indexes prevent duplicate concurrent active work only
- they do not prove the requested processing is still needed
- future enqueue/runtime logic must separately determine whether processing is already satisfied
- for representation-producing stages, ordinary same-version enqueue should usually check for an existing immutable successful representation and treat that output as already satisfied
- non-representation-producing operational stages may later define a different explicit rerun/revalidation policy

#### `processing_result`

First-slice recommendation:

- defer `processing_result` from Phase C

Reason:

- `processing_job` already carries operational status, attempt state, and failure reason
- successful durable outputs are better represented by immutable `document_representation` plus `document_segment`
- adding `processing_result` now would duplicate target/output semantics without giving the repository a true execution-history model

If a later slice restores it:

- it should reference `processing_job` only
- it should not duplicate target FKs that are already present on the job row

### Job Lifecycle / Worker Semantics

Queue semantics:

- Phase C provides processing state and claim semantics, not a full orchestration engine
- one `processing_job` row is a retryable logical unit
- bounded execution retries reuse the same row
- a newer processor version is a new job identity because `processor_version` participates in uniqueness
- after `failed` or `cancelled`, a later explicitly requested processing intent may use a new job row
- for representation-producing stages, ordinary enqueue should treat an existing successful same-version representation as already satisfied rather than creating a redundant new job
- deliberate forced same-version recomputation or revision history is deferred beyond C1
- non-representation-producing operational stages may later define their own explicit rerun/revalidation policy
- older successful representations are preserved; no destructive overwrite policy is needed in Phase C

Processing provenance chain:

- `processing_job` answers:
  - what target was processed
  - by which stage
  - by which processor key/version
  - when it was requested
  - how many attempts ran
  - whether it completed, failed, cancelled, or blocked
- `document_representation.produced_by_job_id` answers exactly which job produced a successful representation
- `document_segment` answers which ordered extracted text fragments belong to that representation

First-slice representation/segment usage in the current repository:

- Phase D PDF extraction jobs should create:
  - one successful `document_representation` per `(file_binary_id, representation_kind, processor_key, processor_version)`
  - ordered `document_segment` rows containing inline text and optional PDF page metadata
- `content_json` should stay compact
  - examples: outline summary, per-page statistics, OCR-needed summary, extraction diagnostics
- full extracted text should live in segments, not be duplicated into `content_json`
- raw or bulky sidecar artifacts may be referenced by `artifact_rel_path`

### Importer Enhancement

None required in Phase C if backlog seeding is a separate script.

Optional later:

- importer may enqueue initial binary jobs after importing `file_binary`
- this should remain deferred until after the Phase C schema exists and the first worker path is proven

### Directus Impact

- new tables do not need immediate UI exposure
- minimal admin views later for job status are useful

### Validation Queries / Invariants

- every `processing_job` has exactly one target FK
- no duplicate active jobs for same target/stage/processor/version within `queued` or `running`
- every `document_segment` belongs to a valid `document_representation`
- every `document_representation` points to exactly one producing `processing_job`
- no self-dependency in `processing_job`

### Completion Criteria

Phase C is complete when:

- the processing-core schema exists with FK integrity
- the asynchronous multi-representation processing path is durable and restart-safe
- independent Docling and Xberg interpretations are supported and remain separately attributable
- representation comparison and effective-selection behavior exist without treating any extractor as authoritative truth
- both processing and original-binary serving consume the `BinaryStore` boundary without changing canonical binary identity semantics

## Phase C4: Corpus Consultation MVP

### Goal

Provide a thin, human-usable consultation layer over the already imported corpus, persisted processing state, and retained representations.

This phase exists to make the current corpus and processing foundation inspectable and demonstrable. It is not intended to become the primary long-term architectural focus of the project.

### Scope

Phase C4 should stay deliberately thin:

- a binary catalogue/grid over the current corpus
- a binary detail/inspection view
- original-binary access through the existing `file-gateway -> BinaryStore` path
- representation viewing without conflating viewing with explicit representation preference
- simple human-readable presentation of processing, provenance, comparison, and review-needed state

Directus remains useful for raw/admin consultation of PostgreSQL tables. The custom consultation UI should provide the human-friendly corpus experience rather than turning Directus into the final Virgilio product surface.

### Non-Goals

Do not turn C4 into a full document-management or legal-analysis application.

Defer:

- annotations
- PDF paragraph highlighting and synchronization
- semantic editing
- timeline editing
- relationship graphs
- workflow-heavy review tooling
- advanced semantic navigation

### Completion Criteria

Phase C4 is complete when:

- a human can browse a useful catalogue of binaries and their current processing state
- a human can inspect an original PDF beside available derived representations
- available representations, effective selection, and selection provenance are visible
- attention/review-needed signals remain visible without implementing a larger workflow system

## Phase D: Search And Retrieval Foundation

### Goal

Turn selected document representations into a searchable, provenance-aware corpus suitable for later AI retrieval and downstream enrichment.

This phase no longer introduces the first real PDF processor.
Extraction, multiple representations, asynchronous execution, comparison, and selection already exist from Phases C2-C3.2.
The repository also now has a first explicit PDF evidence-preservation slice from Phase C5.3.1.

The PDF-side stack is therefore now conceptually:

```text
immutable file_binary PDF
    ->
PDF evidence artifacts
    ->
interpreted document representations
    ->
search / retrieval / AI-oriented derived projections
```

Important boundary:

- the original `file_binary` remains the evidence source
- PDF evidence artifacts preserve recoverable binary-level channels without forcing them into one reading-order model
- Docling/Xberg remain interpretation engines rather than the universal PDF evidence boundary
- search, retrieval, and AI-serving should build on this distinction rather than silently flattening it away

Working philosophy behind this boundary:

- preserve evidence before preferring interpretation
- keep distinct PDF channels separately attributable rather than collapsing them into one "best text"
- treat extractor disagreement as useful information about uncertainty or channel differences
- optimize later convenience layers around traceable artifacts, not around silent loss of source evidence

### D1 Search Derivation And Lineage Model

Search-derived content must retain explicit lineage:

```text
document_representation
        ->
search_derivation
        ->
search_chunk
```

Each derivation should identify at least:

- input `document_representation`
- derivation/chunking strategy
- strategy version
- materially relevant configuration identity
- status
- creation time

Architectural invariants:

- indexed data is derived data, not canonical evidence
- every search derivation must identify the exact immutable representation used as input
- changing the effective representation, chunking strategy, or relevant configuration produces a new derivation rather than silently rewriting provenance

### D2 Search-Ready Chunks

Derive useful searchable units from the selected/effective representation.

Prefer structure-aware chunking where available rather than arbitrary fixed-width windows. Preserve useful provenance where practical:

- document
- representation
- source segment or structural element
- page
- ordinal
- heading/context

Search-ready derivation should not assume that every useful PDF fact originates in the same artifact class.
For example:

- readable consultation text may come from an interpreted representation
- signature facts may remain most defensibly queryable from dedicated evidence artifacts
- OCR evidence may remain distinct from native PDF text even when later search projections combine them deliberately

### D3 Lexical Retrieval

Implement useful text search over the corpus.

PostgreSQL full-text search is the lowest-complexity initial option and should be considered before adding separate search infrastructure.

The target capability is:

```text
query
  ->
ranked chunks
  ->
document + representation + source provenance
```

### D4 Semantic/Vector Retrieval

After lexical retrieval and chunk quality are understood, add embedding/vector derivations if justified.

Embedding outputs must also be versioned and attributable to the exact input representation and embedding model/version used.

External search/vector indexes should be treated as rebuildable projections rather than authoritative state.

### D5 AI Retrieval / Serving

Once retrieval is demonstrably useful:

```text
question
   ->
retrieval
   ->
relevant chunks
   ->
AI
   ->
answer + provenance
```

AI-supported claims must remain traceable through retrieval and search derivation to the exact `document_representation`, canonical document context, and original binary.

### Completion Criteria

Phase D is complete when:

- selected representations can be transformed into searchable derived chunks with explicit lineage
- lexical retrieval is useful and navigable back to source provenance
- any additional vector/AI-serving layer remains rebuildable and provenance-aware
- representation changes can be detected as requiring new search derivations rather than silently reusing stale derived state

## Phase E: Incremental Semantic Enrichment

### Goal

Add higher-value semantic derivations on top of the already searchable, representation-aware corpus without requiring the search foundation to be redesigned.

This phase should follow a hybrid strategy:

```text
                         -> search chunks
document_representation -+-> embeddings
                         -> semantic derivations
```

These remain complementary derived interpretations of the same representation.

### Initial Direction

Begin with relatively objective, useful signals such as:

- dates
- court/process reference numbers
- document references
- named persons
- organizations/institutions
- courts
- document-type signals
- language

Later phases may add cross-document relationships, event candidates, and structured matters/topics once the corpus evidence justifies them.

### Interaction With Existing Search

Semantic enrichment must work with an already-indexed corpus.

Do not assume enrichment requires replacing existing search chunks. Instead, later semantic observations may:

- attach to documents
- attach to representations
- attach to specific chunks/source spans where appropriate
- become retrieval filters
- become ranking signals
- support navigation and AI context selection

If enrichment logic changes, create/version new derivations rather than silently rewriting provenance.

### Completion Criteria

Phase E is complete when:

- high-value semantic derivations exist with explicit provenance
- semantic outputs can improve retrieval, filtering, and navigation without replacing canonical evidence
- changed representations or changed enrichment logic can be detected as stale/non-current derived state rather than silently reassigned

## Phase F: Rich Review / Knowledge Workspace

Reserve richer human interaction for a later phase once consultation, retrieval, and semantic derivation are grounded in persisted provenance-aware data.

Possible later capabilities include:

- semantic review/correction
- human assertions
- timeline review
- relationship graph exploration
- richer PDF-to-interpretation synchronization
- annotations
- matter-oriented navigation
- review workflows

Do not treat Phase F as a prerequisite for C4, D, or E.

## Recommended Delivery Sequence

Completed:

1. Phase A1 PostgreSQL schema migration, PostgreSQL backfill, and importer compatibility
2. Phase A2a PostgreSQL schema evolution, PostgreSQL backfill, and importer compatibility
3. Phase A2b PostgreSQL schema evolution and importer compatibility
4. Phase A2c PostgreSQL schema evolution for `work_group`, `work_group_document`, and workspace-aware `consultation_note`
5. Phase B PostgreSQL schema migration, package-aware provenance backfill via importer, and importer compatibility
6. Phase C1 processing-core schema migration
7. Phase C2 multi-engine extraction evaluation/spike with Docling and Xberg
8. Phase C3 durable asynchronous multi-representation processing, selection, and comparison support on top of the existing C1 model
9. Phase C3.1 binary-storage abstraction for the processing path via `BinaryStore` / `LocalBinaryStore`
10. Phase C3.2 route original-binary serving through `BinaryStore` by wiring `app/file-gateway.mjs` to the existing local materialization boundary without changing API behavior

Next recommended sequence:

11. Phase C4 thin corpus consultation MVP over the existing canonical, processing, and representation state
12. Phase C5.2 preservation-oriented interpretation artifact update for Docling/Xberg readable outputs
13. Phase C5.3 investigation establishing that PDF evidence extraction is a distinct boundary below interpretation
14. Phase C5.3.1 first bounded PDF evidence-artifact implementation slice
15. Phase C5.3.2 targeted rollout and implementation validation of the new PDF evidence artifacts
16. Phase D search and retrieval foundation built from selected `document_representation` inputs with explicit lineage and rebuildable derived projections
17. Phase E incremental semantic enrichment that works with the already indexed corpus rather than replacing it
18. Phase F richer review and knowledge-workspace capabilities after consultation, retrieval, and semantic derivation are in place

## Proposed Migration / File Boundaries

Recommended migration file grouping:

1. `2026-08-xx-003-phase-a1-case-workspace.sql`
   - `case_workspace`
   - `case_file.case_workspace_id`
   - validation-safe PostgreSQL backfill

2. `2026-08-xx-004-phase-a2a-workspace-reference-document.sql`
   - `case_workspace_reference`
   - `case_workspace_document`
   - PostgreSQL backfill for workspace references and workspace-document closure

3. `2026-08-xx-005-phase-a2b-document-origin.sql`
   - `document` identity transition
   - `document_origin`
   - `document_binary` primary-binary integrity refinement

4. `2026-08-xx-006-phase-a2c-workgroup-notes.sql`
   - `work_group`
   - `work_group_document`
   - workspace-aware `consultation_note` evolution

5. `2026-08-xx-007-phase-b-source-provenance.sql`
   - `source_capture`
   - `source_observation`
   - `source_observation_link`

6. `2026-08-xx-008-phase-c-processing-core.sql`
   - `document_representation`
   - `document_segment`
   - `processing_job`

Implementation files:

- importer enhancements in `app/import-package.mjs`
- worker/runtime implementation in `app/`
- later consultation UI in a dedicated frontend/client path
- later search/derivation runtime in `app/` or `scripts/`

## Phase A2c Implementation Result

Implemented on 2026-08-31: Phase A2c only.

Implemented slice:

1. add `work_group`
2. add `work_group_document`
3. evolve `consultation_note` to require workspace context and use workspace-safe targets
4. drop legacy `consultation_note.bucket_id`, `document_id`, and `file_binary_id`
5. validate composite same-workspace integrity and unchanged canonical counts

Why this slice was the correct boundary:

- `case_workspace`, `case_workspace_document`, and `document_origin` are already in place
- the next missing capability is user organization and workspace-safe notes
- the repository currently has zero note rows, so the target-model cleanup can be done directly without transitional data shims

## Phase B Implementation Result

Implemented on 2026-08-31: Phase B only.

Implemented slice:

1. add `source_capture`
2. add `import_batch.source_capture_id` with one-capture-to-zero-or-one-import enforcement
3. add `source_observation`
4. add `source_observation_link`
5. extend the importer to create/find one package `source_capture`, attach `import_batch`, and idempotently populate immutable observations and mapping links
6. preserve canonical counts and consultation-view behavior under first import and rerun

Implemented first-slice `source_observation` kinds:

1. `case_row`, `bucket_row`, `document_occurrence_group`, and `package_artifact`
2. first-slice `source_observation` payload remains deliberately narrow and omits unsupported `display_order`.
3. first-slice `source_observation_link` keeps exactly one canonical target FK plus mapper fields, and omits `mapping_kind`, `mapping_confidence`, and `mapping_note`.
4. first-slice export-notes data belongs in `source_capture.metadata_json`.

Validation outcome:

- repeated import of the same package reuses the same `source_capture` unchanged when the captured evidence is identical
- conflicting capture-level evidence under the same `(capture_kind, source_system, capture_key)` identity is a hard error
- repeated import leaves canonical counts unchanged
- repeated import leaves `source_observation` and `source_observation_link` rows unchanged when the evidence and mappings are identical
- conflicting observation payload or normalized observation fields under the same observation identity is a hard error
- `bucket_document.source_observation_count` remains unchanged
- `document_binary.source_observation_count` remains unchanged
- package-only retained evidence from export-notes, unresolved-document artifacts, and size-mismatch artifacts is now preserved in PostgreSQL
- ordinary importer reruns do not rewrite `source_observation_link.mapper_key`, `mapper_version`, or `mapped_at`; remapping/version-history semantics remain deferred

Questions deliberately deferred beyond Phase B:

1. whether bucket-level or binary-level note targets justify a later workspace-safe extension
2. whether `work_group_document` needs extra audit fields such as `added_by` or membership note text once real usage appears
3. whether future case-specific document notes need a richer model that allows both `case_file_id` and `case_workspace_document_id` on the same note without weakening integrity

## Phase C1 Implementation Result

Implemented on 2026-08-31: Phase C1 schema only.

Implemented slice:

1. add `processing_job`
2. add `document_representation`
3. add `document_segment`
4. preserve the finalized `processing_job` active-work partial uniqueness rules
5. preserve the finalized `document_representation.produced_by_job_id` provenance link
6. update fresh bootstrap to match the migrated schema exactly

Validation outcome:

- live migration succeeded without changing existing canonical or provenance row counts
- `processing_job`, `document_representation`, and `document_segment` started empty on both migrated live schema and fresh bootstrap
- rollback-only integrity and delete/FK tests passed on both migrated live schema and fresh bootstrap
- consultation views remained unchanged from the accepted Phase B baseline
- successful-output idempotency remains a future enqueue/runtime responsibility and is not enforced by C1 SQL
- no queue helper, worker, backlog seeding, PDF processing, importer changes, or Directus runtime work was included

## Phase C3 Implementation Result

Implemented on 2026-08-31: durable asynchronous multi-representation processing on top of the existing C1 processing schema.

Implemented slice:

1. evolve `document_representation` to support:
   - `representation_source_kind`
   - `representation_variant_key`
   - `based_on_representation_id`
2. add `document_representation_selection`
3. add `document_representation_comparison`
4. add a small explicit processor registry for:
   - `docling`
   - `xberg`
   - `plain_text_passthrough`
5. add a PostgreSQL-backed worker/admin path for:
   - enqueue
   - durable claim
   - bounded retry
   - persisted failure
   - explicit abandoned-job recovery
6. add automatic representation selection with explicit-override support
7. add generic pairwise persisted representation comparison
8. add human-authored representation creation support without making human origin intrinsically preferred
9. keep consultation isolated from worker execution by reading persisted PostgreSQL/artifact state only

Validation outcome:

- consultation views remained unchanged while and after background processing
- the worker uses short claim/update transactions and does not hold a database transaction open for the duration of long Docling extraction
- Docling and Xberg both completed through the same generic processing boundary
- persisted comparison rows surfaced both low-disagreement and high-disagreement cases on representative PDFs
- automatic consultation selection currently prefers Docling when available and otherwise falls back predictably
- explicit human selection remains distinct from automatic policy; human representation existence alone does not override automatic selection
- failed extraction attempts remain persisted as failed jobs
- later explicit retries can create a new job row and succeed without overwriting the earlier failed history
- C2-local processor caches had to be reused directly for offline Docling execution in the restricted local environment; this preserves local-only processing without introducing external services
- no importer changes, no canonical schema changes, no consultation-view redesign, and no Phase D downstream extraction were included

## Summary

The repository can evolve safely if the work is staged as:

- Phase A1: application root and workspace membership
- Phase A2a: workspace references and workspace-document closure
- Phase A2b: manual documents and additive document provenance
- Phase A2c: work groups and workspace-level notes
- Phase B: acquisition/canonical mapping evidence layer
- Phase C1: processing-core schema
- Phase C2: multi-engine extraction evaluation/spike
- Phase C3: durable asynchronous processing, comparison, and representation selection
- Phase C3.1: binary-storage abstraction for processing consumers
- Phase C3.2: original-binary serving through `BinaryStore`
- next major sequence after the Phase C foundation:
  - Phase C4 thin corpus consultation MVP
  - Phase D search and retrieval foundation
  - Phase E incremental semantic enrichment
  - Phase F richer review and knowledge-workspace capabilities

The current next caution point is preserving explicit lineage from the selected `document_representation` into later search, retrieval, and enrichment derivations.
That is why the next roadmap steps should build on the completed Phase C foundation rather than reopen capture/import, canonical identity, or representation-selection semantics.

## Phase C3.1 Implementation Result

Implemented on 2026-08-31: a narrow binary-storage abstraction around the existing local `file_binary` storage resolution used by Phase C processing.

Implemented slice:

1. add a small `BinaryStore` boundary for processing consumers
2. implement `LocalBinaryStore` only
3. keep the existing `casework.file_binary` schema unchanged
4. keep current importer storage semantics unchanged
5. move worker-side processor input resolution from direct path construction to `BinaryStore.materialize(...)`
6. distinguish explicit storage/materialization failures from extractor failures in `processing_job.error_code`

Repository-specific storage finding:

- the current repository does not use a `file_binary.storage_uri` column
- the current local binary locator is:
  - `file_binary.storage_package_id`
  - `file_binary.storage_rel_path`
- local path resolution currently means:
  - resolve the imports root under `data/imports`
  - join `storage_package_id`
  - join `storage_rel_path`
  - reject paths that escape the imports root
- C3.1 intentionally wraps that existing mechanism rather than replacing it with fictitious provider-neutral storage fields

`BinaryStore` contract in the implemented slice:

- `materialize(fileBinary)` returns a usable local file materialization
- `exists(fileBinary)` checks local availability without changing canonical identity
- `verify(fileBinary)` validates the resolved local file against current canonical metadata when explicitly requested

`LocalBinaryStore` semantics in the implemented slice:

- `materialize(...)` returns the existing canonical local file path directly when it is readable
- no unnecessary copy is created for current local storage
- `release()` is a no-op for local canonical files
- future remote stores may later materialize temporary local copies behind the same boundary

Worker integration outcome:

- job claim and state updates remain short PostgreSQL transactions
- materialization and extraction still happen after the claim transaction has committed
- processors now consume `materializedBinary.localPath` rather than resolving `storage_package_id` / `storage_rel_path` themselves
- storage/materialization failure is persisted separately from extractor failure:
  - `binary_store_failed`
  - `processor_failed`

Integrity / privacy boundary:

- `file_binary.sha256` remains the immutable binary identity anchor
- storage location remains retrieval metadata, not identity
- C3.1 does not introduce any remote storage backend, cloud call, upload, or external document processing path
- current derived processing artifacts remain on the existing artifact storage path; C3.1 does not redesign artifact storage

Outcomes intentionally deferred beyond C3.1:

- any schema redesign of `file_binary` storage metadata
- any remote `BinaryStore` implementation such as Google Drive, S3, MinIO, or NAS
- any artifact-store abstraction for derived processor outputs
- any importer change to route binary writes through a generalized store

## Phase C3.2 Implementation Result

Implemented on 2026-08-31: original-binary serving now consumes the same `BinaryStore` boundary already used by the Phase C processing path.

Implemented slice:

1. route `app/file-gateway.mjs` through `BinaryStore.materialize(...)`
2. preserve the existing SHA-based gateway route and streaming behavior
3. keep the current `file_binary.storage_package_id` + `storage_rel_path` schema unchanged
4. keep importer, processing schema, and legacy Phase C2 spike code unchanged

Serving boundary outcome:

- original binary serving no longer reconstructs the imports-root path directly inside `app/file-gateway.mjs`
- the gateway now resolves the canonical `file_binary` row, delegates local file retrieval to `BinaryStore`, streams the materialized local path, and releases the materialization after response completion
- this means both active byte-consuming paths now share the same storage boundary:
  - Phase C processing
  - original-binary serving

HTTP compatibility outcome:

- SHA-based lookup remains unchanged
- route shape remains `/binary/<sha256>`
- status-code behavior for not-found and invalid-path cases remains compatible
- content headers and streaming behavior remain unchanged
- no remote storage or provider-specific metadata was introduced

Remaining intentional limitation:

- `app/phase-c2-spike.mjs` still performs direct local path resolution because it remains historical evaluation tooling rather than an active runtime serving or processing boundary

## Phase C5.2 Implementation Result

Implemented on 2026-09-01: header/footer preservation without mutating historical representation identity.

Implemented slice:

1. keep historical successful `document_representation` rows and artifacts immutable
2. introduce new Docling/Xberg representation identities for the preservation-policy change:
   - Docling profile `docling-preserve-furniture-v2`, version `2.123.1-c5.2`
   - Xberg profile `xberg-preserve-furniture-v2`, version `1.0.14-c5.2`
3. keep readable Markdown body-oriented for Docling
4. keep `format=text` on the consultation path backed by `document_segment` content rather than redefining it as complete text
5. add a distinct durable `complete-text` artifact exposed through the representation-artifact access layer
6. configure Xberg explicitly to preserve headers/footers instead of relying on library defaults
7. preserve old representations as valid historical outputs while allowing new same-binary C5.2 representations to coexist

Artifact semantics implemented:

- `text.txt` keeps its prior plain-text/body-oriented role for current processor output compatibility
- `complete-text.txt` is the new explicit completeness/search/reference-recovery artifact
- `markdown.md` remains the readable body-oriented projection
- `native.json` remains the structured/native extractor artifact
- older successful representations that predate C5.2 do not claim `complete-text` unless that artifact actually exists

Extractor behavior implemented:

- Docling now produces:
  - body-oriented text from `ContentLayer.BODY`
  - body-oriented Markdown from `ContentLayer.BODY`
  - complete text from `ContentLayer.BODY + ContentLayer.FURNITURE`
- Xberg now runs with explicit preservation-oriented content filtering:
  - `include_headers = true`
  - `include_footers = true`
  - `strip_repeating_text = false`
  - `include_watermarks = false`
- current Xberg C5.2 output writes both `text.txt` and `complete-text.txt` with the same preserved text content; this preserves the explicit complete-text artifact contract without inventing Docling-style layer semantics that Xberg does not expose
- when Xberg output contains PostgreSQL-incompatible `U+0000` characters, the original derived artifact remains unchanged while only the `document_segment.text_content` projection removes those characters; representation metadata records an explicit persistence warning, the removed-character count, and that the source artifact was preserved

Validation outcome:

- older successful Docling/Xberg representations remained unchanged on disk and in PostgreSQL
- new C5.2 processing created distinct new representations instead of overwriting older artifacts
- the new `complete-text` artifact became available through the existing representation-content path
- consultation/UI format handling remained compatible while allowing explicit `complete-text` access
- real-document checks confirmed previously de-emphasized header/footer reference data was preserved in the new artifacts
- no schema changes, importer changes, storage redesign, or `pdftotext` productionization were included

## Phase C5.3.1 Implementation Result

Implemented on 2026-09-01: the first bounded PDF evidence-artifact slice parallel to the existing Docling/Xberg interpretation path.

Implemented slice:

1. add machine-generated PDF evidence representations with distinct `representation_kind` values:
   - `pdf_literal_text`
   - `pdf_signature_metadata`
   - `pdf_structure_inventory`
   - `pdf_ocr_text`
2. add a narrow Windows-local PDF evidence extraction helper around:
   - `pdftotext`
   - `pdfinfo`
   - `qpdf`
3. keep OCR evidence as a distinct Docling-based processor/profile rather than folding it into native PDF text
4. keep consultation selection/comparison restricted to the existing readable `extracted_document_bundle` kind so evidence artifacts do not become the default consultation interpretation
5. preserve the existing processing execution model, worker boundary, canonical schema, importer behavior, and representation-content API contract

Artifact semantics implemented:

- `pdf_literal_text`
  - preserves low-level literal PDF text via `pdftotext -layout`
  - is not authoritative reading order or semantic structure
  - an empty result means the selected literal-text extractor produced no text under that profile, not that the PDF contains no text in any channel
- `pdf_signature_metadata`
  - preserves signature-field and signature-dictionary facts such as field identity, populated state, `/ByteRange`, `/M`, signer name, reason, location/contact fields where present
  - does not imply cryptographic validation, trust-chain validation, revocation checking, or legal validity
  - certificate metadata remains explicitly best-effort and is currently left `unknown` under the Windows-local first slice
- `pdf_structure_inventory`
  - preserves a compact tri-state channel inventory for native text, page-raster content, annotations, widgets/AcroForm, signature fields/dictionaries, and embedded-file indicators
  - distinguishes `present`, `absent`, and `unknown` rather than collapsing non-inspection into `false`
- `pdf_ocr_text`
  - preserves OCR-derived page-visible text separately from native PDF text
  - is currently limited to the existing readability classes:
    - `image_only_pdf`
    - `mostly_image_pdf`
  - does not introduce a new generalized text-strength heuristic

Validation outcome:

- the signed regression PDF `6836f8732aae33a3bc79491748134bd2a77a7b48aeaa2cd7c66647ff1f468f1c` now preserves:
  - visible signature appearance text through `pdf_literal_text`
  - separate structural signature facts through `pdf_signature_metadata`
  - explicit channel presence through `pdf_structure_inventory`
- the native-text PDF `00445e909e62504134764a6c333277a3b90d1346a9da17f7c0de2529dbbe277e` produced a narrow literal-text artifact and a structure inventory that correctly reported no forms or signatures
- the image-heavy PDF `02c8e7cee7eca2f83b98d64aa2dd64b1b888039210a8cbf5c2133322d1b1757e` preserved:
  - minimal native literal text
  - image-heavy structure inventory
  - a distinct OCR artifact with substantial rendered-page text
- existing Docling/Xberg interpretation identities and artifacts remained unchanged
- consultation/API regression tests remained green after filtering evidence kinds out of default consultation selection
- no schema changes, bootstrap changes, importer changes, canonical-row changes, or full-corpus rollout were included

Intentional current limits:

- no certificate trust-chain or revocation validation
- no generalized annotation-content persistence
- no embedded-file extraction beyond structure-inventory indicators
- no revision-chain persistence
- no blended search text or semantic/legal extraction

## Phase C5.3.2 Direction

The next PDF-evidence step should be framed narrowly as:

- targeted rollout and implementation validation

It should not be framed as a second broad investigation into whether the newly surfaced evidence channels matter.
That question is already answered strongly enough by the completed C5.3 investigation and the C5.3.1 implementation checks.

The purpose of the next bounded step is instead to validate the implemented boundary across representative real PDFs and determine where the first implementation policy is insufficient.

Core questions for that next step:

1. Does the C5.3.1 implementation produce the intended artifacts reliably across representative PDF classes?
2. Are artifact semantics and provenance correct in practice?
3. How often does `pdf_literal_text` materially add evidence beyond current interpretation artifacts?
4. Does the current OCR gating policy behave correctly on:
   - `image_only_pdf`
   - `mostly_image_pdf`
5. Are signature and structure inventories accurate across:
   - ordinary PDFs
   - signed PDFs
   - multi-signature PDFs
   - unusual/problematic PDFs
6. Are there concrete failure modes that justify correcting C5.3.1 before broader rollout?
7. Which deferred evidence channel, if any, is now the next highest-value implementation target?

Minimal CLI/inspection support is reasonable in that step, but it should remain validation tooling rather than consultation UX or search consumption.

## Targeted Multi-Binary Factual Export Result

Implemented on 2026-09-02 as a bounded local export slice:

- package format `virgilio-factual-export`, version 1, groups an explicit set of
  binaries under one immutable export root
- each `binaries/<sha256>/` directory reuses the verified one-binary portable
  evidence package rather than duplicating original/artifact copying semantics
- package-level CSV indexes expose binary, factual context, representation, and
  failed-job records for file-based consultation
- the package manifest records explicit selection scope, generated index hashes,
  nested manifest hashes, and per-binary counts
- standalone inspection verifies package-level files and recursively verifies
  every nested original and representation artifact
- the exporter is read-only with respect to PostgreSQL and retrieves originals
  through the existing `BinaryStore` boundary
- no Google Drive authentication, upload, permission, synchronization, or remote
  storage behavior is included in this slice
- portable factual exports omit `bucket.displayed_bucket_size_bytes`; the
  imported corpus has this field uniformly null despite upstream observations
  containing values for most buckets, so the incomplete field is not presented
  as factual absence and canonical imported state remains unchanged
- a separate AI-consultation projection may be generated from a verified factual
  package; it exposes originals, concise source-facing context, useful extracted
  representations, and disagreement warnings while excluding internal IDs,
  processing history, nested manifests, and diagnostic artifacts
