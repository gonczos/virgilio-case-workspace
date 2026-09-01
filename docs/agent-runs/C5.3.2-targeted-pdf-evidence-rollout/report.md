# Task Report - C5.3.2-targeted-pdf-evidence-rollout

## Outcome

Completed

## Changes

- Reused and completed the pre-existing phase helper in `app/phase-c5.3.2-rollout.mjs` instead of creating competing rollout tooling.
- Fixed a C5.3.2 helper bug: safe reruns with no newly queued sample work now exit cleanly instead of hanging in the worker loop.
- Tightened the helper's rollout classification/reporting logic so timeout-driven rollout gaps are not flattened into `expected`.
- Fixed a concrete C5.3.1 evidence-semantics defect in `app/pdf-evidence.mjs`: whitespace-only `pdftotext` output now counts as an empty literal-text result and no longer causes `pdf_structure_inventory.channels.native_text` to be recorded as `present`.
- Versioned the semantic fix in `app/processing-registry.mjs` as:
- `pdf_literal_text` -> `poppler-layout-v2-c5.3.2`
- `pdf_structure_inventory` -> `qpdf-structure-v2-c5.3.2`
- Added focused regression coverage in `test/phase-c5.3.1.test.mjs` and `test/phase-c5.3.2-rollout.test.mjs`.
- Maintained the recorded-run material in:
- `docs/agent-runs/C5.3.2-targeted-pdf-evidence-rollout/prompt.md`
- `docs/agent-runs/C5.3.2-targeted-pdf-evidence-rollout/report.md`

## Validation

- Read repository instructions and architecture before changes:
- `AGENTS.md`
- `docs/architecture/07-consolidated-architecture-reference.md`
- `docs/architecture/08-postgres-schema-v2-evolution-plan.md`
- Sample basis reused from the curated 24-PDF C5.3 sample documented in `docs/discussions/C5.3_2.md` and `docs/discussions/C5.3_1.md`.
- Verified the current processing policy and runtime boundaries in:
- `app/processing-registry.mjs`
- `app/processing-store.mjs`
- `app/processing-admin.mjs`
- `app/processing-worker.mjs`
- `app/representation-artifacts.mjs`
- `app/pdf-evidence.mjs`
- Focused automated tests:
- `node --test test/phase-c5.3.1.test.mjs test/phase-c5.3.2-rollout.test.mjs`
- Safe rerun check for the rollout helper after the no-op fix:
- `node app/phase-c5.3.2-rollout.mjs --output-json $env:TEMP\\c5.3.2-rerun-summary.json`
- Rollout-state inspection commands used:
- `node app/processing-admin.mjs state`
- `node app/processing-admin.mjs inspect-jobs`
- phase-specific SQL probes through `node --input-type=module -`
- Bounded post-fix real-document validation rerun:
- enqueued only `pdf_literal_text` and `pdf_structure_inventory` for
- `02c8e7cee7eca2f83b98d64aa2dd64b1b888039210a8cbf5c2133322d1b1757e`
- `9d335b7bb946796c51c965d2cf39d8d6a0279e4d8a4bad558d13174e99d1fe79`
- `a7664cc72071b62f62dda2dd1da2ff63e2af65387f1b3d6380f805708ebae901`
- `6836f8732aae33a3bc79491748134bd2a77a7b48aeaa2cd7c66647ff1f468f1c`
- processed with:
- `node app/processing-worker.mjs --max-jobs 8`
- verified new versioned artifacts directly from:
- `data/exports/processing/pdf-literal-text/poppler-layout-v2-c5.3.2/.../native.json`
- `data/exports/processing/pdf-structure-inventory/qpdf-structure-v2-c5.3.2/.../native.json`

## Findings / deviations

