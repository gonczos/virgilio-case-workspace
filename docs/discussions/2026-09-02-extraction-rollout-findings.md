# Extraction rollout findings

Date: 2026-09-02

Status: observational report. This document records what was observed and
decided during the recent extraction rollout and follow-up investigation. It
does not replace the architecture documents or redefine any representation as
canonical evidence.

## Executive summary

The rollout produced useful coverage across the corpus, but it also showed that
the current queue and worker controls are not yet mature enough for unattended
mass ingestion. With hands-on inspection, processor-specific partitioning,
bounded concurrency, and targeted retries, processing became substantially
faster and more stable. The same improvements are not yet fully encoded as an
automatic operating policy.

Several apparent extractor failures were actually defects in our integration:
warning output broke a JSON response contract, Xberg NUL characters reached a
PostgreSQL-incompatible text field, qpdf warning exit codes were treated as
fatal, and whitespace-only PDF text was classified as meaningful native text.
Preserving historical job attempts allowed these defects to be distinguished
from later successful runs instead of rewriting the history.

No extraction tool proved universally authoritative. Docling and Xberg provide
useful document interpretations, but their readable projections can omit,
reorder, normalize, or classify material differently. The PDF evidence
processors make narrower and clearer claims about specific binary channels,
but their results still depend on parser behavior, tool compatibility, and the
meaning assigned to each channel. Original binaries remain the canonical
evidence.

## Scope and evidence used

This report combines:

- persisted PostgreSQL processing jobs, representations, warnings, and
  provenance;
- bounded real-document runs and targeted retries;
- the earlier 24-PDF adversarial sample;
- full-corpus follow-up diagnostics;
- worker and subprocess output;
- direct inspection of derived artifacts;
- the repository's recorded evaluation and implementation notes;
- the decisions made interactively while reviewing the backoffice coverage
  report and binary detail view.

The report does not infer source truth from agreement between extractors. It
records tool output and operational behavior as observations.

## Environment evidence

| Aspect | Observed environment | Operational consequence |
|---|---|---|
| Host | Windows-local processing | Native Python packages and subprocess exit codes must be interpreted in the Windows environment. |
| State store | PostgreSQL | Job history, representations, warnings, selections, and lineage remain durable and queryable. PostgreSQL rejects `U+0000` in text values. |
| Binary access | Repository storage abstraction and local materialization | Application processing remained traceable to the stored binary without exposing machine paths through the UI or API. |
| Python runtime | `.venv-processing\Scripts\python.exe` | The virtual environment depends on its base Python installation. A sandboxed diagnostic attempt failed before Docling because access to that base executable was denied. |
| Docling | `2.123.1`, representation identity `2.123.1-c5.2` | Requires local model assets and has a relatively heavy initialization and processing footprint. |
| Xberg | `1.0.14`, representation identity `1.0.14-c5.2` | Faster/moderate interpretation path, but emitted NULs on some otherwise readable PDFs and could not parse some malformed image-only PDFs. |
| OCR | Docling/RapidOCR-based | Expensive on large image-only documents and shares resource pressure with Docling. |
| PDF evidence tools | Poppler `pdftotext`/`pdfinfo` and qpdf | Cheap, narrow evidence channels; dependent on executable availability and parser/exit-code behavior. |
| Model access | Offline mode with repository-local Docling model cache | Avoided network dependency, but older runs showed that a fresh or wrong cache path causes failures before useful extraction. Reproducible cache bootstrap remains incomplete. |

Differences from older runs were material. Earlier Docling failures occurred
when a fresh runtime cache could not resolve models offline; later runs reused
the prepared local cache. Earlier processing also used a shared 15-minute
Python timeout and allowed independently started workers to contend without a
processor-specific concurrency policy. The current policy uses explicit
processor timeouts, priorities, and a shared heavy concurrency limit.

## Processing strategy and initial results

The work was partitioned by cost and by the kind of claim each processor makes.
Cheap evidence extraction was allowed to progress independently of expensive
interpretation and OCR.

