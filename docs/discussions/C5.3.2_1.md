# C5.3.2 — Targeted PDF Evidence Rollout and Implementation Validation

Implement and complete Phase C5.3.2 only.

Follow the repository-root `AGENTS.md` and the applicable architecture documentation.

This task is an **explicitly recorded run**. Use the repository's recorded-run workflow once this discussion prompt has been agreed and frozen.

Do not start the next phase.

---

## 1. Objective

Validate the implemented C5.3.1 PDF evidence boundary across a deliberately selected representative set of real repository PDFs.

Determine, from actual repository behavior, where the current implementation and policy are:

* working as intended;
* defective;
* too narrow;
* or correctly deferred.

This is primarily a **targeted rollout and implementation-validation phase**, not a second broad PDF investigation.

The architectural question has already been answered:

> Virgilio needs PDF evidence extraction that remains distinct from Docling/Xberg interpretation.

The question for C5.3.2 is now:

> How reliably does the implemented C5.3.1 evidence boundary behave across representative repository PDFs, and what does that evidence imply for the next narrow step?

Do not reopen the broad C5.3 architecture unless repository evidence demonstrates an actual contradiction or defect that cannot be addressed within this slice.

---

## 2. Starting repository state

Before modifying anything:

1. read the applicable `AGENTS.md`;
2. inspect `git status`;
3. inspect the relevant C5.3/C5.3.1 implementation, tests, architecture documentation, and prior findings;
4. inspect the current processing/evidence implementation rather than relying only on this prompt;
5. identify the actual current Git baseline from repository history.

Do not assume an old discussion-file checkpoint is still the repository HEAD.

The repository currently contains pre-existing working-tree changes, including at least previously reported state such as:

```text
 M package.json
 M test/phase-c5.3.1.test.mjs
?? app/phase-c5.3.2-rollout.mjs
?? tmp/
```

Treat these carefully.

In particular:

* do not reset, delete, or overwrite them;
* inspect `app/phase-c5.3.2-rollout.mjs` before creating new rollout tooling;
* it may represent already-started C5.3.2 work and should be continued/reused if it fits the agreed phase;
* inspect the modification to `test/phase-c5.3.1.test.mjs` and determine whether it is relevant existing C5.3.2 work or unrelated work;
* treat `package.json` as unrelated unless repository evidence shows that C5.3.2 genuinely requires it;
* do not clean `tmp/` merely to make the tree look clean.

Preserve unrelated work exactly as required by `AGENTS.md`.

---

## 3. Existing C5.3.2 working-tree state

Before implementing or adding rollout tooling, inspect:

```text
app/phase-c5.3.2-rollout.mjs
```

This file already exists as untracked working-tree state.

Determine from its content and repository context whether it is intended
bootstrap work for C5.3.2.

* If it is clearly intended for this phase, bring it into scope
  deliberately, review it before modifying it, and reuse/complete it
  where appropriate.
* If it is unrelated or its intent cannot be established, preserve it
  untouched as unrelated working-tree state.

Do not overwrite it or create competing rollout tooling without first
resolving that question.

---

## 4. Architectural boundary

Preserve this separation:

```text
immutable file_binary PDF
        ↓
PDF evidence artifacts
        ↓
interpreted document representations
```

The currently implemented PDF evidence processors are:

* `pdf_literal_text`
* `pdf_signature_metadata`
* `pdf_structure_inventory`
* `pdf_ocr_text`

Docling and Xberg remain interpretation engines.

Do not collapse these layers.

Do not:

* select one representation as universal truth;
* silently reconcile disagreements;
* reinterpret evidence artifacts as semantic document representations;
* treat absence from Docling/Xberg as evidence of absence from the source PDF.

The immutable original PDF remains canonical evidence.

---

## 5. Repository implementation to inspect

Confirm the actual implementation before relying on these names, but the relevant current areas are expected to include:

### Processing/runtime

* `app/processing-registry.mjs`
* `app/processing-store.mjs`
* `app/processing-admin.mjs`
* `app/processing-worker.mjs`

Relevant existing operations include the durable:

* enqueue;
* worker processing;
* representation inspection;
* processing-state inspection/recovery paths.

### Evidence implementation

* `app/pdf-evidence.mjs`
* `app/processors/extract-document.py`

Expected locally used evidence tooling includes the current C5.3.1 choices such as:

* `pdftotext -layout`
* `pdfinfo`
* `qpdf`
* the existing OCR evidence path where applicable.

