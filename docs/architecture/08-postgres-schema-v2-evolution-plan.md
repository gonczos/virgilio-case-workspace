# PostgreSQL Schema V2 Evolution Plan

Last updated: 2026-08-30

## Status

This document is the concrete phased plan for evolving the PostgreSQL application database in `virgilio-case-workspace`.

It is based on:

- [07-consolidated-architecture-reference.md](D:\attila\projects\virgilio-case-workspace\docs\architecture\07-consolidated-architecture-reference.md)
- the current PostgreSQL schema in `db/init/001-bootstrap.sql`
- the current portable-package importer in `app/import-package.mjs`
- the current import contract in `docs/architecture/02-import-contract.md`
- the currently imported Portuguese package and live PostgreSQL data

This is a planning document.
It does not itself perform schema changes.

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

- `import_batch`
- `country`
- `court`
- `case_file`
- `bucket`
- `document`
- `bucket_document`
- `file_binary`
- `document_binary`
- `consultation_note`
- `document_issue`

Current legacy/package importer behavior:

1. validate package shape
2. upsert `import_batch`
3. upsert `court`
4. upsert `case_file`
5. resolve `parent_case_file_id`
6. upsert `bucket`
7. upsert `document`
8. upsert `bucket_document`
9. upsert `file_binary`
10. upsert `document_binary`
11. commit one transaction

Current portable package shape:

- `package.json`
- `cases/*.jsonl`
- `files/sha256/...`
- `artifacts/*`
- `provenance/export-notes.json`

Current package/import provenance already retained:

- package manifest fields in `import_batch.package_metadata_json`
- on-disk `package.json`
- on-disk `provenance/export-notes.json`
- canonical source-facing fields on `case_file`, `bucket`, `document`
- narrow observation signal on `bucket_document.source_observation_count`

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

1. Exact lifecycle value set for `case_workspace.lifecycle_status`.
2. Exact taxonomy for `document_origin.origin_kind`.
3. Whether imported `document_origin` rows are backfilled in Phase A or added immediately after in Phase B.
4. Exact partial unique/index strategy on `document` so imported guarantees remain strict while manual documents become possible.
5. Whether `processing_result` should duplicate target FKs or reference target only through `processing_job`.
6. Whether `document_segment` should store large extracted text inline or via separate artifact references for very large formats.
7. The exact direction/cardinality between `source_capture` and `import_batch`.

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

Implement after A2b:

- `work_group`
- `work_group_document`
- workspace/group expansion of `consultation_note`

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

### Tables

#### New `source_capture`

Purpose:

- acquisition event or source snapshot

Columns:

- `id BIGSERIAL PRIMARY KEY`
- `source_system TEXT NOT NULL`
- `capture_kind TEXT NOT NULL`
- `external_source_label TEXT NULL`
- `captured_at TIMESTAMPTZ NOT NULL`
- `scraper_key TEXT NULL`
- `scraper_version TEXT NULL`
- `source_locator TEXT NULL`
- `metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb`
- `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`

Constraints:

- `CHECK (capture_kind IN ('portable_package_export','live_scrape_snapshot','manual_source_capture'))`

Indexes:

- `ix_source_capture_source_system`
- `ix_source_capture_captured_at`

Classification:

- source capture / ingestion provenance

Open Phase B issue to resolve before implementation:

- revisit the direction/cardinality between `source_capture` and `import_batch`
- conceptually source capture precedes import execution
- the same captured package may potentially be imported multiple times
- do not collapse this accidentally into `source_capture.import_batch_id`

The likely repository-safe direction is:

- `import_batch` references a `source_capture`
- or a separate link table relates them

This must be resolved before DDL.

#### New `source_observation`

Purpose:

- a source-observed object/occurrence as shown by the external source or captured package evidence

Columns:

- `id BIGSERIAL PRIMARY KEY`
- `source_capture_id BIGINT NOT NULL`
- `observation_kind TEXT NOT NULL`
- `source_native_id TEXT NULL`
- `parent_source_native_id TEXT NULL`
- `source_path TEXT NULL`
- `display_title TEXT NULL`
- `display_status TEXT NULL`
- `display_date TEXT NULL`
- `display_order INTEGER NULL`
- `payload_json JSONB NOT NULL DEFAULT '{}'::jsonb`
- `observed_at TIMESTAMPTZ NULL`
- `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`

Constraints:

- `FOREIGN KEY (source_capture_id) REFERENCES casework.source_capture(id)`
- `CHECK (observation_kind IN ('case_row','bucket_row','document_occurrence','package_artifact'))`