- Recorded-run state:
- the frozen recorded-run prompt already existed at `docs/agent-runs/C5.3.2-targeted-pdf-evidence-rollout/prompt.md` when this execution started, so `scripts/start-agent-run.ps1` would now correctly refuse duplicate creation for the same task id.
- Actual repository HEAD at start of this work was `b0a1fb1` (`Refine C5.3.2 rollout prompt`), not an older discussion checkpoint.
- Initial working tree at start:
- modified: `package.json`
- modified: `test/phase-c5.3.1.test.mjs`
- untracked: `app/phase-c5.3.2-rollout.mjs`
- untracked: `docs/agent-runs/C5.3.2-targeted-pdf-evidence-rollout/`
- untracked: `tmp/`
- `package.json` and `tmp/` were treated as unrelated and left untouched.
- The pre-existing `test/phase-c5.3.1.test.mjs` change was relevant C5.3.2 isolation work and was kept in scope.
- A stale pre-patch rollout process was still polling the queue when the whitespace fix was first validated. It claimed the first bounded validation jobs with old in-memory processor versions. That stale session was terminated and the bounded validation rerun was repeated under fresh request id `phase-c5.3.2-native-text-fix-validation-r2`.

### Sample selection basis

- Exact sample basis: the adversarial 24-PDF C5.3 sample already documented in `docs/discussions/C5.3_2.md`, reused without broadening the corpus.
- Coverage in that sample:
- ordinary native-text PDFs
- signed PDFs
- multi-signature candidates
- `image_only_pdf`
- `mostly_image_pdf`
- `mixed_pdf`
- long/problematic PDFs
- different producer families
- known literal-text versus Docling/Xberg disagreement cases

### Aggregate rollout result

- Final per-document primary classifications after the narrow fix and post-fix validation:
- `expected`: 18
- `implementation_defect`: 0
- `policy_gap`: 3
- `deferred_channel_opportunity`: 3
- `pdf_literal_text`: 24/24 current sample representations produced.
- `pdf_signature_metadata`: 24/24 current sample representations produced.
- `pdf_structure_inventory`: 24/24 current sample representations produced.
- `pdf_ocr_text`: applicable on 6/24 under current policy; 5 completed and 1 timed out.
- Docling: available on 21/24 sampled PDFs during the original C5.3.2 rollout; 3 timeouts.
- Xberg: available on all 24 sampled PDFs in the rollout state.
- Cheap evidence channels were stable enough for later consumption work after the whitespace-only native-text fix.
- The next narrow instability is operational heavy-processor policy, not a new evidence channel.

### Material literal-text evidence gains

- Clear material `pdf_literal_text` evidence gain was confirmed on:
- `6836f8732aae33a3bc79491748134bd2a77a7b48aeaa2cd7c66647ff1f468f1c`
- `d53fe053bc35336d1f81787a2183b7745541d895251e288218e407ef7f37576f`
- `f5f9bb877c55df0189a530e567b5c5c3a87af01fc846b14f5f05cc9492729c10`
- In those signed PDFs, visible signature-appearance text was preserved by `pdf_literal_text` and absent from current Docling/Xberg text outputs.
- Other literal/interpretation differences existed across the sample, but they were not elevated to "material evidence gain" in this phase merely because token counts differed.

### OCR policy findings

- Current OCR gating was confirmed to remain bounded exactly where expected:
- `pdf_ocr_text` ran only for `image_only_pdf` and `mostly_image_pdf`
- it did not run for `text_pdf` or `mixed_pdf`
- Applicable sample PDFs under current policy:
- `02c8e7ce...`
- `5f3ff23a...`
- `9d335b7b...`
- `a7664cc7...`
- `beaae8ce...`
- `ec91590e...`
- Five applicable PDFs completed OCR under the current policy.
- One applicable PDF (`9d335b7b...`, 88-page `image_only_pdf`) timed out under the current 900000 ms budget and is a policy-gap case.

### Signature and structure findings

- `pdf_signature_metadata` and `pdf_structure_inventory` are operationally reliable cheap channels in the sampled state.
- Two historical failed job rows remained in rollout history for each of:
- `01b17cd7...`
- `0e661625...`
- Those failures were caused by earlier qpdf warning exit-code 3 handling and were later recovered by successful rerun state; they are historical attempts, not current evidence-channel breakage.
- Multi-signature candidates are real and preserved distinctly:
- `0e661625...` -> 2 signatures
- `d53fe053...` -> 3 signatures
- `a74153f1...` -> 6 signatures
- `f5f9bb87...` -> 11 signatures
- Embedded-file indicators remained absent across the sampled current structure inventories, including the two prior token-candidate PDFs.

### Concrete C5.3.1 defect found and fixed

