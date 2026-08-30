# Consolidated Architecture Reference

Last updated: 2026-08-30

## Status

This document is the current architectural reference for `virgilio-case-workspace`.

It supersedes the earlier discussion handoff in `docs/discussions/virgilio-architecture-handoff-v2.md` by incorporating:

- the repository-grounded schema-v2 review;
- the workspace/proceeding/provenance refinements made after that review;
- the acquisition/source-observation separation;
- the format-agnostic processing clarification.

It is still a design/reference document.
It does not itself implement schema or application changes.

## Purpose

The repository began as a consultation layer over an imported Portuguese court corpus.

That corpus remains important, but it does not define the boundaries of the application.
The application must grow into a legal case workspace backed by a provenance-rich document archive.

That means the system must support:

- imported official proceedings and their court structure;
- manual/user material attached to those proceedings;
- partially known proceedings with incomplete official data;
- prospective cases before an official filing exists;
- format-agnostic stored-file processing;
- later search, graph, and AI layers without collapsing provenance.

## Architectural Position

The current repository already has a strong canonical import core.

Existing canonical/source-oriented entities:

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

These should not be discarded or casually generalized.
They are the stable base for imported official data.

The architectural goal is therefore not a greenfield redesign.
It is the smallest extensible evolution of the existing canonical import system.

## Architectural Invariants

Unless later repository evidence proves a stronger alternative, these invariants should hold:

1. Imported canonical facts remain authoritative source-derived facts.
2. User organization must not masquerade as official court structure.
3. Provenance is additive, not destructive.
4. Logical document identity is distinct from binary identity.
5. SHA-256 binary dedupe remains cross-origin.
6. Acquisition/import is distinct from canonical interpretation.
7. Processing is acquisition-origin agnostic.
8. Processing outputs are idempotent and versioned.
9. AI output remains derived and attributable.
10. Retrieval must preserve source/document/segment provenance.
11. Directus is UI/admin/API, not the processing engine.
12. Search, worker, MCP, and AI layers are replaceable consumers, not foundational data models.

## Three Explicit Layers

The architecture should explicitly distinguish three technical layers before later AI/search layers are added.

### 1. Source capture / source observation

This layer records what an external source exposed, when, and how it was captured.

Examples:

- source-specific IDs
- entry numbers
- display ordering
- displayed titles/status/dates
- source URLs or locators
- scraper/importer version
- capture timestamp
- raw package/page metadata where worth preserving

This layer exists so the system can later answer:

- what the source showed;
- what the scraper captured;
- what the importer interpreted;
- what is currently canonical.

### 2. Canonical legal/application model

This layer contains the normalized legal/application entities used for consultation and management.

Examples:

- `case_workspace`
- `case_file`
- `bucket`
- `document`
- `document_origin`
- `work_group`

This is where imported official structures and broader case-work structures coexist, but with distinct semantics.

### 3. Stored-file processing

This layer starts from stored binaries and produces normalized content and downstream derived artifacts.

Examples:

- `file_binary`
- `document_representation`
- `document_segment`
- processing jobs/results

This layer must be format-agnostic at the orchestration level.

## Source Capture Is Not The Same Thing As Import Execution

`import_batch` already preserves package-level provenance and should remain.

But `import_batch` is not enough to answer the full acquisition-evidence question.
It records that a package was imported, not necessarily every distinct source capture or source observation embedded in or related to that package.

Important distinction:

- `source_capture`: an acquisition event or source snapshot
- `import_batch`: an execution event importing a portable package into this repository
- canonical mapping: the importer’s interpretation of captured/source-observed data
- `document_origin`: provenance and occurrence of a logical document within work/legal context

These are related but not interchangeable.

The architecture should therefore not assume `source_capture` is 1:1 with `import_batch`.

## Case Model

### `case_workspace`

`case_workspace` is the application-level legal workspace.

It is the root that should exist:

- before filing;
- without an official case number;
- with only partial external information;
- with zero, one, or many official proceedings;
- through prospective, preparing, filed, active, and closed phases.

This is the main application root.
It is not an imported source concept.

### `case_file`

`case_file` remains an official proceeding record.

It is the canonical representation of a sourced/imported legal proceeding.
It should keep its source-side identity and procedural semantics.

It should not be redefined as the broader application root.

### `case_workspace_id` vs `parent_case_file_id`

These fields have different meanings and both should exist:

- `case_workspace_id`: which broader application workspace this proceeding belongs to
- `parent_case_file_id`: the procedural/source relationship between official `case_file` records

`case_workspace_id` must not replace `parent_case_file_id`.

## Current PT Backfill Rule

For the current Portuguese corpus, workspace backfill should use the explicit stored `case_file` parent/descendant tree, not process-number suffix guessing.

