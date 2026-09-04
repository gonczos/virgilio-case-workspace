# Document and passage repetition direction

Status: open project note for discussion. This is not authoritative
architecture, an implementation contract, or authorization to run corpus-wide
processing.

Date: 2026-09-04

## Why this deserves a separate investigation

The case material contains exact binary reuse, alternate copies of documents,
documents embedded in larger bundles, and arguments or other passages repeated
across filings. Identifying these patterns could reduce repeated review and may
make information recoverable when one copy is scanned or poorly extracted and
another is readable.

This is primarily a similarity, alignment, and provenance problem. It is
separate from deciding whether two statements make the same claim or contradict
one another. Similar text does not establish equivalent legal meaning, and
different wording does not preclude equivalent claims.

This note complements
`2026-09-03-reference-investigation-and-review-direction.md`. It does not change
the current reference-extraction evaluation.

## Distinctions to preserve

The following must not be collapsed:

```text
same SHA-256 binary
  != alternate-copy candidate
  != embedded-document candidate
  != repeated-passage candidate
  != confirmed document equivalence
  != equivalent evidential or procedural role
```

Potential relationships include:

* exact binary reuse across occurrences or proceedings;
* different binaries that may represent the same document;
* born-digital and scanned or OCR-derived copies of the same material;
* standalone documents reproduced inside notifications, certifications, or
  filing bundles;
* complete containment of one document in another;
* substantial passage reuse, quotation, or paraphrase; and
* common templates or boilerplate that must not imply document equivalence.

An original, certified copy, unsigned reproduction, translation, notification
enclosure, and quoted extract can share content while remaining distinct
evidence objects.

## Possible value

A repetition layer could:

* let reviewers reuse a prior inspection without erasing separate occurrences;
* align a readable copy with a scanned or damaged copy;
* recover identifiers or passages omitted by one processor;
* expose standalone items embedded in combined PDFs;
* reconstruct filing and attachment-package candidates;
* show how arguments were repeated or modified over time; and
* provide safer evidence inputs for later claim-level analysis.

Reuse of a review decision must be explicit. A classification confirmed for
one binary or contained document is not automatically valid for a different
copy when signatures, pages, attachments, annotations, or procedural roles
differ.

## Candidate record

Every similarity candidate should retain:

* both binary SHA-256 identities;
* exact representation IDs, kinds, processors, versions, configuration
  identities, and content hashes;
* matching or approximately matching ranges and page mappings when supported;
* similarity method, configuration, version, score, and threshold;
* exact-match, containment, alignment, or approximate-match basis;
* material additions, omissions, signature differences, and layout differences;
* source-document and occurrence contexts for both sides;
* proposed relationship type and alternatives;
* review state, reviewer decision, and decision history; and
* unresolved questions and required original-PDF verification.

Similarity output is derived data. It must not modify original binaries or
processor representations.

## Possible staged experiment

1. Inventory exact binary reuse already established by SHA-256.
2. Hash normalized pages and bounded text chunks to find exact textual reuse.
3. Test deterministic near-duplicate fingerprints and local passage alignment.
4. Rank candidates using metadata and procedural context without treating those
   signals as proof.
5. Review a bounded fixture containing useful matches and hard negatives.
6. Consider AI explanations only for residual candidates that require context.

A small fixture should include born-digital versus scan, standalone versus
embedded copy, the same attachment in different packages, repeated argument
passages, translations, and similar boilerplate that is not equivalence.

## Evaluation questions

* Does the method find known alternate copies and embedded documents?
* Can it align useful passages when OCR spelling and line breaks differ?
* Does it avoid conflating templates and standard legal language?
* Can a reviewer see important differences before reusing prior work?
* Are every candidate and decision reproducible from immutable inputs?
* How much review time is actually saved?

## Open questions

* What is the correct first unit: page, chunk, complete representation, or a
  combination?
* Which representation should seed discovery without becoming preferred truth?
* How should translated versions be related without calling them duplicates?
* When may a prior review be suggested for reuse, and what must be rechecked?
* Should confirmed containment create component records or only relationships?
* Which results belong in PostgreSQL, and which remain disposable projections?

## Decision boundary

No similarity index, corpus scan, relationship store, automatic deduplication,
or review reuse is authorized by this note. A later bounded plan must freeze a
fixture, methods, thresholds, protected negatives, and acceptance criteria
before implementation.
