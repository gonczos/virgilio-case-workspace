# Labelled-reference-v5 corpus rollout plan

Status: documentation-only plan. This plan does not authorize corpus-wide
extraction, ingestion, database mutation, or API/UI changes.

## Purpose and prerequisite

The fixture-scoped v5 pipeline in commits `3d68c4e` and `a3a43f2` is the
reference implementation and permanent regression fixture. A corpus rollout
may reuse its extractor, identity inputs, provenance fields, lifecycle rules,
transactional behavior, and review-preservation guarantees. It must not widen
the v5 grammar, infer targets or relationships, or treat fixture performance as
corpus-wide recall.

Implementation begins only after this plan passes independent review and is
committed. The first implementation checkpoint is read-only inventory and dry
run. A later, explicit checkpoint is required before database writes.

## Live planning inventory

A read-only inventory on 2026-09-04 found 1,238 represented binaries and 6,182
representations in total. The candidate production text families currently
contain:

| Processor identity | Representations | Nonempty segments | Characters |
| --- | ---: | ---: | ---: |
| `pdf_literal_text` / `poppler-layout-v2-c5.3.2` | 1,238 | 1,238 | 9,110,814 |
| `docling` / `2.123.1-c5.2` | 1,238 | 1,217 | 8,148,756 |
| `xberg` / `1.0.14-c5.2` | 1,229 | 1,182 | 8,434,761 |

Together these production families contain 3,637 nonempty segments and
25,694,331 characters. The database also contains one 44-character Docling
test representation whose processor version ends in `retry-success-test`; it
is excluded. Signature and structure-inventory representations have no text
segments and are excluded. The existing v5 state is 111 canonical current
fixture observations plus 67 retained historical corrective observations.

These figures are a planning snapshot, not a frozen input list. The dry-run
inventory must record a new snapshot and its query/tool identity immediately
before rollout. The reviewed ranges are intentionally reference-rich: 111
positives in 6,297 reviewed code points. Their density must not be extrapolated
to the corpus. The projected observation count remains `measurement_pending`
until the complete read-only dry run.

## Eligible representations and processor boundaries

A representation is eligible only when all of the following hold:

- its processor key and exact version appear on an approved allowlist;
- it has at least one nonempty stored `document_segment`;
- every segment has a stable representation, segment, and binary identity;
- the representation content can be reconstructed deterministically by
  joining segments in `sequence_no` order with the established newline rule;
- representation and segment content hashes can be computed before planning;
- the v5 extractor and its function/configuration identity equal the frozen
  implementation.

The initial allowlist is limited to the three production identities in the
inventory table. New processor versions require a separate sampled audit and
plan amendment. The processor key/version allowlist and the presence of a
nonempty stored segment are the complete eligibility predicates for this
rollout. No name heuristic, processing-attempt status, later-success test, or
notion of a preferred/superseded representation may silently exclude a stored
representation. Every exclusion receives one of these stable reason codes:
`PROCESSOR_IDENTITY_NOT_ALLOWLISTED` or `NO_NONEMPTY_STORED_SEGMENT`.
Independent representations of the same binary remain
independent evidence-derived observations. Their outputs must never be merged
into synthetic truth or deduplicated merely because raw values match.

## Read-only inventory and projection gate

The rollout tool must have a default inventory/dry-run mode that opens a
repeatable-read, read-only transaction and issues no inserts, updates, deletes,
sequence calls, temporary persisted records, or lifecycle events. It must
produce deterministic machine-readable output containing:

- exact eligible processor identities;
- representation, segment, binary, nonempty-text, and character totals;
- excluded representation counts grouped by reason;
- predictions grouped by processor, rule, reference family, representation,
  and binary;
- distinct deterministic observation keys and duplicate-key diagnostics;
- proposed inserts, unchanged rows, reactivations, supersessions,
  source-absent retirements, and blocked/ambiguous reconciliations;
