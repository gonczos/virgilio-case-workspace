# Reference investigation and review direction

Status: open project note for discussion. This is not authoritative
architecture, an implementation contract, or authorization to begin a new
phase.

Date: 2026-09-03

## Why this note exists

The current legal-reference annotation experiment is still in progress. The
discussion around it raised broader questions about what the consultation
application should decide, what an AI should propose, and what must remain a
human decision. This note records those doubts and possible directions without
changing the experiment or selecting an implementation.

## Current working direction

The application should primarily be a system for preserving evidence,
supporting investigation, and registering reviewed classifications. It should
not silently decide what a reference, document, relationship, or procedural
event means.

The responsibilities under consideration are:

* the repository and database preserve originals, source metadata,
  occurrences, processor outputs, observations, and decision history;
* deterministic code establishes identity, integrity, exact spans, provenance,
  and defensible candidate retrieval;
* an AI investigates context and produces attributed, evidence-linked
  proposals;
* a human accepts, modifies, rejects, or leaves those proposals unresolved;
* accepted conclusions remain separate from raw evidence and earlier
  proposals.

A possible lifecycle is:

```text
observed -> proposed -> human-reviewed -> accepted / rejected / unresolved
```

Human review of a proposal does not imply that every underlying uncertainty
was resolved. Classification confidence, transcription confidence, target
resolution, relationship resolution, and remaining verification should remain
separate dimensions.

## How the current consultation experience fits

The current UI is an evidence-navigation foundation for this direction. It can:

* search document text across the corpus;
* look up recorded reference values;
* group processor-specific passages by binary;
* preserve Docling, Xberg, and literal-text attribution;
* show source documents and procedural occurrences;
* retain missing-file records;
* open canonical original PDFs by SHA-256; and
* investigate a recorded reference inline without losing text-search context.

It currently answers where text or metadata was observed and which evidence or
procedural contexts are associated with it. It does not establish what a
reference ultimately identifies or whether a relationship is legally or
procedurally correct.

## The local-reference problem

Labels such as `Doc. 1`, `Anexo 2`, and `fls. 3` are normally scoped references,
not globally unique identifiers. The same label can be assigned independently
inside multiple filings. A later document may also cite an earlier filing's
`Doc. 1` while itself being described as `Doc. 1` by another document.

Consequently, equality of raw labels does not establish target identity. A
useful investigation must distinguish:

* the passage and representation in which the label was observed;
* the referring source document and procedural occurrence;
* whether the passage appears to assign a new local label or cite an existing
  one;
* the candidate filing or submission package that supplies its scope;
* candidate target documents and binaries;
* source-recorded relationships versus contextual or machine inference; and
* unresolved alternatives and missing evidence.

Occurrences can materially help this reasoning. They supply procedural context,
dates, parties, package membership, and reuse information. They are not alone
conclusive: one occurrence can contain several binaries, one binary can appear
in several occurrences, and the source system may not cleanly distinguish a
main filing from its attachments.

Explicit filing manifests, source-recorded links, and exact attachment hashes
are stronger evidence than shared dates or repeated labels. Repetition is a
candidate-generating signal, not automatic resolution.

## Possible MCP role

A read-only MCP surface could expose the existing evidence and questions to an
AI without giving it authority to modify accepted state. Candidate tools could
support:

* exact reference and document-text search;
* retrieval of attributed passages and page mappings where available;
* inspection of source documents, occurrences, packages, and reused binaries;
* comparison of independent processor representations;
* inspection of missing-file and external-register records;
* retrieval of candidate targets and the evidence supporting each candidate;
  and
* opening the original PDF for verification.

The AI could return a structured proposal containing its classification,
namespace candidate, target candidates, proposed relationships, evidence
anchors, alternatives, confidence, and remaining questions. The proposal would
retain model, workflow or prompt identity, exact input lineage, and timestamp.
It would not become an accepted classification merely because it was produced.

An optional later write path could register proposals into a review queue, but
it should not write directly to accepted human-review state. Whether MCP should
remain read-only or gain a proposal-only write tool is an open design choice.

## Possible review experience

The existing consultation UI could later grow a bounded investigation
workspace around a reference observation. It might present:

* the exact referring passage and processor provenance;
* the containing binary, source document, and occurrence;
* other occurrences of the raw value;
* candidate scopes, packages, documents, and binaries;
* explicit versus inferred relationship evidence;
* AI proposals and competing interpretations; and
* controls to accept with limitations, modify, reject, or leave unresolved.

The UI should avoid actions whose wording implies automatic truth. Terms such
as `Investigate`, `Propose classification`, `Review proposal`, `Accept with
limitations`, and `Leave unresolved` better reflect the intended authority
boundaries.

## Relationship to the current experiment

The legal-reference fixture remains useful even if the project favors MCP and
AI-assisted investigation over a comprehensive deterministic classifier. It
can define:

1. the evidence and response contract exposed to an investigator;
2. concrete cases for evaluating AI and deterministic proposals;
3. the structured questions presented to a reviewer; and
4. expected human decisions and unresolved outcomes.

The current experiment should finish on its own terms. This note does not alter
its review states, scope, sequence, or acceptance criteria.

## Open questions

* Should the first MCP checkpoint be strictly read-only?
* Should AI proposals initially remain transient, be exported as files, or be
  persisted in a proposal table?
* What minimum evidence bundle must accompany every proposal?
* How should proposal versions and supersession be represented?
* What exact human action moves a proposal into accepted reviewed state?
* Should attachment/package scope be modeled as an entity, a relationship
  candidate, or both?
* Which source-recorded relationships are reliable enough to expose as facts?
* How should multiple occurrences of one binary influence candidate ranking
  without becoming proof of identity?
* How should local labels be displayed so users do not mistake them for global
  identifiers?
* Should the investigation workspace live in the custom UI, Directus, or a
  deliberately small combination of both?
* Which parts of deterministic extraction remain valuable before an MCP/AI
  experiment: high-structure recognition, candidate generation, or both?

## Decision boundary

No MCP, proposal store, review workflow, classification editor, or automatic
resolver is authorized by this note. After the ongoing experiment finishes,
the next discussion should decide whether to test a narrow read-only MCP
investigation surface against the reviewed fixture, and define a separate
implementation contract if that direction is accepted.