Indexes:

- `ix_source_observation_source_capture_id`
- `ix_source_observation_observation_kind`
- `ix_source_observation_source_native_id`
- `ix_source_observation_parent_source_native_id`

Classification:

- source observation

#### New `source_observation_link`

Purpose:

- mapping provenance from a source observation to a canonical entity

Columns:

- `id BIGSERIAL PRIMARY KEY`
- `source_observation_id BIGINT NOT NULL`
- `case_file_id BIGINT NULL`
- `bucket_id BIGINT NULL`
- `document_id BIGINT NULL`
- `mapping_kind TEXT NOT NULL`
- `mapper_key TEXT NOT NULL`
- `mapper_version TEXT NOT NULL`
- `mapped_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
- `mapping_confidence TEXT NOT NULL`
- `mapping_note TEXT NULL`

Constraints:

- `FOREIGN KEY (source_observation_id) REFERENCES casework.source_observation(id)`
- FKs to `case_file`, `bucket`, `document`
- `CHECK` exactly one canonical target FK is non-null
- `CHECK (mapping_kind IN ('normalized_to_case_file','normalized_to_bucket','normalized_to_document'))`

Indexes:

- `ix_source_observation_link_source_observation_id`
- `ix_source_observation_link_case_file_id`
- `ix_source_observation_link_bucket_id`
- `ix_source_observation_link_document_id`
- `ix_source_observation_link_mapper_key`

Classification:

- canonical mapping provenance

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

Smallest viable Phase B backfill for current data:

1. create one `source_capture` row for the currently imported package/export
2. create coarse `source_observation` rows from package-level canonical payloads where useful
3. create `source_observation_link` rows to canonical entities

Important limitation:

- current package contract does not include full raw scrape observation rows
- therefore Phase B backfill will preserve package-export observation lineage, not reconstruct every original live scrape detail

### Importer Enhancement

Required in Phase B:

- create/find `source_capture`
- create `source_observation` rows from package payload records
- create `source_observation_link` rows during canonical upsert mapping

Recommended mapper fields:

- `mapper_key = 'app/import-package.mjs'`
- `mapper_version = importer/schema version string`

### Directus Impact

- not necessary for first consultation UI
- useful later for audit/admin views

### Validation Queries / Invariants

- observation links map to exactly one canonical entity
- source capture and import execution are distinguishable
- canonical counts do not change due to Phase B

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

Columns:

- `id BIGSERIAL PRIMARY KEY`
- `file_binary_id BIGINT NOT NULL`
- `representation_kind TEXT NOT NULL`
- `format_family TEXT NOT NULL`
- `processor_key TEXT NOT NULL`
- `processor_version TEXT NOT NULL`
- `status TEXT NOT NULL`
- `metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb`
- `content_json JSONB NULL`
- `artifact_rel_path TEXT NULL`
- `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`

Constraints:

- `FOREIGN KEY (file_binary_id) REFERENCES casework.file_binary(id)`
- `CHECK (status IN ('pending','completed','failed','superseded'))`

Indexes:

- `ix_document_representation_file_binary_id`
- `ix_document_representation_format_family`
- `ix_document_representation_processor`

Unique:

- `UNIQUE (file_binary_id, representation_kind, processor_key, processor_version)`

Classification:

- machine-derived

#### New `document_segment`

Columns:

- `id BIGSERIAL PRIMARY KEY`
- `document_representation_id BIGINT NOT NULL`
- `segment_kind TEXT NOT NULL`
- `sequence_no INTEGER NOT NULL`
- `text_content TEXT NULL`
- `structural_path TEXT NULL`
- `page_no INTEGER NULL`
- `sheet_name TEXT NULL`
- `bbox_json JSONB NULL`
- `char_start INTEGER NULL`
- `char_end INTEGER NULL`
- `metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb`
- `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`

Constraints:

- `FOREIGN KEY (document_representation_id) REFERENCES casework.document_representation(id)`

Unique:

- `UNIQUE (document_representation_id, sequence_no)`

Indexes:

- `ix_document_segment_representation_id`
- `ix_document_segment_page_no`

Classification:

- machine-derived

#### New `processing_job`

Columns:

- `id BIGSERIAL PRIMARY KEY`
- `stage_key TEXT NOT NULL`
- `status TEXT NOT NULL`
- `file_binary_id BIGINT NULL`
- `document_id BIGINT NULL`
- `document_representation_id BIGINT NULL`
- `processor_key TEXT NOT NULL`
- `processor_version TEXT NOT NULL`
- `requested_by TEXT NULL`
- `requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
- `claimed_at TIMESTAMPTZ NULL`
- `started_at TIMESTAMPTZ NULL`
- `completed_at TIMESTAMPTZ NULL`
- `attempt_count INTEGER NOT NULL DEFAULT 0`
- `max_attempts INTEGER NOT NULL DEFAULT 3`
- `error_code TEXT NULL`
- `error_text TEXT NULL`
- `depends_on_job_id BIGINT NULL`
- `stale_after TIMESTAMPTZ NULL`