| Lane | Processors | Priority/class | Initial operational result |
|---|---|---|---|
| Plain text | `plain_text_passthrough` | Fast, highest priority | Straightforward and inexpensive for text files. |
| Literal PDF evidence | `pdf_literal_text` | Fast | Completed across the 24-PDF sample after correcting whitespace-only semantics. |
| Signature evidence | `pdf_signature_metadata` | Fast | Reliable after qpdf warning exit code 3 was accepted as a warning-bearing result rather than a hard failure. |
| Structure evidence | `pdf_structure_inventory` | Fast | Reliable across the sample after the same qpdf compatibility correction and native-text classification fix. |
| Xberg interpretation | `xberg` | Moderate | Available on all 24 sampled PDFs; later full-corpus work exposed persistence and malformed-PDF failure classes. |
| Docling interpretation | `docling` | Heavy | Useful across text and image PDFs, but three sample jobs timed out under the earlier policy. |
| Rendered-page OCR evidence | `pdf_ocr_text` | Very heavy | Applicable to six of the 24 sampled PDFs; five initially completed and one timed out. |

The 24-PDF sample deliberately included ordinary text PDFs, signed PDFs,
multi-signature candidates, mixed PDFs, image-only and mostly-image PDFs,
long documents, different producers, and known disagreements between literal
PDF text and interpretation outputs. Its initial primary classifications were:

| Classification | Documents | Meaning at that checkpoint |
|---|---:|---|
| Expected | 18 | Available channels behaved within their intended contracts. |
| Policy gap | 3 | Heavy processing did not complete under the then-current operational policy. |
| Deferred channel opportunity | 3 | Existing evidence indicated useful future work without proving an implementation defect. |
| Implementation defect | 0 after correction | The concrete whitespace classification defect was fixed and revalidated before the final sample classification. |

## Queue and worker findings

The original queue was effectively FIFO by request time and job id. One worker
handled one job at a time, but multiple workers could be started independently.
There was no processor-specific concurrency limit, so cheap jobs could wait
behind heavy jobs and multiple Docling/OCR processes could compete for CPU and
memory.

The corrective policy introduced:

| Processor group | Timeout | Claim priority | Concurrency behavior |
|---|---:|---:|---|
| Plain text | 2 minutes | 500 | Fast lane |
| Literal PDF evidence | 2 minutes | 400 | Fast lane |
| Signature evidence | 2 minutes | 390 | Fast lane |
| Structure evidence | 2 minutes | 380 | Fast lane |
| Xberg | 10 minutes | 300 | Moderate lane |
| Docling | 45 minutes | 200 | Shared heavy group, maximum one running |
| OCR evidence | 45 minutes | 100 | Shared heavy group, maximum one running |

This prevented a running heavy job from blocking claimable cheap evidence and
prevented Docling and OCR from competing within the controlled worker policy.
Retries create new job rows with `max_attempts = 1`; they do not mutate failed
history into success. Existing successful representation identities are not
duplicated or overwritten.

These controls improved the situation but do not yet constitute an unattended
mass-ingestion scheduler. Operators still had to identify stale workers,
separate historical from current failures, choose bounded retry sets, ensure
the correct code version was loaded, and tune the active worker mix. A stale
worker during one validation round claimed jobs using an older in-memory
processor version; it had to be stopped before the corrected jobs were rerun.

## Defects and compatibility problems

The distinction between extractor failure and integration failure was essential.