Current known family:

- `13608/14.8T2SNT` is the base case
- `13608/14.8T2SNT-A` is a descendant
- `13608/14.8T2SNT-C` is a descendant
- `13608/14.8T2SNT-D` is a descendant
- `13608/14.8T2SNT-E` is a descendant

The backfill rule is:

- create one `case_workspace` for each base/root `case_file`;
- assign that workspace to the root and all transitive descendants reachable through `parent_case_file_id`.

Even though the current data appears to have one descendant level, the rule should support deeper chains transitively.

No higher umbrella above `case_workspace` should be introduced at this stage.

## Bucket Semantics

`bucket` remains source-specific.

It represents an imported court-side grouping/event container.
Its current fields are strongly tied to source observation and imported legal structure.

That is useful and should be preserved.

It should not be overloaded to represent:

- hearing-preparation bundles
- evidence packs
- research groups
- manual correspondence bundles

Those are user organization concerns, not official court structure.

## User Organization

### `work_group`

User organization should be represented by a separate `work_group` concept.

Typical uses:

- hearing preparation
- evidence selection
- chronology packs
- research bundles
- question lists
- draft packs
- correspondence bundles

### M:N document organization

Document membership in work groups should be many-to-many.

The same document may simultaneously belong to:

- the broader workspace;
- one or more hearing-preparation groups;
- an evidence bundle;
- a chronology pack.

This is a different concern from official bucket membership.

## Documents, Binaries, And Provenance

### Logical document identity

`document` is the logical document entity.

It should remain the shared logical document layer across:

- imported official material;
- manually received material;
- user-authored work product;
- later machine-derived document-like artifacts where appropriate.

However, its current uniqueness assumptions are still too imported-source oriented and should later be relaxed so imported identity remains preserved without becoming the universal rule for all documents.

### Binary identity

`file_binary` is the stored-file identity.

It is already correctly anchored by `sha256` and should remain the cross-origin dedupe anchor.

This is one of the strongest parts of the current repository model and should be preserved unchanged in principle.

### Additive `document_origin`

`document_origin` should be added as an additive provenance/occurrence layer.

Its purpose is to record how a logical document entered or appeared in the system, for example:

- official import
- manual received
- user authored
- external correspondence

Key point:

A document may have multiple origins/occurrences over time.
If a manually received document later also appears in an official proceeding/bucket, the system should add provenance, not rewrite history.

### Official membership vs broader provenance

Official bucket membership and broader provenance are related but distinct:

- `bucket_document` preserves imported official occurrence within source court structure
- `document_origin` preserves additive provenance and contextual occurrence

They should coexist.

## Acquisition Evidence And Canonical Mapping

The current package/import path retains some evidence already:

- package-level metadata in `import_batch.package_metadata_json`
- canonical source-facing fields in `case_file`, `bucket`, and `document`
- artifacts stored in imported packages on disk
- narrow observation facts such as `bucket_document.source_observation_count`

That is useful, but not enough to preserve acquisition evidence as a first-class queryable layer.

The repository should therefore later add a narrow source-observation layer.

Recommended concepts:

- `source_capture`: what acquisition event or source snapshot was captured
- `source_observation`: what the source showed
- `source_observation_link`: how source observations mapped into canonical entities

This is not intended to duplicate the entire canonical schema.
It is intended to preserve source evidence and the mapping boundary.

## Processing Must Be Format-Agnostic

The current corpus is predominantly PDF, but the architecture must not be PDF-only.

Expected formats include at least:

- PDF
- DOCX
- TXT / Markdown
- images
- email files
- spreadsheets
- potentially other office or exported formats

Therefore:

- PDF is the first/high-priority processor
- PDF is not the universal processing model

The orchestration model should be:

```text
file_binary
-> identify content/format
-> choose format-specific inspector/extractor
-> produce normalized representation
-> run common downstream stages
```

Examples:

- PDF: native extraction plus selective OCR
- DOCX: paragraph/heading/table extraction
- TXT/Markdown: minimal extraction
- image: OCR
- email: headers/body plus later attachment extraction
- spreadsheet: sheet/table-aware extraction

## `document_representation` And `document_segment`

To avoid a PDF-page-only model, the content layer should use a general representation/segment abstraction.

### `document_representation`

Purpose:

- one normalized extracted representation of a binary for a given processor/version

Examples:

- PDF text/structure representation
- DOCX structural representation
- email header/body representation
- OCR text representation for an image
- spreadsheet structural representation

### `document_segment`

Purpose:

- normalized content fragments emitted from a representation

Important principle:

Pages are optional metadata, not the universal structural unit.

Depending on format, segments may represent:

- pages
- paragraphs
- headings
- table cells or rows
- email headers/body blocks
- sheet/table fragments
- OCR regions

