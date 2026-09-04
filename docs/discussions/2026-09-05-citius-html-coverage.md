# Saved Citius HTML coverage review

Completed offline import of the extracted `tribunais-multicase-audit-2026-08-29T22-50-36-257Z`
under `C:\repos\PTDocs\attila_originalScrapes`. Originals remain untouched.

## Stored evidence and coverage

PostgreSQL capture **2** contains 3,873 original HTML artifacts and one derived
coverage report: 5 case rows, 897 bucket rows, 2,074 document rows and 897 complete
document tables. Original bytes, SHA-256 and parsed observations are preserved.
There are 2,976 exact-key provenance links. Four extra document-row observations
are repeated occurrences; they were not discarded or turned into extra documents.

All 5 cases, 897 buckets and 2,070 distinct document occurrences match current
records. No unmatched or ambiguous source rows, or current records outside the
capture, were found within this corpus scope. This does not establish live-site
scrape completeness or validate every PDF's contents.

## Findings and proposed treatment

| Finding | Extent | Proposed treatment, not applied |
| --- | --- | --- |
| Displayed bucket sizes absent from normalized field | 897 buckets | Review and populate existing `displayed_bucket_size_bytes` with source lineage |
| Download-link titles absent | 2,074 observations, 1,293 distinct documents | Review and populate existing `document_anchor_title`; keep title separate from content classification |
| HTML type attributes absent | 2,074 observations, 1,293 distinct documents | Review and populate `document_type_from_attr`; displayed `document_type` already agrees |
| Names/designations/presenters differ | 18 comparisons | All are internal whitespace normalization; no substantive correction indicated |
| Other case attributes retained | Participant names/roles, transition dates, status code, interface flags and court/client identifiers | Review semantic value and existing provenance before proposing schema changes |

No conflicts in download title/type attribute were found across repeated
observations of the same document. Existing provenance already retains some
court/client identifiers; the unmapped-attribute inventory must not be read as a
list of universally missing data. Literal `null`/`undefined` flags are preserved
and do not establish real dates or boolean facts.

All compared case fields, bucket dates/references and document dates, types,
claimed sizes and identifiers agree. The 18 whitespace differences comprise seven
bucket designations, seven document names and four presenters.

## Validation and limits

All 3,873 stored raw HTML hashes were reread and verified. An identical second
import reused capture 2 and verified row/link counts without duplication. Focused
parser checks cover repeated observations, additional attributes, entity decoding,
nested text, zero sizes and whitespace retention. No canonical corrections, file
ingestion, OCR, representation changes or application UI changes were performed.

Local artifacts: `data/exports/citius-html/2026-09-05/snapshot.json`, `report.json`
and `repeat-report.json`. The original import report in PostgreSQL retains the
executing loader hash; a subsequent nonfunctional removal of an unused client
allocation is reflected by the repeat run's loader hash.

Next step: a bounded, provenance-backed correction proposal for the three existing
fields above, followed separately by deciding whether participant/role and other
case attributes merit normalized entities. This review does not promote them.