| Area | Ownership | Observed symptom | Finding and response |
|---|---|---|---|
| Docling JSON subprocess response | Our adapter/protocol boundary plus third-party logging behavior | Node reported `Unexpected non-whitespace character after JSON`; extractor output contained warnings before a complete JSON result. | Docling had completed and written artifacts. Redirecting ordinary Python stdout was insufficient for diagnostics emitted below that layer. These rows were retained historically; later runs succeeded. The protocol should not assume that a complex third-party process keeps stdout perfectly clean. |
| qpdf exit code 3 | Our CLI compatibility handling | Signature and structure jobs were marked failed even though qpdf returned usable warning-bearing output. | Exit code 3 was recognized correctly, and bounded retries produced successful evidence representations. |
| Whitespace-only `pdftotext` output | Our evidence semantics | Image-only PDFs containing only form feeds or whitespace were reported as having native text. | Added meaningful-text measurement. Whitespace-only output is now an empty literal result and structure inventory reports native text as absent. |
| Xberg NUL persistence | Our persistence boundary, triggered by Xberg output | PostgreSQL rejected `document_segment.text_content` with `invalid byte sequence ... 0x00`. | Remove only `U+0000` from the PostgreSQL text projection. Preserve the original Xberg artifact unchanged and record a structured warning with the exact removal count. Five targeted retries then completed. |
| Representation comparison ordering | Our comparison code | A comparison violated the numeric pair-order constraint. | Pair identity had been ordered lexicographically. Numeric canonical ordering fixed the issue; the historical failed attempt remains. |
| Rollout helper with no new work | Our rollout orchestration | A safe rerun could remain in the worker loop when nothing was queued. | The helper now exits cleanly on a no-op rerun. |
| Shared Python timeout | Our operational policy | Docling and OCR failures were flattened under one 15-minute limit. | Added processor-specific timeouts and persisted `processor_timeout` separately from generic failure. |
| Uncoordinated heavy workers | Our operational controls | Multiple Docling/OCR processes could contend and degrade throughput or stability. | Added a PostgreSQL-guarded shared heavy concurrency group with a limit of one. |
| Offline Docling model lookup | Environment/bootstrap | Early jobs failed when a fresh runtime cache attempted unavailable model resolution. | Reused the known local model cache and set offline runtime variables. Reproducible cache preparation remains a setup gap. |
| Diagnostic sandbox access | Diagnostic environment, not corpus or processor semantics | One controlled Docling retry failed with code 103 because the virtual environment could not access base Python. | Preserved the failed diagnostic job, reran with appropriate local runtime access, and did not classify it as a document failure. |
| Docling native access violation | Third-party/native runtime or dependency stack | Four text PDFs failed with Windows `0xC0000005` shortly after model loading. | An isolated retry reproduced the crash once, but subsequent sequential runs succeeded with `ocr_mode=never`. This demonstrated intermittent runtime behavior rather than unreadable PDFs. No unsupported causal claim was made. |
| Xberg malformed PDF/OCR handling | Xberg/parser compatibility | Nine image-only PDFs failed during PDF parsing or after all OCR backends failed. | Kept separate from the fixed NUL persistence class. These remain honest unresolved compatibility failures rather than queue or PostgreSQL failures. |

## Targeted recovery results

Targeted retries were used only after the failure class was understood. This
avoided broad corpus reruns and preserved durable history.

### Heavy timeout correction

| Processor | Binary class | Pages | Controlled result |
|---|---|---:|---|
| Docling | Text PDF | 190 | Completed in about 5m 23s |
| Docling | Image-only PDF | 88 | Completed in about 7m 58s |
| Docling | Image-only PDF | 86 | Completed in about 6m 47s |
| OCR evidence | Image-only PDF | 88 | Completed in about 8m 07s |

These runs showed that page count alone does not predict cost: the 190-page
text PDF completed faster than the two shorter image-only Docling jobs.

### Intermittent Docling text-PDF failures

Four fully text-readable PDFs (3, 3, 4, and 63 pages, each with 100% page text
coverage) had failed with `0xC0000005`. They were rerun one at a time with
`ocr_mode=never`. All four produced successful representations. The first
binary crashed once again before succeeding on the next isolated attempt; the
other three succeeded on their first controlled attempt.

### Xberg NUL persistence failures

Five text PDFs had extracted successfully but could not be persisted. After
the sanitation-and-warning fix, one worker processed the five jobs
sequentially.