- Defect: whitespace-only `pdftotext` output from image-only PDFs was being treated as native-text presence.
- Observed on:
- `02c8e7ce...` with 11 raw form-feed characters only
- `9d335b7b...` with 88 raw form-feed characters only
- `a7664cc7...` with 86 raw form-feed characters only
- Impact before fix:
- `pdf_literal_text.native.json` set `empty_result: false`
- `pdf_structure_inventory.channels.native_text.status` was recorded as `present`
- Why this was a real defect:
- it misreported evidence-channel presence on image-only PDFs
- it blurred the intended distinction between native PDF text and rendered-page/OCR text
- Fix:
- `pdf_literal_text` now records `meaningful_text_length` and treats trimmed whitespace-only output as `empty_result: true`
- `pdf_structure_inventory` now bases `native_text` on meaningful literal text and retains both raw and meaningful lengths in detail
- Versioned validation result on September 1, 2026:
- `02c8e7ce...` -> `empty_result: true`, `native_text: absent`
- `9d335b7b...` -> `empty_result: true`, `native_text: absent`
- `a7664cc7...` -> `empty_result: true`, `native_text: absent`
- control `6836f873...` remained `empty_result: false`, `native_text: present`

### Per-document matrix

Legend:
- `ocr`: `-` = not applicable, `timeout` = applicable but original C5.3.2 rollout did not finish, `ok:<len>` = produced with text length
- `doc` / `xbg`: interpretation availability in the original rollout state
- `native` values for `02c8e7ce...`, `9d335b7b...`, and `a7664cc7...` reflect the post-fix v2 validation result