Do not substitute an entirely new tool stack merely because another tool could expose more information.

### Artifact access

Inspect the existing representation/artifact access implementation, including:

* `app/representation-artifacts.mjs`

Do not redesign artifact access unless a concrete C5.3.2 validation defect requires a narrowly scoped correction.

### Processing policy

Inspect the actual current `determineProcessingPolicy(...)` behavior.

The expected existing policy is:

For PDFs generally:

* `pdf_literal_text`
* `pdf_signature_metadata`
* `pdf_structure_inventory`
* `docling`
* `xberg`

Conditional OCR:

* `pdf_ocr_text` for `image_only_pdf`
* `pdf_ocr_text` for `mostly_image_pdf`

Verify rather than assume this remains exact.

---

## 6. Consultation boundary

Current consultation behavior should remain intentionally focused on interpreted document representations such as:

```text
representation_kind = 'extracted_document_bundle'
```

PDF evidence artifacts are not automatically the default human consultation representation.

That is intentional.

C5.3.2 must not turn evidence rollout into consultation-product work.

Existing consultation behavior should remain unchanged unless a concrete regression must be corrected.

---

## 7. Questions C5.3.2 must answer

Answer concretely from repository behavior:

1. Do all four implemented PDF evidence processors produce their expected artifacts reliably across representative PDFs?

2. Are persisted artifact semantics, identities, status, and provenance correct in practice?

3. How often does `pdf_literal_text` expose material evidence not available in the existing Docling/Xberg interpretation outputs?

4. Does current OCR gating behave correctly for:

   * `image_only_pdf`
   * `mostly_image_pdf`

5. Do signature and structure inventories behave correctly across:

   * ordinary unsigned PDFs;
   * signed PDFs;
   * multi-signature PDFs/candidates;
   * scanned/image-heavy PDFs;
   * mixed PDFs;
   * unusual or problematic PDFs?

6. Do any rollout failures reveal:

   * a concrete C5.3.1 implementation defect;
   * a concrete policy gap;
   * or a useful but deferred evidence-channel opportunity?

7. Is the implemented evidence boundary sufficiently stable to support later consumption work?

8. What should the next **narrow** step be?

---

## 8. Representative sample

Do not process the full corpus.

Use a deliberately selected representative sample of approximately:

```text
20–30 PDFs
```

Prefer the already curated/adversarial C5.3 sample documented in:

```text
docs/discussions/C5.3_2.md
```

Reuse known cases instead of creating a new generalized PDF classification system.

The sample should cover, as available:

* ordinary native-text PDFs;
* signed PDFs;
* multi-signature candidates;
* `image_only_pdf`;
* `mostly_image_pdf`;
* `mixed_pdf`;
* long/problematic PDFs;
* PDFs from different observed generator families;
* known cases where literal PDF extraction and Docling/Xberg differ materially.

Use repository evidence such as:

* `file_binary.machine_readability_status`;
* existing PostgreSQL PDF metadata;
* retained canonical binaries;
* documented C5.3 findings;
* previously identified signed/multi-signature examples.

The known regression/example PDF where visible signature-appearance text was recoverable through low-level PDF text extraction but absent from Docling/Xberg should remain represented if still available.

If the existing C5.3 sample needs a small adjustment, make it explicit and document why.

Do not invent a generalized sampling taxonomy merely for this rollout.

---

## 9. Rollout tooling preference

Use the existing durable processing and administrative boundary wherever
practical.

Prefer extending or reusing:

```text
app/processing-admin.mjs
```

and existing processing-store/worker functionality over introducing a
parallel rollout execution path.

A C5.3.2-specific helper is acceptable only where the existing
administration interface is materially insufficient for sample
orchestration, inspection, or compact rollout reporting.

Any such helper must remain narrow, repository-internal, and specific to
this validation phase.

---

## 10. Rollout execution

Use the existing durable processing boundary.

Prefer the current repository mechanisms such as:

```text
node ./app/processing-admin.mjs enqueue ...
node ./app/processing-worker.mjs ...
node ./app/processing-admin.mjs inspect-representation ...
```

or their actual current equivalents.

Do not create a parallel execution path for PDF evidence rollout.

If the existing CLI makes repeated representative validation materially awkward, minimal C5.3.2-specific helper tooling is allowed.

Before adding such tooling, inspect the existing:

```text
app/phase-c5.3.2-rollout.mjs
```