| New representation | NULs removed from PostgreSQL projection | Original artifact |
|---:|---:|---|
| 6250 | 4 | Preserved with 4 NULs |
| 6251 | 5 | Preserved with 5 NULs |
| 6252 | 96 | Preserved with 96 NULs |
| 6253 | 4 | Preserved with 4 NULs |
| 6254 | 96 | Preserved with 96 NULs |

Every persisted segment contained zero NULs, its character boundary matched
the sanitized string length, and its representation carried a warning. No
other character was deliberately changed.

The post-retry Xberg snapshot was: 0 queued, 0 running, 1,229 completed job
rows, and 14 historical failed job rows. Those completed jobs cover 1,229
distinct binaries. Five of the failed rows now have a successful replacement;
the remaining nine binaries without an Xberg success are the image-only
PDF parse/OCR compatibility cases.

## Tool-specific lessons

| Tool/channel | Strengths observed | Shortcomings and cautions | Appropriate claim |
|---|---|---|---|
| Original binary | Stable object to hash, retain, and revisit | Human meaning still requires tools and interpretation | Canonical evidence object |
| `pdf_literal_text` / `pdftotext -layout` | Cheap; preserves literal text that Docling/Xberg sometimes omitted, including visible signature-appearance text | Whitespace/form-feed output can look non-empty; ordering and encoding remain tool interpretations | Recoverable literal PDF text channel, not the complete meaning of the document |
| `pdf_signature_metadata` / qpdf | Cheap, explicit signature dictionary/count evidence | Exit-code warnings require correct handling; metadata does not prove visual appearance or legal validity | Signature-related PDF structure detected by the configured parser |
| `pdf_structure_inventory` | Clear inventory of native text, raster content, annotations, forms, signature structures, and embedded-file indicators | Parser compatibility and channel-presence rules still require cautious interpretation | Presence/absence observations for enumerated PDF structures |
| Docling | Strong structured document model, Markdown, reading order, tables, and BODY/FURNITURE distinctions | Heavy; native-runtime instability was observed; readable BODY projection can omit material classified as furniture; logging can violate a naive stdout JSON protocol | Attributable document interpretation with explicit profile and artifacts |
| Xberg | Moderate-cost text extraction; good results across the adversarial sample; preservation-oriented header/footer configuration | Can emit PostgreSQL-incompatible NULs; some malformed/image-only PDFs fail parsing/OCR; structure and filtering differ from Docling | Independent attributable interpretation, not a replacement for evidence channels |
| OCR evidence | Recovers text from rendered pages where native text is absent | Expensive; may return little or no text; OCR errors and layout loss remain possible | Text recognized from rendered-page imagery |

A central lesson is that reading convenience and information preservation are
different goals. A clean body-oriented reading view can be useful while still
omitting headers, footers, signature appearances, marginal material, or other
legally relevant content. The solution is not to declare one projection
authoritative, but to preserve multiple attributable outputs and expose their
lineage and purpose.

## Evidence versus interpretation

The term "evidence" in the application describes a narrower contract, not
infallibility.

| Layer | Contract style | Caution |
|---|---|---|
| Binary | Exact retained bytes identified by SHA-256 | Canonical object, but its content still needs parsing or rendering. |
| Evidence processor | Narrow observation about a defined PDF channel | Results depend on the named tool/version/configuration and may fail on malformed or unusual PDFs. Absence reported by one parser is not universal proof of absence. |
| Interpretation processor | Human- or downstream-oriented reading, structure, or projection | May normalize, reorder, classify, or omit content for readability. Independent outputs must not be silently merged into synthetic truth. |
| Human selection | Explicit choice of a representation for a purpose | Overrides automatic consultation policy but does not alter the binary or erase alternative outputs. |

Agreement between tools increases confidence in a particular observation but
does not make their shared output canonical truth. Disagreement is useful data
and should remain visible.

## Human-system interaction and decisions

The investigation was conducted as an iterative operator-assisted process:

| Interaction | Observation | Joint decision |
|---|---|---|
| Review extraction coverage in the backoffice | Job-round history obscured whether usable output existed. | Report coverage per binary and processor based on whether any successful representation exists; retain historical failures separately. |
| Add signature and full SHA-256 visibility | Short identifiers and omitted signature status slowed inspection. | Show the complete binary identity and all evidence/interpretation columns. |
| Improve table behavior | Hand-built fixed columns impeded inspection. | Use a maintained grid component with filtering and resizable columns rather than extending a custom grid. |
| Inspect binary details side by side | The right panel consumed space and duplicated controls/headings. | Use fixed-height scrollable panes, open-by-default accordions, and one searchable grouped source selector. Remove confusing "Effective" badges while retaining selection behavior. |
| Investigate Docling failures | Text-readable PDFs appeared to have failed extraction. | Inspect persisted error text before rerunning; separate JSON response pollution, native crashes, and environment denial. Retry only bounded cases sequentially. |
| Investigate Xberg failures | Text PDFs failed despite successful extraction output. | Treat NUL rejection as our persistence bug, preserve the artifact, sanitize only the database projection, signal a warning, and rerun exactly five affected binaries. |

This interaction pattern was productive because operational conclusions were
made from persisted evidence before mutations were authorized. The operator
provided priorities and semantic choices; the system inspection supplied job,
artifact, environment, and source-code evidence; implementation and retries
were then bounded to the agreed class.

## Assessment of unattended ingestion readiness

The current system is usable for controlled corpus processing, but premature
for fully unattended mass ingestion.

| Capability | Current state | Needed for unattended operation |
|---|---|---|
| Durable jobs and provenance | Present | Retain |
| Historical attempt preservation | Present | Retain |
| Processor priorities and timeouts | Present, basic | Tune from observed workload and surface policy clearly |
| Heavy concurrency control | Present for Docling/OCR | Extend resource-aware scheduling beyond a single static group where justified |
| Retry policy | Manual, provenance-preserving | Add bounded classification-aware retry/backoff without converting deterministic failures into retry storms |
| Worker version awareness | Not sufficient | Prevent stale workers from claiming jobs after processor policy/version changes |
| Capability/readiness checks | Partial | Verify Python, executables, model caches, storage, and database compatibility before claiming work |
| Error classification | Mostly reconstructed from text | Persist structured failure classes and relevant subprocess details |
| Warning protocol | Present in selected representations | Standardize warning shape and expose it consistently in consultation surfaces |
| Progress and cost estimation | Limited | Capture page/document phase progress and use more than page count for planning |
| Operational controls | Hands-on CLI/process steering | Provide bounded pause/drain/retry controls and clear worker ownership without introducing unnecessary distributed infrastructure |

Hands-on steering currently improves both speed and stability because it can
partition cheap and expensive work, stop stale workers, serialize unstable
native workloads, avoid broad retries, and react to specific failure classes.
Automation should encode these proven decisions incrementally rather than add a
large queue framework without evidence that it is required.

## Recommended next steps

1. Keep the current original-binary, evidence, and interpretation boundaries.
2. Standardize structured processor warnings and structured failure classes.
3. Harden the subprocess response contract so third-party stdout diagnostics
   cannot invalidate an otherwise complete JSON result.
4. Add worker build/version identity and a drain mechanism so stale processes
   cannot claim newly versioned work.
5. Add readiness checks for the Python runtime, local model cache, Poppler, and
   qpdf before work is claimed.
6. Keep retries targeted and provenance-preserving; add automatic retry only
   for demonstrated transient classes.
7. Investigate the nine remaining Xberg image-only PDF parse/OCR failures as a
   separate compatibility class, without conflating them with the fixed NUL
   persistence defect.
8. Continue using bounded adversarial samples before full-corpus processing,
   then use the backoffice coverage matrix to identify gaps in usable outputs.

## Final observation

The rollout succeeded not because one extractor was universally reliable, but
because independent outputs, durable provenance, failure history, and focused
operator decisions made problems diagnosable. The next operational goal should
be to encode the successful parts of that steering while preserving the same
caution about evidence, interpretation, and tool-specific limits.
