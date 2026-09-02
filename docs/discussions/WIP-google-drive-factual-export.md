# WIP — Google Drive Factual Export

Status: discussion draft; not an authoritative architecture or implementation contract.

Last updated: 2026-09-02

## Purpose

Define a portable intermediate result set that can be placed in Google Drive
and consulted through ChatGPT or ordinary file browsing.

The export is not an application backup, database restoration package, selected
document interpretation, or final external interchange standard. It is an
organized factual projection of material already persisted by Virgilio.

## Core boundary

The exporter packages:

1. immutable original binaries;
2. raw persisted artifacts received from each processor/tool;
3. factual database records identifying processing and representation lineage;
4. factual court/document/case contexts already persisted for each binary.

It must not:

* select or rank an extraction automatically;
* label one representation as best, preferred, authoritative, or true;
* merge independent extractor outputs into synthetic text;
* rewrite, normalize, summarize, or otherwise reinterpret raw processor artifacts;
* infer facts that are not already present in the persisted source/context graph;
* treat signature structures as proof of cryptographic, certificate, or legal validity;
* silently omit historical failures or alternative successful representations.

An explicit human representation selection may be exported as a factual persisted
record. Its existence must not cause other representations to be omitted or moved
into a lesser package tier.

## Proposed directory structure

```text
virgilio-factual-export-<export-id>/
  README.md
  manifest.json
  binary-index.csv
  document-context-index.csv
  processing-index.csv

  binaries/
    <sha256>/
      binary.json

      original/
        <sha256><extension>

      contexts/
        contexts.json
        contexts.csv

      processing/
        jobs.json

      artifacts/
        <representation-id>/
          representation.json
          raw/
            <artifact files exactly as persisted>
```

Directory and file names outside `raw/` are export organization. Files copied
under `raw/` retain their persisted relative names and bytes.

## Original binaries

Each included binary is copied once, under its canonical SHA-256 identity.

Requirements:

* retrieve through `BinaryStore`, not reconstructed machine-specific paths;
* copy bytes without modification;
* verify the copied SHA-256 against `file_binary.sha256`;
* verify byte size where persisted size is available;
* record the package-relative path, digest, and byte size in the manifest;
* retain source storage fields only as provenance/debug metadata.

Multiple documents or court contexts may point to the same binary. They must not
cause duplicate copies of the original.

## Raw processor artifacts

For every included persisted `document_representation` with a reachable artifact
directory:

* copy all files currently present in that artifact directory;
* preserve their relative names and bytes under `raw/`;
* do not promote a particular projection such as `text.txt`, `markdown.md`,
  `complete-text.txt`, or `native.json`;
* keep representation identity, processor identity/version, profile/configuration
  identity, input lineage, timestamps, and producing job identity in
  `representation.json`;
* record digest and byte size for every copied artifact file.

This applies equally to factual PDF evidence and interpretation outputs, including
where available:

* literal PDF text;
* PDF structure inventory;
* PDF signature metadata;
* Xberg artifacts;
* Docling artifacts;
* OCR evidence artifacts;
* human-authored representations and their lineage;
* future persisted processor outputs supported by the generic representation and
  artifact model.

The package organization must not imply that evidence and interpretation have the
same semantics. Their persisted representation kinds and processor identities are
exported so a consumer can distinguish them factually.

## Processing history

`processing/jobs.json` contains all persisted processing jobs for the binary in a
deterministic order, including:

* queued/running state if the export deliberately permits a live partial snapshot;
* completed jobs;
* failed and timed-out jobs;
* retries and later successes;
* processor key and version;
* request, start, and completion timestamps;
* error code and persisted error text;
* produced-representation linkage where present.

The exporter must not collapse a failed historical attempt into a later success.

## Factual contexts

`contexts/contexts.json` and `contexts/contexts.csv` organize persisted relationships
that explain where the binary appears in the court-provided corpus.

Candidate factual fields include:

* binary SHA-256 and `file_binary.id`;
* `document_binary` linkage and primary-link flag;
* document ID and court/source identifiers;
* document name, type, date, claimed size, and other imported fields;
* bucket row ID and court/source bucket identifier;
* bucket date, designation, presenter, and retained source occurrence counts;
* case ID and process number;
* court and unit identifiers/names;
* case-workspace linkage where persisted;
* import batch and source-capture lineage where applicable.

These files are a deterministic relational projection. They must not add inferred
document meaning, case significance, chronology interpretation, or legal conclusions.

## Package-level indexes

The initial package exposes three convenience indexes derived only from persisted
facts and copied-file metadata.

### `binary-index.csv`

One row per included binary, with identity, file facts, package-relative original
path, context counts, representation count, and processing-state counts.

### `document-context-index.csv`

One row per persisted binary/document/bucket/case context edge. Repeated rows are
expected when one binary participates in multiple factual contexts.

### `processing-index.csv`

One row per persisted representation and, where useful, separate rows for failed
jobs that produced no representation. It includes processor/version identity,
representation kind, artifact directory, producing job, and package-relative paths.

CSV is a consultation aid. JSON records and raw copied artifacts retain the richer
structure and provenance.

## Manifest

`manifest.json` should include:

* package format and version;
* exporter identity and version;
* export ID and timestamp;
* declared export root/scope;
* counts of binaries, originals, contexts, jobs, representations, and artifact files;
* package-relative inventory of copied files;
* SHA-256 and byte size for every copied original and artifact file;
* source database record identifiers and representation/job lineage;
* missing or unreadable persisted artifacts encountered during export;
* an explicit statement that completeness is assessed only at the export timestamp.

Package interpretation must not depend on absolute source-machine paths.

## README for human and ChatGPT consultation

`README.md` explains only how the package is organized and how to interpret its
provenance boundaries. It may explain, factually, that different processors emit
different artifacts and that no representation was automatically selected.

It must not summarize the legal documents or recommend which extractor output to
trust for a particular question.

## Partial processing and snapshot consistency

The package format must represent partial processing honestly. Missing, failed,
not-run, and successful states are distinct.

For the first real export, prefer an idle processing queue so database rows and
artifact directories form a stable snapshot. If live export is later supported,
the exporter must record its snapshot semantics and report concurrent or incomplete
material explicitly rather than implying a coherent completed corpus.

## Relationship to the existing portable evidence package

The existing C5.3.8/C5.3.9 implementation proves a one-binary package and a
DB-independent verifier. This WIP should reuse its established boundaries where
appropriate:

* `BinaryStore` retrieval;
* package-relative paths;
* copied-original SHA verification;
* persisted versus package-local data separation;
* representation artifact copying;
* processing-history preservation;
* standalone package inspection.

This WIP does not yet decide whether the Google Drive factual export extends the
existing package format or defines a related, separately versioned format.

## Google Drive boundary

The initial implementation should produce a verified local directory suitable for
upload to Google Drive.

Deferred unless deliberately agreed:

* Google Drive API integration;
* automatic upload or synchronization;
* Drive-native shortcuts;
* permission/share-link management;
* ZIP/TAR/container format;
* archive splitting;
* incremental package merge/update;
* re-import into Virgilio.

## Open decisions before implementation

1. Export root: whole current corpus, case workspace, case, or an explicit list of
   binary SHA-256 identities.
2. Whether repeated exports are immutable snapshots or can update an existing
   directory.
3. Whether artifact file hashes are stored only in the manifest or also beside
   each representation.
4. Whether raw persisted `error_text` is exported verbatim or accompanied by a
   separately labelled redacted convenience field.
5. Whether originals are included by default or through an explicit option when
   Drive size is constrained.
6. Whether the existing `virgilio-portable-evidence` format is extended or the
   factual Drive export receives its own format identity.
7. Package-size measurement and the practical Google Drive upload/container plan.

No implementation should begin until these decisions are narrowed enough to define
a bounded first slice.
