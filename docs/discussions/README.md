# Discussion index

This directory contains working conversations, exploratory plans, prompts,
historical notes, and unresolved project directions. These files explain why
an idea arose, but are not authoritative architecture or implementation
authorization unless a decision is deliberately promoted elsewhere.

Use these sources for established guidance:

* [`../architecture/`](../architecture/) for authoritative architecture;
* [`../evaluation/`](../evaluation/) for frozen fixtures and evaluations;
* [`../agent-runs/`](../agent-runs/) for recorded-run prompts and reports;
* [`../SETUP.md`](../SETUP.md) for verified setup instructions; and
* [`../TODO-setup-and-portability.md`](../TODO-setup-and-portability.md) for
  unresolved setup and portability work.

## Status language

* **Open direction** records questions and possible approaches without
  authorizing implementation.
* **Frozen plan or protocol** defines a bounded activity under stated gates.
* **Historical result or handoff** records a point-in-time understanding that
  may have been superseded.
* **WIP or TODO** is incomplete working material.

Always read the status and decision boundary inside the document itself.

## Current open directions

* [Reference investigation and human review](2026-09-03-reference-investigation-and-review-direction.md)
  — deterministic observations, AI proposals, and human decisions.
* [Relational evidence graph](2026-09-04-relational-evidence-graph-direction.md)
  — layered navigation across procedure, references, and evidence.
* [Document and passage repetition](2026-09-04-document-and-passage-repetition-direction.md)
  — alternate copies, embedded documents, and repeated passages.
* [Claim and argument comparison](2026-09-04-claim-and-argument-comparison-direction.md)
  — attributed comparison of statements and positions.
* [Reusable tools and standards](2026-09-04-reusable-tools-and-standards-evaluation-direction.md)
  — bounded evaluation of mature components before building custom machinery.

## Reference discovery and indexing

* [Citius document references and packages](2026-09-03-citius-document-references-and-packages.md)
* [Citius reference-mapping experiment](2026-09-03-citius-reference-mapping-experiment.md)
* [PT/FR reference-extraction evaluation](2026-09-03-pt-fr-legal-reference-extraction-evaluation-plan.md)
* [Reference foundation and text indexing](2026-09-03-reference-foundation-before-text-indexing-plan.md)
* [Metadata-review AI simulation](2026-09-04-metadata-review-ai-simulation-plan.md)
* [Reference-neighbourhood graph spike](2026-09-04-reference-neighbourhood-graph-spike-plan.md)

## Extraction and consultation exports

* [Extraction rollout findings](2026-09-02-extraction-rollout-findings.md)
* [Xberg failure notes](xberg-failure-notes-2026-09-01.md)
* [AI-consultation page-traceability plan](2026-09-02-ai-consultation-v2-page-traceability-plan.md)
* [Evidence-layers discussion](virgilio_evidence_layers_discussion.md)
* [Google Drive factual export WIP](WIP-google-drive-factual-export.md)

## Project history and maintenance

* [Architecture handoff v2](virgilio-architecture-handoff-v2.md)
* [AGENTS adoption note](AGENTS-adoption-note.md)
* [Prompt-history WIP](WIP-prompt-history.md)
* [Setup registry TODO](TODO_CreateSetupRegistry.md) and
  [follow-up](TODO_CreateSetupRegistry_2.md)
* Files beginning with `C4` or `C5` are historical phase/checkpoint notes.
  Consult current architecture and evaluation documents before treating their
  contents as current behavior.

## Maintaining this index

Add a discussion when it becomes useful beyond one immediate conversation.
Prefer a short description and link over duplication. When a decision becomes
authoritative, update the appropriate architecture, setup, or evaluation source
rather than turning this index into a second source of truth.