So `page_no` belongs as optional metadata where applicable, not as the core abstraction.

## Compound / Container Material

The model should leave room for compound/container material such as:

- email with attachments
- archives
- embedded extracted files

This does not need to be implemented immediately.
But the document/binary/provenance model should be compatible with later decomposition into independently addressable child documents/binaries while preserving parent-child relationships.

The likely later mechanism is a relation layer such as:

- `document_relation`
- or `binary_relation`

Possible relation kinds:

- `contains_attachment`
- `embedded_in`
- `extracted_from`

For now, the architecture should leave room for this without forcing it into the first migration.

## Processing Job Model

Processing should be modeled by capability/stage, not by hard-coded PDF assumptions.

Illustrative stages:

- `IDENTIFY_FORMAT`
- `VERIFY_BINARY`
- `EXTRACT_STRUCTURE`
- `OCR_FALLBACK`
- `NORMALIZE_CONTENT`
- `CHUNK`
- `INDEX_FTS`
- `EMBED`
- `REFERENCE_DETECTION`
- `AI_METADATA`

## Typed Processing Targets

The processing job model should prefer typed nullable FKs plus a CHECK constraint that exactly one target is populated, rather than a polymorphic `target_kind + target_id` pair.

Why:

- real PostgreSQL referential integrity
- better SQL joins and indexing
- safer cleanup and migration behavior
- better fit for a provenance-heavy legal-data system

Trade-off:

- a polymorphic key is more theoretically extensible
- typed FKs require schema change when a truly new target class is added

Recommended decision:

- choose typed target FKs
- accept occasional schema extension in exchange for integrity

Likely initial target types:

- `file_binary`
- `document`
- `document_representation`
- optionally `document_segment` later

## Processing Target Boundaries

### `file_binary`-targeted processing

Use for:

- binary verification
- format detection
- low-level inspection
- native extraction
- OCR
- normalized representation generation

### `document_representation`-targeted processing

Use for:

- chunk preparation
- structural normalization refinement
- lexical indexing preparation

### `document`-targeted processing

Use for:

- document-level metadata enrichment
- reference detection
- cross-origin synthesis
- later document-level summaries

## Worker Boundary

Heavyweight processing should remain outside Directus.

The worker should be pull-based and idempotent:

```text
claim next eligible job
-> load target
-> run stage
-> write versioned result
-> mark complete/fail
-> repeat
```

The current importer does not need to move into the worker immediately.
Initially the worker can focus on post-import and post-upload processing.

## Processing Is Origin-Agnostic

Different acquisition paths should converge into one processing system:

```text
court package importer
manual upload
user-authored material
future API/importers
-> document/binary layer
-> processing jobs
-> worker
```

The legal provenance of a document and the processing that should happen to its binary are different concerns.

Examples:

- imported court judgment
- manually uploaded French notification
- user-authored hearing draft

All may need:

- type identification
- extraction
- normalization
- indexing
- chunking
- embeddings

## Relationship Between Canonical Model And Processing Layer

The canonical/source model and the processing layer must stay separate.

Examples:

- `document_origin` answers where a document came from in legal/work context
- `source_observation` answers what the external source showed
- `document_representation` answers what a processor extracted from a stored binary

These are distinct questions and should not be collapsed.

## Human Work Product And AI-Derived Material

The architecture should preserve the distinction between:

1. canonical/source facts
2. application organization
3. human work product
4. machine-derived outputs
5. AI-derived interpretation

Examples:

- canonical/source facts:
  - imported proceeding metadata
  - imported bucket/document occurrence
- application organization:
  - workspace linkage
  - work-group membership
- human work product:
  - private notes
  - hearing questions
  - draft submissions
- machine-derived outputs:
  - extraction results
  - normalized segments
  - OCR text
- AI-derived interpretation:
  - summaries
  - suggested references
  - theme/entity candidates

AI-derived output must never silently become canonical fact.

## Three Concrete Scenarios

### Scenario A: Current Portuguese case family

Current known corpus contains one main Portuguese case plus related official proceedings.

Architectural treatment:

- create one `case_workspace`
- link the base `case_file` and all transitive descendants via `case_workspace_id`
- preserve `parent_case_file_id` for official procedural structure
- keep official `bucket`s source-specific
- allow user-created `work_group`s such as hearing preparation or evidence selection
- allow manual notes/uploads inside the same workspace

### Scenario B: Partially known French proceeding

Characteristics:

- partial external information only
- country/court/case number may be known
- structured official importer data may not exist yet
- manually received letters/notifications may exist immediately

Architectural treatment:

- create `case_workspace` first
- store evolving identifiers/references at workspace level
- attach manual documents and provenance immediately
- later attach official proceedings and official occurrences without replacing the workspace