- estimated row and metadata payload bytes, reported as measured serialized
  plan size plus a documented database-overhead caveat;
- maximum observations for any representation, segment, and binary; and
- the extractor source identity, inventory query/tool version, database
  snapshot time, and hashes of the produced inventory artifacts.

No numeric write ceiling is inferred in advance. The dry-run report must
propose operational ceilings from measured p95/p99/max distributions and must
be independently reviewed. Write authorization requires an explicit accepted
upper bound for total observations, lifecycle mutations, transaction rows,
serialized metadata bytes, and elapsed time. Exceeding any accepted bound must
stop before writes.

## Sampled pre-ingestion audit

Before write authorization, freeze a deterministic audit sample selected from
the dry-run predictions. Selection uses a recorded seed and stable ordering and
must include, where present:

- every v5 rule and reference family;
- all three processor identities;
- reused binaries with more than one representation;
- the highest prediction-count representations and binaries;
- inherited-label and coordinated-reference forms;
- OCR-damaged or unusual spacing forms;
- proposed lifecycle reconciliation cases; and
- a random control stratum from predictions and a random stratum of eligible
  segments with no predictions.

The sample size and per-stratum quotas must be frozen before human review.
Review verifies exact spans, labels, provenance, rule attribution, false
positives, and absence of cross-representation borrowing. Errors are reported
by family and processor. Findings do not permit opportunistic sample expansion
or extractor tuning inside this rollout; a required grammar change returns to
a new versioned extraction evaluation.

## Deterministic identity, batching, and resumability

Corpus observations use the same
`reference-text-observation-identity-v1` tuple and normalization identity as
the fixture pipeline. A new nonfixture observation carries a versioned corpus
rollout ownership identity containing the frozen inventory artifact hash and
rollout version; the source representation and segment hashes remain part of
every observation.

The 111 existing fixture observations intentionally produce the same keys when
their eligible representations are processed corpus-wide. They remain
unchanged and retain fixture ownership and metadata. The corpus job records
their keys in a separate, immutable, non-owning rollout-membership manifest and
reports them as `preexisting_fixture_covered`, not as inserts or corpus-owned
rows. This manifest is a derived rollout artifact; it does not transfer
lifecycle ownership or permit the corpus job to retire those rows.

Every batch report therefore partitions planned keys into
`preexisting_fixture_covered`, `preexisting_corpus_unchanged`, and mutation
categories. Batch completeness is satisfied when every planned key appears in
exactly one category and every pre-existing key is present in the membership
manifest with its observed database identity and ownership scope. Resumption
verifies those mappings as well as newly corpus-owned rows. A fixture key whose
row is absent, noncurrent, duplicated, or no longer byte-equivalent blocks the
batch; the corpus rollout never repairs or re-owns it.

Planning order is deterministic:

1. processor key;
2. processor version;
3. file-binary ID;
4. representation ID;
5. segment sequence and ID;
6. segment-relative start and end;
7. observation key.

The dry-run inventory freezes contiguous batches over that ordering. Batch IDs
are hashes of the rollout version, inventory hash, first and last observation
keys, and item count. A progress manifest records only committed batches and
their counts/hashes. Restart recomputes and verifies the batch plan, skips a
batch only when its committed database state and manifest match, and otherwise
stops for review. It never resumes from an unchecked numeric offset.

Each batch is one repeatable-read transaction. Planning and mutation use the
same snapshot. A failure rolls back the whole batch and records no successful
manifest entry. PostgreSQL sequence advancement on rolled-back inserts is an
accepted operational side effect and must be reported; sequence values are
never reset. A full rerun must be idempotent and report all committed canonical
rows unchanged with no lifecycle or review mutation.

## Repeated binaries and multiple representations

The observation anchor is the exact representation and segment, not the
binary alone. When Docling, Xberg, and literal text contain the same reference,
three observations may legitimately exist. Consultation may group them by
binary, but ingestion preserves processor-specific spans, hashes, labels, and
versions.

