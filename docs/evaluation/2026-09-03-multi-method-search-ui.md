# Multi-method consultation search UI

Date: 2026-09-03

## Implemented scope

The consultation search now supports `Document text`, `Recorded references`,
and `Both`. Document text is the initial method and full corpus is the initial
collection scope. Recorded-reference history remains an explicit diagnostic
option.

One submitted generation invalidates both method requests. Within that
generation, each section owns its loading, success, failure, retry,
continuation, and pagination state. A new submission resets excluded sections;
draft control edits do not relabel submitted results.

Text-order replacement keeps the current results and applied order visible
until the replacement succeeds. A failure preserves those results and offers a
retry for the requested order without affecting recorded references.

## Presentation

- Text passages remain grouped by full-SHA-256 binary with processor-attributed
  excerpts and expandable additional processor matches.
- Recorded-reference cards keep origin, direct anchor, associated contexts,
  lifecycle, ingestion candidates, and human review distinct.
- Associated binary links use full SHA-256 identity and normal new-tab-capable
  navigation to the existing binary inspection page.
- Missing-file observations remain visible without an open action.
- Each section presents independent coverage-aware empty and failure messages.
- Coverage guidance states that court metadata is corpus-wide while
  external-register and document-text reference observations remain pilot-only.

## Validation

- Application TypeScript checking passed with `tsc --noEmit`.
- The production Vite build completed successfully.
- All 27 UI unit tests passed, including generation invalidation,
  `Both -> Document text -> Both` participation, API parameter preservation,
  requested/displayed ordering, and existing text pagination/grouping tests.
- `git diff --check` passed.

Automated browser control was not available in this session. The production
build and live API behavior are validated, but the documented live visual and
interaction walkthrough remains a narrow manual review item.

Follow-up correction: every matching processor/page hit now renders its own
passage and contextual reference observations. Binary grouping no longer hides
a citation merely because it belongs to a secondary Docling, Xberg, literal-
text, or later-page hit. The observation retains its processor, segment, and
location provenance.

## Boundaries

No ingestion, database schema, API semantics, classification, review editing,
combined ranking, or reference resolution was added.
