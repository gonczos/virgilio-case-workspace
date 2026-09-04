# Reusable tools and standards evaluation direction

Status: open project note for discussion. This is not authoritative
architecture, an implementation contract, or authorization to add a runtime
dependency, service, processor, schema, or corpus-wide job.

Date: 2026-09-04

## Why record this direction

Planned capabilities involve familiar technical problems: fuzzy lookup,
similarity candidate generation, annotation review, controlled vocabularies,
portable text anchors, and provenance. Mature tools and standards may reduce
custom code, but only if they preserve this project's evidence and lineage
boundaries without creating a large customization or operational burden.

The goal is to evaluate candidates through small, reversible experiments. A
named tool is a candidate, not a selected dependency.

## Candidate matrix

| Candidate | Potential use | Benefit | Boundary or concern |
| --- | --- | --- | --- |
| PostgreSQL `pg_trgm` | OCR-tolerant lookup of labels, `Assunto`, names, and reference variants | Fits the existing authoritative database and supports indexed similarity | Similarity produces candidates, not identity or semantic equivalence |
| MinHash/LSH, for example `datasketch` | Repeated-document and passage candidate generation | Avoids exhaustive pairwise comparison | Approximate matches need exact, attributed follow-up comparison |
| RapidFuzz | Scoring and alignment after candidate generation | Mature edit-distance and token primitives | Scores must not become automatic equivalence decisions |
| INCEpTION | Span/relation annotation and attributable human review | Structured annotation projects and export | Test provenance round trips and workflow fit first |
| Doccano or Label Studio | Simpler annotation-interface alternatives | May cover bounded span/relation review with less machinery | Text-centric models may lose occurrence and representation context |
| SKOS conventions | PT-to-English glossary and controlled labels | Separates preferred, alternative, and hidden labels, concepts, and scope notes | Use selectively; avoid an ontology project |
| W3C Web Annotation selectors | Portable span and page anchors | Interoperable exact-text and position selectors | Existing internal anchors remain authoritative unless compatibility is proven |
| W3C PROV concepts | Possible provenance interchange vocabulary | Established entity/activity/agent concepts | Do not replace the repository's concrete provenance model |
| spaCy `SpanRuler` | Rule-based extraction if the current JavaScript extractor becomes unwieldy | Token-aware phrase and pattern matching | A second runtime needs measured benefit |

## Project boundaries

Any experiment must preserve these rules:

* PostgreSQL remains the authoritative derivation and provenance state.
* Originals and processor representations remain immutable and independently
  attributed.
* Candidate matches, clusters, labels, and relations are derived observations,
  not canonical truth.
* Every output retains its exact input, producer, version or configuration, and
  reproducible location where relevant.
* Independent extractor outputs are not silently merged or normalized into a
  preferred representation.
* No tool automatically reclassifies documents, resolves references, approves
  relationships, or overwrites human decisions.
* Reject candidates that require extensive plugins, internal modification, or
  disproportionate deployment and maintenance ownership.

## Suggested bounded sequence

1. Evaluate `pg_trgm` on a frozen sample of `Assunto` values and damaged labels.
2. Evaluate MinHash/LSH followed by RapidFuzz on the separate repetition
   fixture.
3. Test an INCEpTION import, review, and export round trip with a small existing
   reviewed fixture. Compare Doccano or Label Studio only if needed.
4. Represent a small PT-to-English glossary using SKOS-inspired fields without
   changing source labels.
5. Test whether Web Annotation selectors round-trip existing offsets and page
   anchors without loss.
6. Evaluate spaCy only if measured extractor problems justify another stack.

Each experiment remains separately authorized and must not expand merely
because a library exposes additional features.

## Acceptance and stopping criteria

A useful experiment should use a frozen task-specific fixture and report:

* measured benefit over the current implementation or manual process;
* false candidates and known misses, not only successes;
* deterministic or versioned reproduction details;
* preservation of raw values, exact anchors, input hashes, and provenance; and
* operational cost and customization required.

Stop when a candidate loses provenance, silently changes source material,
cannot reproduce outputs, needs broad infrastructure for a small benefit, or
makes this project responsible for debugging and extending the external tool.

## Relationship to other discussions

This note supplies evaluation candidates for:

* [reference investigation and review](2026-09-03-reference-investigation-and-review-direction.md);
* [document and passage repetition](2026-09-04-document-and-passage-repetition-direction.md);
* [relational evidence graphs](2026-09-04-relational-evidence-graph-direction.md); and
* a future glossary or human-review-interface plan.

It does not alter their boundaries or authorize their implementation.

## Primary references for later evaluation

* [PostgreSQL `pg_trgm`](https://www.postgresql.org/docs/17/pgtrgm.html)
* [MinHash LSH in `datasketch`](https://ekzhu.com/datasketch/lsh.html)
* [RapidFuzz](https://github.com/rapidfuzz/RapidFuzz)
* [INCEpTION user guide](https://inception-project.github.io/releases/41.2/docs/user-guide.html)
* [Doccano client documentation](https://doccano.github.io/doccano-client/usage/)
* [Label Studio relation extraction](https://github.com/HumanSignal/label-studio/blob/develop/docs/source/templates/relation_extraction.md)
* [W3C SKOS](https://www.w3.org/TR/skos-reference/)
* [W3C Web Annotation](https://www.w3.org/TR/annotation-model/)
* [W3C PROV-O](https://www.w3.org/TR/prov-o/)
* [spaCy `SpanRuler`](https://spacy.io/api/spanruler)

## Decision boundary

No installation, extension enablement, schema or API change, annotation
deployment, corpus processing, glossary migration, or new processor is
authorized by this note. Each experiment needs its own bounded fixture,
acceptance criteria, validation plan, and explicit approval.