and reuse/complete it if appropriate rather than creating competing tooling.

Permitted tooling should remain narrowly limited to things such as:

* selecting/identifying the rollout sample;
* listing evidence representations for a binary;
* inspecting native JSON evidence metadata;
* reporting text lengths;
* reporting signature counts;
* reporting evidence-channel status;
* producing a compact machine-readable rollout summary.

Keep any such tooling:

* local;
* repository-internal;
* CLI-oriented;
* bounded to C5.3.2 validation.

Do not build a generalized reporting platform.

---

## 11. Staged and resumable rollout

The representative sample does not need to be processed in one
uninterrupted pass.

Slow or expensive processors such as Docling and OCR may be run over the
selected sample in bounded, staged, resumable batches.

Reuse durable processing/job state rather than restarting completed work
merely for rollout convenience.

The requirement is complete validation of the selected representative
sample, not continuous execution in a single session.

Do not broaden the sample or trigger full-corpus processing simply
because staged execution is available.

---

## 12. Per-document validation matrix

Produce a compact result record for every evaluated PDF.

At minimum capture:

### Identity

* `file_binary_id`
* SHA-256
* useful document/source label where readily available
* `machine_readability_status`
* page count where available

### `pdf_literal_text`

* applicable/expected?
* produced?
* representation id
* text length
* provenance/status
* whether it materially adds evidence beyond Docling/Xberg
* short description of the additional evidence when relevant

### `pdf_signature_metadata`

* produced?
* representation id
* signature inspection status
* signature count
* whether results match the expected document shape
* any inspection failure versus actual absence distinction

### `pdf_structure_inventory`

* produced?
* representation id
* native-text status
* raster-content status
* annotations status
* widget/AcroForm status
* signature status
* embedded-file indicator status
* any channel inspection failures

### `pdf_ocr_text`

* applicable under current policy?
* produced?
* representation id
* text length
* whether it materially adds evidence
* whether execution matches the current OCR policy

### Interpretation comparison

* Docling available?
* Xberg available?
* material omission/disagreement relevant to evidence validation?

### Classification

End each document with exactly one primary rollout classification:

* `expected`
* `implementation_defect`
* `policy_gap`
* `deferred_channel_opportunity`

Interesting behavior does not automatically become implementation scope.

---

## 13. “Material evidence addition”

Do not build a scoring/confidence framework.

For C5.3.2, “materially adds evidence” is a narrow review judgment.

Examples include:

* visible signature-appearance text present in `pdf_literal_text` but absent from Docling/Xberg;
* OCR text recovered from an image-heavy PDF where interpretation text is absent or materially thinner;
* signature/form/structure evidence exposed by evidence artifacts but not reflected in interpretation output.

Do not equate:

```text
more text
```

with:

```text
better interpretation
```

or with:

```text
greater legal significance
```

Do not automate truth selection.

---

## 14. Required implementation validation

Validate the implementation actually present in the repository.

At minimum confirm:

1. evidence processors run through the existing processing boundary;

2. repeated processing does not incorrectly overwrite a successful existing representation or mutate representation identity merely because processing is retried;

3. expected artifact kinds and provenance are persisted;

4. artifacts remain traceable to the exact source binary and relevant processor/configuration identity;

5. `pdf_structure_inventory` does not serialize a failed inspection as false evidence absence;

6. `pdf_signature_metadata` records evidence/inspection information without implying legal validity, certificate trust, or cryptographic validation beyond what the underlying tool actually establishes;

7. `pdf_ocr_text` runs only under the bounded current policy unless a concrete tested defect requires a narrowly justified correction;

8. OCR-derived text remains semantically distinct from literal/native PDF text;

9. existing Docling/Xberg representation identities and artifacts remain intact;

10. canonical/domain identities and source binaries remain unchanged;

11. consultation-facing behavior remains unchanged;

12. repeated rollout execution is safe and does not create incorrect duplicate or replacement state.

Run relevant focused automated tests.

Run:

```text
git diff --check
```

Do not run expensive full-corpus processing merely as regression ceremony.

---

## 15. Defect handling during rollout

C5.3.2 is validation-first, but concrete defects in the already implemented C5.3.1 slice may be fixed when all of the following are true:

* the defect is demonstrated by the representative rollout;
* the expected behavior is already clear from existing C5.3/C5.3.1 architecture;
* the correction is narrow;
* it does not introduce a new evidence channel or redesign the architecture;
* focused regression validation is added where appropriate.

