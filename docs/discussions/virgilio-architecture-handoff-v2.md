# Virgilio Case Workspace — Architecture Handoff v2

Superseded on 2026-08-30 by:

- `docs/architecture/07-consolidated-architecture-reference.md`

This document remains useful as design-history context, but it is no longer the authoritative architecture reference.

## Purpose

This supersedes the domain assumptions in the earlier architecture handoff while preserving its worker/search/AI direction.

The repository review showed that the current implementation is a good **canonical court-import core**, but the intended product is broader: a **legal case workspace backed by a provenance-rich document archive**.

This is a review/design brief. **Do not implement from this document directly.** Inspect the repository first and propose the smallest semantic extension.

## 1. Preserve the existing canonical import core

Repository review indicates these existing concepts are intentionally source-oriented:

- `case_file`: imported/official proceeding
- `bucket`: imported court-side grouping/event container
- `document`: imported canonical document identity
- `file_binary`: SHA-256-addressed binary identity
- `document_binary`: document/binary linkage and binary reuse
- `consultation_note`, `document_issue`: limited non-canonical annotations

Do not generalize `case_file` or `bucket` merely to support manual work. Preserve source keys, importer behavior, canonical facts, and upsert semantics.

## 2. Add a broader case-work root

The application needs a root above/beside official proceedings that can exist:

- before filing;
- without a case number;
- with partial information only;
- with zero, one, or multiple official proceedings;
- across jurisdictions;
- throughout prospective, preparing, filed, active, and closed phases.

Conceptually:

```text
CaseWorkspace / LegalCase / Dossier
├── Official proceedings (`case_file`)
│   └── official `bucket`s
├── Work groups
├── Documents
└── Matters / topics
```

Do not automatically call this root `matter`. Earlier domain discussion uses **Matter** for cross-cutting themes/topics such as parental contact, enforcement, psychological evaluation, etc. Codex should recommend terminology after inspecting repository vocabulary.

## 3. Keep official structure and user organization separate

`bucket` should remain an imported/source-system concept.

Introduce a separate work-group concept for:

- hearing preparation;
- evidence selection;
- research;
- question lists;
- draft packs;
- correspondence bundles.

Prefer M:N work-group/document membership. The same document may be relevant to multiple working contexts.

## 4. Support three first-class case-work scenarios

### A. Existing official case + user work

An imported case exists. A user needs to prepare for a hearing, create notes/drafts, upload new material, and group existing official documents for that hearing.

### B. Partially known foreign proceeding

A proceeding is known from partial external information: country/court/case number and a few manually received letters/notifications, but no structured court scraper data. Work must begin immediately. More official material may arrive later.

### C. Prospective proceeding

A user begins research, evidence collection, chronology, and drafting before a proceeding officially exists. Later it is filed and receives official identifiers. The existing workspace should evolve rather than be replaced.

## 5. Separate document identity, binary identity, provenance, and organization

Do not conflate:

```text
logical document identity
binary identity
source/provenance occurrence
official bucket membership
case/workspace relevance
user work-group membership
```

Preserve `file_binary`/SHA-256 as the cross-origin deduplication anchor.

A manually received document may later also appear in an official bucket. That should add provenance/occurrence rather than rewrite history.

Prefer additive provenance over a single destructive `source_type`.

Potential origins include:

- official import
- manual received
- user authored
- external correspondence
- machine derived

Exact taxonomy should follow repository semantics.

## 6. Keep semantic layers explicit

The system should distinguish:

1. canonical official/source facts;
2. user-created case organization;
3. human-authored work product/annotations;
4. machine processing outputs;
5. AI-derived interpretation.

This distinction must later be usable by search/RAG. For example:

```text
Use only official/source material.
```

or:

```text
Compare my hearing-preparation notes with official evidence.
```

AI-derived text must not silently become canonical fact.

## 7. Manual/user material

Manual/user-created material may need:

- case/workspace association;
- provenance/origin;
- who added/authored it;
- added timestamp;
- received/authored date where applicable;
- original filename;
- sender/source/channel where applicable;
- optional description;
- optional visibility/confidentiality;
- binary linkage where applicable;
- later official linkage without loss of original provenance.

Do not require an artificial official bucket.

## 8. Acquisition and processing are different concerns

Multiple acquisition paths should converge on one processing system:

```text
court package importer ──┐
manual upload ───────────┤
user-authored material ──┼─> document/binary layer
future importer/API ─────┘          │
                                    v
                              processing jobs
                                    │
                                    v
                                  worker
```

**Processing must be driven by processing state, not acquisition origin.**

A court judgment, manually uploaded foreign letter, and user-authored hearing document have different legal provenance but may all require extraction, normalization, chunking, indexing, and embeddings.

## 9. Dedicated pull-based worker

Keep heavyweight processing outside Directus.

Conceptual loop:

```text
claim next eligible job
→ load input
→ run stage
→ write versioned result
→ mark complete
→ repeat
```

Potential stages:

- VERIFY
- INSPECT
- EXTRACT
- OCR
- NORMALIZE
- CHUNK
- EMBED
- AI_METADATA
- REFERENCE_DETECTION

The current importer need not immediately move into the worker. Initially the worker can focus on post-import enrichment.

Existing 1,000+ PDFs should become the initial backlog; new imports/manual uploads should enter the same processing mechanism.

## 10. Idempotent/versioned processing

Every processing stage must be rerunnable without duplicate semantics.

Derived output should identify:

- input/target;
- processor/tool;
- processor version;
- run timestamp;
- status/error;
- dependencies where relevant.

Changing a chunker or embedding model should not force unrelated OCR to rerun.

A PostgreSQL-backed job model is sufficient initially. A claim pattern such as `FOR UPDATE SKIP LOCKED` may be appropriate.

Do not assume all jobs should reference current imported `document`. Repository-aware design must determine which stages naturally target `file_binary`, logical documents, or derived artifacts.

## 11. PDF processing

Preferred initial direction remains:

- SHA-256 integrity/identity;
- PyMuPDF for page-level inspection/native text extraction;
- OCRmyPDF + Tesseract for OCR fallback;
- preserve original binary;
- store processing outputs as derived/versioned data.

Do not equate non-empty extracted text with good searchable text. Page quality may need states such as GOOD/SUSPECT/EMPTY.

Preserve page provenance.

## 12. Chunking and provenance

Chunks are retrieval artifacts, not evidence.

Every chunk should be traceable back to the relevant:

```text
case/workspace
→ logical document
→ source/binary occurrence
→ page(s)
```

Store page ranges and, where practical, character offsets, extraction context, and processor version.

Weak chunk provenance is unacceptable for later legal RAG.

## 13. Search architecture

Start with:

```text
PostgreSQL metadata filters
+ PostgreSQL FTS
+ pgvector
```

Do not add OpenSearch/Elasticsearch or a separate vector DB until actual requirements justify them.

Keep application search interfaces replaceable so a dedicated index can be added later.

Eventually combine:

- metadata filtering;
- lexical/full-text retrieval;
- semantic/vector retrieval;
- graph/relationship traversal.

## 14. AI enrichment

AI is a derived enrichment layer.

Potential outputs:

- summaries;
- metadata suggestions;
- entities;
- themes;
- timeline candidates;
- contradiction candidates;
- reference candidates.

Retain model, model/version, prompt version/family, timestamp, input scope, grounding references, and review status.

Human review must not erase provenance.

## 15. Reference detection / graph

Legal material naturally forms a graph.

Potential relations include:

- cites
- responds_to
- appealed_by
- relies_on
- supersedes
- refers_to
- same_binary_as

Prefer candidate detection → matching/confidence/review → accepted relation.

Use deterministic parsing for structured identifiers/dates and AI only where semantic ambiguity warrants it.

Keep graph/enrichment derived from, rather than mixed into, canonical source facts.

## 16. Directus

Use Directus for:

- consultation/browsing;
- CRUD;
- manual uploads;
- case/work-group management;
- notes;
- human review;
- permissions;
- API access;
- light actions that enqueue work.

Do not make Directus the engine for OCR, embeddings, graph construction, large-scale AI, or RAG.

## 17. MCP and RAG

MCP is an adapter, not the internal architecture.

Future domain-oriented tools might include:

- `search_documents`
- `get_document`
- `get_document_pages`
- `list_case_documents`
- `get_case_timeline`
- `find_related_documents`
- `find_document_references`
- `semantic_search`

Prefer stable domain/search/file services underneath MCP rather than arbitrary SQL.

RAG should be provenance-first:

```text
question
→ scope/material-class filters
→ metadata + FTS + vector + graph retrieval
→ grounded pages/chunks
→ LLM
→ cited answer
```

## 18. Portability and multi-user operation

Keep Docker Compose as the initial deployment unit.

Preserve:

- persistent data outside containers;
- migrations/config in Git;
- secrets outside Git;
- replaceable worker/search/AI components.

Repository review noted that runtime binary serving currently depends on package-relative disk paths. Evaluate later whether imports should populate managed content-addressed runtime storage while preserving immutable original packages.

Before wider network access add:

- reverse proxy;
- TLS;
- hardened Directus permissions;
- explicit roles;
- audit expectations;
- file access controls;
- backup/restore procedures.

Do not publicly expose PostgreSQL. Private remote access is preferable before public Internet exposure for sensitive material.

## 19. Backups and operational safety

Define backup/restore for:

- PostgreSQL;
- original import packages;
- managed binary storage if introduced;
- migrations/config;
- expensive derived outputs where worthwhile.

Use PostgreSQL-aware backups such as `pg_dump` and test restoration.