A binary reused by multiple source documents or procedural occurrences keeps
all those contexts as associations supplied by the existing consultation
model. The extractor does not select one occurrence, borrow its date, resolve a
reference target, or duplicate one text observation per occurrence. Binary and
occurrence association counts must be measured separately from observation
counts.

## Lifecycle reconciliation

Reconciliation is limited to observations sharing the exact source assertion:
binary, representation, segment, and half-open span. It follows the fixture
rules:

- an identical canonical current key is unchanged;
- an identical historical key may reactivate with an immutable event;
- a current older extractor observation at the exact span may become
  superseded by the canonical v5 observation;
- a current v5 observation previously owned by this exact corpus rollout may
  retire as source-absent only when its representation remains eligible and a
  recomputation proves its key absent;
- observations owned by the fixture rollout, metadata ingestion, external
  registers, another corpus rollout, an excluded representation, or an
  unauthenticated legacy identity are not retired by this job; and
- ambiguity, multiple possible predecessors, hash drift, or identity mismatch
  blocks the batch before mutation.

Lifecycle events are immutable. Human review records remain byte-for-field
unchanged and attached to their original observations. Reactivation does not
renew an old review. The plan and write reports distinguish inserts,
unchanged, reactivated, superseded, retired, review-bearing history retained,
and blocked cases.

## Write rollout and rollback limits

Write mode is a later authorization. It begins with a canary consisting of the
first frozen batch plus every sampled reconciliation case, within the accepted
per-transaction ceiling. The canary must pass database-state, API-response,
review-preservation, and idempotency checks before further batches.

Operational stop conditions include:

- any representation or segment hash mismatch;
- prediction or byte volume above an accepted ceiling;
- any unauthenticated or ambiguous lifecycle predecessor;
- more than one current observation for a stable source assertion;
- any review mutation;
- any target candidate, namespace, relationship, preferred-binary, or verified
  PDF-page claim introduced by the rollout;
- batch duration or lock-wait above the accepted limit; or
- a discrepancy between planned, attempted, committed, and verified counts.

Rollback is transactional per uncommitted batch. Committed canonical evidence
is not deleted or rewritten. If an accepted committed batch is later rejected,
a separately reviewed corrective plan transitions its observations to a
historical retired state with immutable events. Database backup/restore is an
operational disaster-recovery mechanism, not the normal lifecycle procedure.

## Post-ingestion verification

After every batch and at rollout completion, read-only verification reports:

- current and historical counts by processor, rule, family, batch, and
  representation;
- distinct binaries and representations covered versus eligible;
- segments and characters covered, including explicit exclusion reasons;
- lifecycle transition and review-preservation counts;
- duplicate current source assertions and orphaned provenance links;
- exact reconstruction of a deterministic sample of spans and labels;
- API samples for direct, coordinated, inherited-label, multi-representation,
  reused-binary, and retained-history cases; and
- latency and result-volume samples for recorded-reference lookup.

Error sampling repeats the frozen pre-ingestion strata and adds deterministic
samples from each batch, including no-prediction controls. Coverage wording may
claim only that v5 was run on the enumerated eligible representations. It must
not claim complete legal-reference recall, support for families recorded as
`not_evaluated`, target resolution, or coverage of excluded/empty
representations.

## Required checkpoints

1. Review and commit this documentation-only plan.
2. Implement the read-only inventory/dry-run and freeze its output.
3. Independently review volume projections and the sampled pre-ingestion audit.
4. Freeze batch and operational ceilings and obtain explicit write
   authorization.
5. Execute and review the transactional canary.
6. Execute bounded batches with resumability and stop conditions.
7. Freeze the post-ingestion coverage/error report and independently review it.

This plan does not itself authorize steps 2 through 7. Each is a distinct
bounded checkpoint, and corpus-wide database writes require an explicit user
instruction after the dry-run and audit evidence are reviewable.
