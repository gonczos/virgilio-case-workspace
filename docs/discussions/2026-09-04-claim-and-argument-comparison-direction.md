# Claim and argument comparison direction

Status: open project note for discussion. This is not authoritative
architecture, an implementation contract, legal analysis, or authorization to
classify the corpus.

Date: 2026-09-04

## Why this is a separate problem

The case record may contain repeated allegations, answers to similar questions,
and accounts given to different authorities at different times. Some accounts
may appear compatible, expanded, narrowed, or contradictory. Finding and
reviewing those relationships could be important, but it is a semantic and
legally sensitive task rather than a document-similarity problem.

Contradictory claims can use very different language. Conversely, repeated text
can be quotation, boilerplate, or republication and need not be an independently
made claim. This work must therefore remain separate from the document and
passage repetition investigation in
`2026-09-04-document-and-passage-repetition-direction.md`.

Both directions complement
`2026-09-03-reference-investigation-and-review-direction.md` and its principle
that the system records attributed proposals and human decisions rather than
silently deciding contested meaning.

## Core distinctions

The system should distinguish:

* a passage observed in a specific representation;
* the document author, speaker, attributed person, and recording authority;
* a direct statement, quotation, paraphrase, translation, summary, or inference;
* the date of the alleged event, statement, document, and procedural occurrence;
* a neutral question or issue that multiple passages may address;
* a claim extracted or proposed from a passage;
* a proposed relationship between claims; and
* a human-reviewed conclusion about that relationship.

An allegation remains an attributed allegation. A court order, police report,
expert opinion, party submission, and later summary have different source roles
and must not be flattened into one narrative fact.

## Possible claim-history model

A claim observation could retain:

* exact binary and representation lineage;
* exact passage and strongest supported location;
* speaker or attributed person, document author, recorder, and recipient;
* direct, quoted, summarized, translated, or inferred statement form;
* relevant dates with their distinct source semantics;
* neutral issue or question candidate;
* structured answer or assertion candidate;
* extraction or AI producer, version, prompt/configuration, and timestamp;
* confidence by attribution, transcription, issue assignment, and interpretation;
* alternatives and remaining verification; and
* human review and immutable decision history.

A comparison record could propose:

* substantially repeated claim;
* expanded or narrowed account;
* compatible accounts;
* apparent tension;
* apparent direct contradiction;
* response to an earlier allegation;
* quotation or paraphrase of another source; or
* insufficient evidence that both passages answer the same question.

These are candidates until reviewed. The safest default is unresolved.

## Why occurrences and repetition matter

Procedural occurrences can help identify when, where, and to whom an account
was presented. Repetition alignment can show whether a later document quotes an
earlier statement or independently restates it. Neither is conclusive alone.

Before calling two answers contradictory, review should consider:

* whether they concern the same event, period, person, and question;
* whether one is a translation or authority-written summary;
* whether omissions reflect a narrower question rather than changed testimony;
* whether OCR or extraction damaged a material qualifier;
* whether the speaker is direct or merely attributed by another person;
* whether the later text quotes the earlier version; and
* whether the original PDF or recording must be checked.

## Possible AI and MCP role

A read-only investigation surface could let an AI retrieve passages, source
metadata, occurrences, repetition candidates, and original-document links. The
AI could propose a neutral issue, group possibly responsive passages, describe
stable and differing elements, and identify what requires verification.

It must not:

* convert allegations into established facts;
* infer speaker identity without evidence;
* manufacture missing statements;
* silently reconcile conflicting accounts;
* label a contradiction without exposing both supporting passages; or
* write directly to accepted human-review state.

The dedicated human-review interface discussed in
`2026-09-03-reference-investigation-and-review-direction.md` could eventually
show comparisons side by side and record confirm, correct, reject, or unresolved
decisions with limitations.

## Possible bounded experiment

Start from one user-selected factual question with a small, fixed set of known
documents and occurrences. Freeze the question, inclusion method, review unit,
and ceiling before retrieval. Include direct statements, summaries, quotations,
translations, apparently differing accounts, and hard examples that discuss
similar subject matter without answering the same question.

The experiment should measure separately:

* passage retrieval coverage;
* attribution accuracy;
* issue/question assignment;
* claim extraction accuracy;
* relationship classification;
* unsupported contradiction proposals; and
* reviewer usefulness and time saved.

The result should be an evidence-linked comparison and unresolved-question
queue, not a narrative verdict about the dispute.

## Open questions

* What is the smallest safe claim unit: sentence, passage, answer, or event?
* Who defines the neutral issue or question used for comparison?
* How should indirect speech and authority summaries be represented?
* When are translations comparable, and which version controls wording?
* Which relationship labels are sufficiently neutral for an initial fixture?
* What human expertise is required to confirm an apparent contradiction?
* Should reviewed claim relationships live in the application database or
  remain versioned fixture artifacts during experimentation?
* How should later corrections or newly discovered evidence revise a history
  without overwriting earlier conclusions?

## Decision boundary

No claim extractor, contradiction detector, corpus-wide analysis, legal
conclusion, MCP tool, proposal store, or UI workflow is authorized by this
note. Document-repetition evidence may inform a later plan, but it is not a
prerequisite that authorizes semantic inference. A separate bounded protocol
and reviewed fixture are required before implementation.