Constraints:

- FKs to `file_binary`, `document`, `document_representation`, `processing_job`
- `CHECK` exactly one target FK is non-null
- `CHECK (status IN ('queued','claimed','running','completed','failed','cancelled','blocked'))`

Indexes:

- `ix_processing_job_status`
- `ix_processing_job_stage_key`
- `ix_processing_job_claimable`
- `ix_processing_job_file_binary_id`
- `ix_processing_job_document_id`
- `ix_processing_job_document_representation_id`
- `ix_processing_job_depends_on_job_id`

Uniqueness / idempotency:

- partial unique index preventing duplicate active jobs for same target/stage/processor version where status in `('queued','claimed','running')`

Classification:

- machine operational state

#### New `processing_result`

Columns:

- `id BIGSERIAL PRIMARY KEY`
- `processing_job_id BIGINT NOT NULL`
- `result_status TEXT NOT NULL`
- `payload_json JSONB NOT NULL DEFAULT '{}'::jsonb`
- `artifact_rel_path TEXT NULL`
- `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`

Constraints:

- `FOREIGN KEY (processing_job_id) REFERENCES casework.processing_job(id)`
- `CHECK (result_status IN ('produced','no_output','failed_snapshot'))`

Indexes:

- `ix_processing_result_processing_job_id`

Classification:

- machine-derived operational record

### Job Lifecycle / Worker Semantics

Lifecycle:

- `queued`
- `claimed`
- `running`
- `completed`
- `failed`
- `cancelled`
- `blocked`

Atomic claiming:

- use `FOR UPDATE SKIP LOCKED`
- claim only eligible `queued` jobs whose dependencies are satisfied

Retry semantics:

- on failure increment `attempt_count`
- if `attempt_count < max_attempts`, return to `queued`
- otherwise mark `failed`

Idempotency:

- one active job per target/stage/processor version
- outputs versioned by processor and representation uniqueness

Staleness / reprocessing:

- a newer processor version or stale source can enqueue new jobs
- older outputs are not overwritten destructively; they become superseded by policy

Dependency handling:

- `depends_on_job_id` is sufficient for initial sequential dependencies
- do not build a full DAG engine yet

### Importer Enhancement

None required in Phase C if backlog seeding is a separate script.

Optional later:

- importer may enqueue initial binary jobs after importing `file_binary`

### Directus Impact

- new tables do not need immediate UI exposure
- minimal admin views later for job status are useful

### Validation Queries / Invariants

- every `processing_job` has exactly one target FK
- no duplicate active jobs for same target/stage/processor version
- every `document_segment` belongs to a valid `document_representation`

### Completion Criteria

Phase C is complete when:

- processing tables exist with FK integrity
- a claimable job model is in place
- representation/segment model exists without assuming pages are universal
- backlog can be seeded from current `file_binary`

## Phase D: First Concrete PDF Processing Plus Existing Corpus Backlog

### Goal

Validate the processing framework on the current corpus using PDF as the first high-priority processor.

### Initial PDF Path

Stages:

1. `IDENTIFY_FORMAT`
2. `VERIFY_BINARY`
3. `EXTRACT_STRUCTURE`
4. `OCR_FALLBACK` where needed
5. `NORMALIZE_CONTENT`

Phase D can collapse some of these into fewer concrete processors initially, but job stages should remain capability-based.

### Existing Corpus Backlog

Seed backlog from existing `file_binary` rows:

- all binaries with `mime_type = 'application/pdf'`
- or `file_extension = '.pdf'`
- or both with safety checks

No re-import required.

### Verification / Inspection

Use current `file_binary` metadata as hints, not as final truth.

Verify:

- binary file exists at resolved path
- file hash and size still align where expected
- PDF opens successfully

### Native Text Inspection / OCR Need Detection

For PDFs:

- inspect page count
- inspect extractable text presence/quality
- mark representation metadata with OCR-needed cues

Do not assume:

- non-empty text means high quality

Suggested metadata outcomes:

- `text_quality = good | suspect | empty`
- `ocr_needed = true | false | partial`

### Representation / Segment Creation

For PDFs:

- create one `document_representation` per processor version
- create `document_segment` rows with page-aware metadata where appropriate

Page is allowed here as segment metadata because it is format-specific, not universal.

### Failure Isolation

Failures should be isolated per binary/job.

Examples:

- missing file
- invalid PDF
- extractor crash
- OCR timeout

Do not block the whole backlog because one file fails.

### Safe Restart / Resume

Required behavior:

- claimable queued jobs
- active-job uniqueness
- retries bounded by `max_attempts`
- rerun based on processor version or stale policy

### Processor-Version-Driven Reprocessing

When processor version changes:

- enqueue new jobs for same target/stage with new version
- preserve older representations/results
- mark supersession through policy, not destructive overwrite

### Importer Enhancement

None required for initial Phase D if backlog seeding is external.

Later optional improvement:

- enqueue `IDENTIFY_FORMAT` / `VERIFY_BINARY` after legacy/package import

### Directus Impact

- no immediate dependency
- later useful to surface:
  - processing status
  - extracted coverage
  - OCR-needed items
  - failed items

### Validation Queries / Invariants

- every qualifying PDF `file_binary` has at least one queued or completed initial job
- completed extraction jobs produce exactly one `document_representation` for target/processor version
- representation/segment counts are stable under rerun with same version
- failed jobs do not remove prior successful outputs

### Completion Criteria

Phase D is complete when:

- existing imported PDFs can be queued without re-import
- a first PDF processor can verify, inspect, extract, and segment
- OCR-needed PDFs are distinguished
- failures are isolated and resumable
- rerun/version behavior is demonstrably idempotent

## Recommended Migration Sequence

1. Phase A1 PostgreSQL schema migration
2. Phase A1 PostgreSQL backfill and validation
3. minimum importer enhancement for Phase A1 compatibility
4. later Phase A2 PostgreSQL schema evolution
5. Phase B PostgreSQL schema migration
6. Phase B PostgreSQL backfill from current package/import data
7. Phase B importer enhancement
8. Phase C PostgreSQL schema migration
9. backlog seeding utility for existing `file_binary`
10. Phase D PDF worker implementation on a small sample
11. Phase D full PDF backlog rollout

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
   - later `work_group`
   - later `work_group_document`
   - later `consultation_note` additions

5. `2026-08-xx-007-phase-b-source-provenance.sql`
   - `source_capture`
   - `source_observation`
   - `source_observation_link`

6. `2026-08-xx-008-phase-c-processing-core.sql`
   - `document_representation`
   - `document_segment`
   - `processing_job`
   - `processing_result`

Implementation files:

- importer enhancements in `app/import-package.mjs`
- later backlog/enqueue utility in `app/` or `scripts/`
- later worker implementation in a separate module, not Directus

## First Implementation Slice Recommended

Start with Phase A1 only.

Implementation slice:

1. add `case_workspace`
2. add `case_file.case_workspace_id`
3. backfill workspace from explicit `parent_case_file_id` tree
4. validate no official relationship changed
5. make the minimum importer enhancement required for future compatibility

Why this slice first:

- it is the smallest high-value extension
- it proves the new application root without touching imported `document` guarantees
- it creates the anchor needed by later provenance and manual-document work

## Questions That Genuinely Block Starting Phase A1

None block Phase A1 if the slice is limited to:

- `case_workspace`
- `case_workspace_id`
- recursive PT backfill
- minimum importer enhancement

Questions that block Phase A2b implementation:

1. final `document_identity_class` value set
2. final imported-only partial unique index definition for `document`
3. whether the initial workspace-native document flow needs any additional non-importer write-path metadata beyond `document_origin`

Questions deliberately deferred to Phase A2c:

1. final `work_group` shape
2. exact database-enforced workspace-integrity pattern for `work_group_document`
3. whether `consultation_note` should target workspace, work group, or both

## Summary

The repository can evolve safely if the work is staged as:

- Phase A1: application root and workspace membership
- Phase A2a: workspace references and workspace-document closure
- Phase A2b: manual documents and additive document provenance
- Phase A2c: work groups and workspace-level notes
- Phase B: acquisition/canonical mapping evidence layer
- Phase C: processing orchestration and derived content infrastructure
- Phase D: first PDF processor and backlog rollout

The next caution point is the `document` identity transition, not workspace membership.
That is why A2b should stay focused on manual-document enablement and additive provenance before grouping and note expansion.