### Scenario C: Prospective future proceeding

Characteristics:

- no official proceeding yet
- research, evidence collection, chronology, notes, and drafts already start

Architectural treatment:

- create `case_workspace` in prospective state
- use `work_group`s and document links immediately
- later attach official proceeding identifiers and imported `case_file`s
- preserve continuity of the same workspace rather than creating a second disconnected area

## Planned Delivery Phases

The next architecture steps should be implemented in phases that preserve clear boundaries and avoid mixing concerns too early.

### Phase A: case/workspace plus document provenance

Purpose:

- broaden the application from imported proceeding consultation into a real legal workspace
- keep imported official structure intact
- support manual/user material in the same document system

Implement in this phase:

- `case_workspace`
- `case_workspace_id` on `case_file`
- workspace backfill from explicit `parent_case_file_id` trees
- `case_workspace_reference`
- `work_group`
- `case_workspace_document`
- `work_group_document`
- `document_origin`
- `case_workspace_id` and `work_group_id` on `consultation_note`
- adjustment of `document` uniqueness assumptions for non-imported documents

### Phase B: source capture / source observation / canonical mapping provenance

Purpose:

- preserve acquisition evidence as a first-class layer
- distinguish source exposure from importer interpretation
- retain source-to-canonical mapping history

Implement in this phase:

- `source_capture`
- `source_observation`
- `source_observation_link`
- importer-side population of the new provenance layer
- capture/mapping linkage to existing `import_batch` where appropriate

Important boundary:

- `source_capture` must not be assumed 1:1 with `import_batch`
- source observation preserves what the source showed
- canonical entities preserve the normalized interpretation

### Phase C: processing jobs plus representation/segment infrastructure

Purpose:

- introduce format-agnostic processing orchestration
- keep processing separate from acquisition and canonical interpretation
- prepare common downstream infrastructure for extraction, normalization, and later retrieval

Implement in this phase:

- `processing_job`
- `processing_result`
- `document_representation`
- `document_segment`
- typed processing targets with FK integrity and a one-target CHECK rule

### Phase D: first concrete PDF processing plus existing corpus backlog

Purpose:

- make the first high-priority processor real without defining the whole system around PDF
- validate the processing framework against the current corpus

Implement in this phase:

- first PDF-focused binary verification/inspection/extraction path
- selective OCR decisioning and OCR fallback for PDFs where needed
- representation/segment population for PDFs
- existing imported PDF backlog creation from current `file_binary`
- worker execution against the current corpus

### What Later Phases Should Leave Room For

Leave room for:

- email attachments and other container decomposition
- confidentiality/visibility policy growth
- entities/parties/institutions
- timeline/event modeling
- accepted graph relations
- managed runtime content-addressed storage separate from import-package paths
- richer search services and APIs

### What Remains Deliberately Deferred

Deliberately defer:

- full graph schema
- full vector/embedding retrieval implementation
- public deployment hardening
- sophisticated orchestration beyond a PostgreSQL-backed worker
- broad matter/topic taxonomy
- large-scale RAG service design
- advanced review workflow state machine

## Why These Boundaries Matter

These boundaries are not academic.
They are what prevents future changes from collapsing distinct truths into one opaque layer.

Without them, the system would start to lose the ability to distinguish:

- source evidence from canonical interpretation
- official structure from user organization
- binary identity from logical document identity
- manual provenance from later official occurrence
- extraction artifacts from legal fact
- AI suggestion from accepted truth

That distinction is especially important in a legal context, where later review may depend on reconstructing exactly:

- what was observed;
- what was imported;
- what was processed;
- what was inferred;
- and what a user added intentionally.

## Conceptual Target

```text
                         USERS
                           │
                     Directus UI/API
                           │
                           ▼
                    CASE WORKSPACE
                           │
      ┌────────────────────┼────────────────────┐
      ▼                    ▼                    ▼
 official proceedings   work groups       workspace refs
      │                    │
      ▼                    │
   case_file               │
      │                    │
      ▼                    │
    bucket                 │
      │                    │
      └─────────────┬──────┘
                    ▼
                 document
                    │
          ┌─────────┴─────────┐
          ▼                   ▼
   document_origin        file_binary
                                │
                                ▼
                        processing_job/result
                                │
                                ▼
                              worker
                                │
               ┌────────────────┼────────────────┐
               ▼                ▼                ▼
     document_representation  indexing      AI/reference
               │
               ▼
        document_segment
               │
               └──────────────┐
                              ▼
                     subsequent processing jobs
                              │
                              ▼
                         search / graph
                              │
                              ▼
                      domain services / MCP

 source_capture / source_observation / source_observation_link
 sit alongside acquisition/import and preserve what the source showed
 before and beside canonical interpretation.
```