```text
00445e90 text_pdf p1   literal=11     sig=0  native=present raster=present ann=absent form=absent sigch=absent emb=absent ocr=-        doc=ok:8      xbg=ok:0      class=expected                     clean 1-page text PDF
00b7b153 text_pdf p1   literal=802    sig=0  native=present raster=present ann=absent form=absent sigch=absent emb=absent ocr=-        doc=ok:133    xbg=ok:648    class=expected                     old simple text PDF
013097e8 text_pdf p1   literal=2024   sig=1  native=present raster=absent  ann=present form=present sigch=present emb=absent ocr=-     doc=ok:1502   xbg=ok:1464   class=expected                     recent signed 1-page PDF
01b17cd7 text_pdf p1   literal=1168   sig=0  native=present raster=absent  ann=absent form=absent sigch=absent emb=absent ocr=-       doc=ok:875    xbg=ok:901    class=expected                     embedded-file token candidate
02c8e7ce image_only p11 literal=11    sig=0  native=absent  raster=present ann=absent form=absent sigch=absent emb=absent ocr=ok:20269 doc=ok:19452  xbg=ok:21217  class=expected                     image-only OCR case
02f720c5 text_pdf p1   literal=2306   sig=1  native=present raster=present ann=present form=present sigch=present emb=absent ocr=-      doc=ok:1344   xbg=ok:1641   class=expected                     signed 1-page appeal PDF
0d229a57 mixed_pdf p35 literal=71548  sig=0  native=present raster=absent  ann=present form=absent sigch=absent emb=absent ocr=-       doc=ok:61885  xbg=ok:62041  class=expected                     mixed PDF with annotations token
0e661625 text_pdf p6   literal=16589  sig=2  native=present raster=present ann=present form=present sigch=present emb=absent ocr=-      doc=ok:12123  xbg=ok:12012  class=deferred_channel_opportunity  two-signature candidate
17eb40fa text_pdf p5   literal=12375  sig=0  native=present raster=absent  ann=absent form=absent sigch=absent emb=absent ocr=-        doc=ok:9420   xbg=ok:9546   class=expected                     clean text high-disagreement case
24c8c654 text_pdf p23  literal=48212  sig=0  native=present raster=present ann=absent form=absent sigch=absent emb=absent ocr=-        doc=ok:46881  xbg=ok:53521  class=expected                     appeal annex header/footer case
414999a9 mixed_pdf p5  literal=6309   sig=0  native=present raster=present ann=absent form=absent sigch=absent emb=absent ocr=-        doc=ok:5442   xbg=ok:5110   class=expected                     short mixed PDF
5f3ff23a mostly_img p88 literal=107   sig=0  native=present raster=present ann=absent form=absent sigch=absent emb=absent ocr=ok:148263 doc=ok:146158 xbg=ok:151534 class=expected                     mostly-image long PDF
6836f873 text_pdf p5   literal=14010  sig=1  native=present raster=present ann=present form=present sigch=present emb=absent ocr=-      doc=ok:10708  xbg=ok:11556  class=expected                     signed regression case
72b005fb mixed_pdf p175 literal=350099 sig=0 native=present raster=present ann=absent form=absent sigch=absent emb=absent ocr=-        doc=ok:258208 xbg=ok:256682 class=expected                     long mixed/scanned PDF
90f61798 text_pdf p1   literal=1054   sig=0  native=present raster=absent  ann=absent form=absent sigch=absent emb=absent ocr=-        doc=ok:748    xbg=ok:756    class=expected                     embedded-file token candidate
9d335b7b image_only p88 literal=88    sig=0  native=absent  raster=present ann=absent form=absent sigch=absent emb=absent ocr=timeout   doc=timeout   xbg=ok:151888 class=policy_gap                   image-only long PDF
a74153f1 text_pdf p190 literal=350899 sig=6  native=present raster=present ann=present form=present sigch=present emb=absent ocr=-      doc=timeout   xbg=ok:296946 class=policy_gap                   long AcroForm multi-signature candidate
a7664cc7 image_only p86 literal=86    sig=0  native=absent  raster=present ann=absent form=absent sigch=absent emb=absent ocr=ok:91686  doc=timeout   xbg=ok:101970 class=policy_gap                   image-only VersaLink PDF
adcde0cb mixed_pdf p22 literal=7131   sig=0  native=present raster=present ann=absent form=absent sigch=absent emb=absent ocr=-        doc=ok:5739   xbg=ok:6099   class=expected                     form-like mixed PDF
beaae8ce mostly_img p16 literal=25    sig=0  native=present raster=present ann=absent form=absent sigch=absent emb=absent ocr=ok:0      doc=ok:0      xbg=ok:7190   class=expected                     mostly-image OCR case
ce057435 mixed_pdf p12 literal=17366  sig=0  native=present raster=present ann=absent form=absent sigch=absent emb=absent ocr=-        doc=ok:12150  xbg=ok:13406  class=expected                     mixed PDF disagreement case
d53fe053 text_pdf p25  literal=81155  sig=3  native=present raster=present ann=present form=present sigch=present emb=absent ocr=-      doc=ok:65203  xbg=ok:67597  class=deferred_channel_opportunity  appeal judgment signed PDF
ec91590e mostly_img p3 literal=31     sig=0  native=present raster=present ann=absent form=absent sigch=absent emb=absent ocr=ok:28     doc=ok:28     xbg=ok:3174   class=expected                     short mostly-image PDF
f5f9bb87 text_pdf p43  literal=104500 sig=11 native=present raster=present ann=present form=present sigch=present emb=absent ocr=-      doc=ok:74429  xbg=ok:74051  class=deferred_channel_opportunity  many-signature markers candidate
```

### Exact next narrow step

- Keep the cheap evidence-channel contract intact.
- Do not add a new evidence channel next.
- Do not broaden OCR eligibility next.
- The next narrow step should be an operational processing-policy pass over the expensive processors only:
- classify and address Docling/OCR timeout behavior on the three policy-gap PDFs
- retry only the genuine timeout cases
- leave signature/structure/literal evidence semantics unchanged except for the already-fixed whitespace bug

## Remaining task-related residue

- None after the C5.3.2 checkpoint commit.
- Historical processing-job rows remain in PostgreSQL by design, including:
- the original C5.3.2 timeout rows
- the earlier qpdf warning-exit-code failed attempts
- the bounded post-fix validation reruns
- Those rows are part of durable processing history and were not rewritten or deleted.

## Unrelated working-tree state

- Left untouched:
- `package.json`
- `tmp/`

## Recommended next step

- Start a narrow follow-up on heavy-processor execution policy only:
- classify and address the Docling/OCR timeout behavior on the three policy-gap PDFs
- retry only the genuine timeout cases
- keep the cheap evidence channels and their semantics unchanged apart from the already-completed whitespace fix

## Checkpoint note

- Commit hash/message are intentionally not embedded here. The Git commit containing this recorded run is the authoritative checkpoint identity.
