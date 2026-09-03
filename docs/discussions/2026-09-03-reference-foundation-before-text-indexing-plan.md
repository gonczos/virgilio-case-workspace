# Identity foundation with parallel reference validation and text indexing

Status: agreed sequencing plan; discussion-stage until the bounded fixture and
pilot index validate the contracts.

Date: 2026-09-03

## Decision

Stabilise the source-identity and representation-provenance contract first.
Then develop a bounded attributed-reference fixture and a minimal technical text
index together, so each validates the other against actual retrieval behavior.

This does not mean manually curating all 1,238 binaries before search work. A
passage does not need a resolved court-facing reference or component boundary to
be indexed. Reference interpretations remain joinable metadata rather than part
of immutable passage identity.

## Why this sequence

Text indexing makes words discoverable, but a useful result must remain
traceable to the correct representation, source context, and original evidence.
The reference-mapping experiment established that:

* one Citius occurrence can contain several independently meaningful files;
* one binary can appear in differently named occurrences;
* a notification can point to or reuse the binary of an earlier act;
* package, occurrence, printed filing, court-act, external, and SHA-256
  references identify different objects;
* package-level enrichment can become misleading when copied onto every
  occurrence of a reused binary;
* a PDF can cite several prior documents, so a number found in its text is not
  automatically an identifier of the containing PDF;
* missing media can have valid source and occurrence references without a
  binary SHA-256.

Indexing against an assumed `one binary = one document = one reference` model
would reproduce these ambiguities in search results. Conversely, requiring all
reference semantics and relationships to be resolved before indexing would
turn a technical prerequisite into an open-ended curation project.

The corrected dependency is:

```text
stable source identity and representation provenance
  -> page-attributed passage ingestion and minimal index
     <-> attributed reference observations and exact lookup
        -> later relationship and component enrichment
           -> procedural and substantive analysis
```

Only stable identity and provenance are hard prerequisites for indexing.
Correcting a reference observation must not require rechunking unchanged text.

## Principles

1. Original binaries remain immutable canonical evidence identified by full
   SHA-256.
2. A PDF is an initial reading and processing unit, not a claim that it contains
   exactly one legal document.
3. Source labels remain exact. Project classifications are separate, attributed
   observations.
4. Occurrence, source document, binary, package, component, and relationship
   remain distinguishable concepts even when some are unresolved.
5. Independent processor outputs remain separate with exact input lineage.
6. Where a reference was observed is separate from what it is believed to
   identify. Target interpretation may be absent, ambiguous, or have multiple
   candidates.
7. Number shape, filename, shared date, and adjacency do not resolve identity.
8. Review is dimensional: identity, classification, dates, references,
   boundaries, relationships, summary, signature detection, and cryptographic
   validation do not share one overall reviewed flag.

## Phase 1: identity and provenance contract

Confirm that passages and reference observations can use the existing stable
identities for binary, representation, source document, and occurrence.

The contract must represent:

* one occurrence with multiple binaries;
* one binary reused across multiple occurrences;
* source-document occurrences without a binary;
* representations with processor/version and exact input lineage;
* the strongest available passage location, including an honest `unknown` when
  reliable page mapping is unavailable.

No new semantic entity is required merely to begin indexing.

## Phase 2A: minimal reference observations

The first schema should retain:

* raw reference value and exact source label;
* where it was observed: source record, metadata row, representation, PDF page,
  or extraction item;
* observation producer/version;
* process, occurrence, source-document, and optional binary context;
* optional normalized namespace or role, including `unknown`;
* optional target candidate or candidates without requiring resolution;
* evidence, confidence, and review state for any interpretation.

The first schema does not require resolved entities for `court act`,
`notification`, `package`, `component`, or `external item`. These can begin as
provisional roles or target candidates because they overlap in real material.
Promote them into durable semantic entities only when repeated evidence supports
the distinction.

Initial population is restricted to:

1. source-recorded process, bucket, and court-document identifiers already in
   PostgreSQL;
2. an explicitly reviewed mapping of only the needed Document Register columns;
3. conservatively extracted labels such as `REF.ª`, `Referência:`, and `sob a
   ref.` from literal PDF text or page-attributed processor items.