Classify and document the defect before broadening implementation.

If the rollout reveals a larger architectural question, policy expansion, or missing evidence channel, record it rather than solving it automatically.

---

## 16. Explicitly out of scope

Do not:

* implement a new PDF evidence channel merely because rollout identifies one;
* add generalized annotation extraction/persistence;
* add embedded-file extraction if it is not already part of the implemented evidence slice;
* add revision-chain persistence;
* implement certificate trust-chain validation;
* infer legal signature validity;
* broaden OCR heuristics beyond the current bounded policy unless a demonstrated C5.3.1 defect requires a minimal correction;
* redesign representation selection;
* merge evidence channels into synthetic truth;
* expose PDF evidence artifacts as default consultation representations;
* build consultation UI;
* add viewer/Directus features;
* add search indexing;
* build retrieval;
* add embeddings;
* add semantic/legal extraction;
* add summarization;
* add AI-serving functionality;
* introduce remote/network document processing;
* migrate processing to WSL/remote infrastructure;
* Dockerize the processing architecture as part of this phase;
* implement Docker-first portability;
* process the full corpus;
* start the next phase.

Docker-first/portability work remains a separate operational track.

C5.3.2 validates the evidence architecture that later deployment infrastructure should package; it must not become a Dockerization task.

If a high-value missing evidence channel is discovered, classify it as:

```text
deferred_channel_opportunity
```

and document it for a later deliberate phase.

---

## 17. Rollout findings

Produce a durable C5.3.2 rollout result with:

* exact sample-selection basis;
* exact evaluated PDFs;
* per-document validation matrix;
* aggregate result counts;
* material literal-text evidence gains;
* OCR-policy results;
* signature metadata results;
* structure-inventory results;
* implementation defects found;
* policy gaps found;
* deferred-channel opportunities;
* any minimal fixes made;
* validation after fixes;
* recommended next narrow step.

Keep findings evidence-based.

Do not generalize corpus-wide conclusions beyond what the selected sample supports.

---

## 18. Recorded-run requirements

This C5.3.2 execution is an explicitly recorded run.

Use the repository's existing recorded-run workflow.

The agreed discussion prompt must first be frozen through:

```text
scripts/start-agent-run.ps1
```

using an appropriate task id such as:

```text
C5.3.2-targeted-pdf-evidence-rollout
```

The helper-generated command must execute the frozen:

```text
docs/agent-runs/<task-id>/prompt.md
```

not the mutable discussion file and not separately pasted chat content.

During execution, maintain:

```text
docs/agent-runs/<task-id>/report.md
```

as required by `AGENTS.md`.

The recorded-run material is historical/audit evidence only and does not become architecture authority.

---

## 19. Final report

The durable recorded-run report should concisely include, as applicable:

* outcome: completed / partial / blocked;
* files changed;
* exact sample-selection basis;
* exact evaluated PDFs;
* commands/paths used for rollout;
* per-document matrix or durable location of that matrix;
* aggregate counts for:

  * `expected`
  * `implementation_defect`
  * `policy_gap`
  * `deferred_channel_opportunity`
* PDFs with material `pdf_literal_text` evidence gain;
* OCR-policy findings;
* signature-metadata findings;
* structure-inventory findings;
* concrete C5.3.1 defects found;
* fixes made, if any;
* policy gaps;
* deferred-channel opportunities;
* relevant focused validation;
* intentional deviations/findings;
* task-related residue;
* unrelated working-tree state;
* exact recommended next step.

Follow the existing `AGENTS.md` final-report convention rather than inventing a competing reporting format.

---

## 20. Commit checkpoint

C5.3.2 should end in an explicit Git checkpoint.

After the targeted rollout, any narrowly justified C5.3.1 fixes,
validation, and the durable C5.3.2 findings/report are complete:

1. perform a narrow final review of the intended C5.3.2 changes;
2. confirm unrelated working-tree changes remain untouched;
3. run the required focused validation and `git diff --check`;
4. complete the recorded-run report;
5. explicitly stage only the intended C5.3.2 files;
6. review the staged diff;
7. commit the completed C5.3.2 scope.

The required checkpoint invariant is:

* all intended C5.3.2 work is committed;
* no C5.3.2 task residue remains;
* unrelated pre-existing working-tree changes may remain untouched.

Report the commit hash/message and remaining unrelated working-tree
state, then stop.

Do not begin the next phase after committing C5.3.2.

---