Treat original evidence as immutable/effectively immutable. Derived artifacts should be reproducible where practical.

## 20. Architectural invariants

Unless repository constraints show a better solution:

1. Imported canonical facts remain authoritative source observations.
2. User organization does not masquerade as official court structure.
3. Provenance is additive.
4. Logical document identity is distinct from binary identity.
5. SHA-256 binary dedupe remains cross-origin.
6. Processing is acquisition-origin agnostic.
7. Processing outputs are idempotent/versioned.
8. AI output remains derived and attributable.
9. Retrieval preserves page/document/source provenance.
10. Directus is UI/admin/API, not the processing engine.
11. Search/MCP/AI are replaceable consumers, not foundational data models.

## 21. Conceptual target

```text
                         USERS
                           │
                     Directus UI/API
                           │
                           ▼
                     CASE WORKSPACE
                  /        |         \
                 /         |          \
        Proceedings    Work Groups   Matters/Topics
            │              │
            ▼              │
          Buckets           │
            │              │
            └───────┬──────┘
                    ▼
                 Documents
                    │
           ┌────────┴────────┐
           ▼                 ▼
        Origins          File Binary
                          SHA-256
                             │
                             ▼
                       Processing Jobs
                             │
                             ▼
                           Worker
                             │
            ┌────────────────┼───────────────┐
            ▼                ▼               ▼
      extraction/OCR       chunks       AI/references
            │                │               │
            └────────────────┼───────────────┘
                             ▼
                       Search / Graph
                             │
                             ▼
                       Domain services
                        /          \
                   Directus         MCP
```

This is a boundary map, not a mandate to build every box.

## 22. Recommended build order

### Phase 0 — domain/schema validation

Before processing implementation:

- choose broader case-work root and terminology;
- preserve `case_file`/`bucket`;
- define manual/user provenance;
- define case/workspace ↔ document association;
- define M:N work groups;
- decide how imported cases/docs backfill into the broader layer.

### Phase 1 — trustworthy processing

- processing/job state;
- binary verification;
- PDF inspection;
- page extraction;
- OCR-needed detection;
- OCR fallback;
- normalization;
- retry/version/error tracking.

### Phase 2 — retrieval

- chunks + provenance;
- PostgreSQL FTS;
- pgvector/embeddings;
- hybrid retrieval.

### Phase 3 — enrichment/graph

- AI suggestions;
- reference candidates;
- human review;
- accepted relations;
- timeline/entity/topic enrichment.

### Phase 4 — AI access

- stable domain/search API;
- citation-oriented RAG;
- MCP adapter.

### Phase 5 — UX/operations

- richer Directus workspace;
- roles;
- remote deployment/TLS;
- monitoring;
- backup automation;
- more sophisticated worker orchestration only if justified.

---

# 23. Next task for Codex — review only, no implementation

Inspect the current repository and produce a concrete **schema-v2 + processing-boundary proposal**.

Do not implement yet.

Answer:

1. What should the broader case-work root be called?
2. How does it relate to existing `case_file`?
3. Can it have zero/multiple official proceedings?
4. How should lifecycle be modeled?
5. How should existing imported cases be backfilled?
6. How should existing imported documents associate with the broader root?
7. What is the smallest clean work-group model?
8. Should work-group membership be M:N?
9. How should provenance/origin be represented?
10. Can one logical document have multiple origins/occurrences?
11. How does a manual document later gain an official occurrence without losing provenance?
12. Which current `document` constraints prevent clean non-imported documents?
13. Should `document` be generalized, or should another logical-document layer sit above it?
14. How should `file_binary` remain the cross-origin dedupe anchor?
15. Which processing operations should target `file_binary` vs logical `document`?
16. What should processing-job/result keys reference?
17. How should a manual upload enqueue processing?
18. How do existing 1,000+ PDFs become a backlog without re-import?
19. What changes, if any, are required in the importer?
20. Which current tables can remain untouched?
21. What migration/backfill sequence is safest?
22. What should deliberately remain deferred?

For every proposed table/change, show:

- purpose;
- important fields;
- PK;
- FKs;
- unique constraints;
- cardinality;
- canonical/user-created/derived classification;
- importer impact;
- deletion/immutability expectations where relevant.

Walk through three scenarios:

### Scenario A — existing official case + hearing preparation

Create a hearing-preparation group, author notes, associate existing official documents, and upload a new document.

### Scenario B — partially known foreign proceeding

Create a workspace from partial information, manually add a court notification and external letters, then later attach official court material while preserving original provenance.

### Scenario C — prospective proceeding

Create a prospective workspace, collect evidence and drafts, later file it and attach an official court/case identifier without replacing the workspace.

Challenge this architecture where appropriate. If the existing repository supports a simpler or stronger solution, prefer it and explain why.

The goal is the **smallest extensible evolution of the existing canonical import system**, not a greenfield redesign.