Questionable filing-reference values remain attributed register assertions, not
resolved package memberships. The 320-column register must not be generically
ingested: it mixes evidential layers and contains duplicate header names.

## Phase 2B: fixed fixture and connected usability sample

Use a fixed subset of the existing 24-row experiment as the core acceptance
fixture. It already covers reused binaries, multi-file occurrences, mismatched
filing references, cited prior acts, external namespaces, and missing media.

Add a short November 2014 conference chain only to test connected usability.
Before implementation, freeze the complete fixture with explicit occurrence,
source-document, binary, and PDF identifiers and impose a hard ceiling of 25
distinct PDFs. A reference outside the fixture creates an unresolved-queue item;
it does not expand the sample automatically.

Inspect only what is necessary to test identity and reference behavior:

* printed references and their observation locations;
* immediate textual context;
* every source occurrence of the selected binary;
* explicit citation, transmission, or package statements needed to distinguish
  self-identifiers from references to other material.

Defer generalized component entities, broad author/recipient extraction, full
date reconciliation, comprehensive classification, and semantic relationships
such as `decides` or `records compliance with`. Preserve exact statements and
their evidence without forcing stronger interpretations.

Shared date, filename similarity, or adjacent register position is insufficient
relationship evidence.

## Phase 2C: parallel pilot text index

Develop representation-level passage ingestion, location handling, and a
minimal search-result contract alongside the reference fixture. Every indexed
passage must retain lineage to:

* binary SHA-256;
* exact representation and processor/version;
* PDF page or strongest available extraction location;
* source-document and occurrence context.

Reference observations are joined at query time when available. Component
identity is optional and included only when already supported. The index is a
disposable projection rebuildable from PostgreSQL provenance state and immutable
representations.

The fixture must test searches for a known `Ref.ª`, a cited prior act, a person,
a distinctive phrase, and a procedural label. Results should reach the exact
representation and original PDF and display relevant occurrence/reference
context without treating it as canonical passage identity.

## Pilot views

Expose four simple views over the same persisted observations rather than four
separately maintained deliverables:

| View | Purpose |
| --- | --- |
| Document catalogue | Fixture binaries and source contexts without requiring complete classification |
| Occurrence/context map | Fixture occurrences and explicit contextual links |
| Reference concordance | Observed references, locations, optional target candidates, and confidence |
| Unresolved queue | Missing objects, ambiguous references, uncertain locations, and deferred interpretations |

These are derived consultation views. They do not replace source metadata,
original evidence, or independent processor outputs.

## Gate for expanding indexing

Broader indexing can begin when the fixed fixture demonstrates:

1. exact lookup preserves distinct target candidates and reports ambiguity;
2. reused binaries and multi-file occurrences retain separate contexts;
3. observation location remains separate from target interpretation;
4. self-identifiers, cited references, and package assertions are not conflated;
5. questionable register fields remain attributed assertions;
6. external and court namespaces remain separate;
7. missing-binary records remain retrievable;
8. every observation has reproducible provenance;
9. repeated ingestion is idempotent and overwrites no source evidence;
10. a search hit reaches the exact representation and original PDF, with an
    honest location limitation where page mapping is unavailable;
11. no original binary, source fact, or processor output is overwritten.

The fixture need not resolve every reference or decompose every combined PDF.
Explicit unresolved cases are an expected successful result.

## Stop boundary

This slice must not expand into:

* full-corpus manual classification or procedural reconstruction;
* substantive analysis of disputed issues;
* durable component entities without demonstrated need;
* generalized semantic relationships;
* a preferred or merged extraction;
* summaries, embeddings, entity extraction, or AI reconciliation;
* replacement of Directus;
* a universal claim about undocumented Citius identifiers.

Once the gate passes, stop expanding the reference pilot and broaden technical
text indexing. Deeper curation can proceed incrementally while the index grows.

## Expected benefit

This avoids both unproductive extremes: indexing the entire corpus against an
inadequate identity model and delaying search until every document is manually
understood. It tests reference observations through their actual retrieval use,
keeps the pilot bounded, and lets corrections evolve without destabilizing
passage identity.
