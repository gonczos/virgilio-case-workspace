# Full-set PTDocs package validation

Follow-up: [original upload and raw scrape cross-check](2026-09-04-ptdocs-original-scrape-crosscheck.md).
The original bytes corroborate the hash-discrepancy findings. The user reports
unstable site rendering order; occurrence mappings must not rely on row positions.

Completed the structural review across all 2,070 occurrence rows and 1,248 supplied
files. Results are attributed observations in `ptdocs_review`, batch 1. Original
files, canonical casework data and representation preferences remain unchanged.

## Package map

| Result | Count |
| --- | ---: |
| Submissions identified from PDF content | 190 |
| Separate-file Citius manifests | 72 |
| Combined submission PDFs | 118 |
| Unique manifest relationships (filing + item + full hash) | 372 |
| Relationships with supplied files verified by actual SHA | 341 |
| Relationships whose files are missing | 31 |
| Combined PDFs with internal indexes | 115 |
| Internal index entries retained in those PDFs | 603 |

The remaining three combined submissions have institutional cover sheets and
substantive appeal responses. Internal index entries are observations inside a
PDF, not additional binaries. Older `Anexo nº 1` often means the main pleading;
it must not be confused with `Doc. 1` in a modern separate-file manifest.

Seventy-five binaries contain manifest hashes: the 72 standalone manifests and
three larger notification bundles containing copies. The repeated copies produce
416 source observations, deduplicated to 372 relationships across 365 distinct
target hashes. Full hash sets agree between literal extraction and Docling for
all 75 carriers. Main/annex sequences are complete and unambiguous in all parsed
manifests; all 380 available declared-page-count observations agree with canonical
PDF page counts. No original bytes were reconstructed from OCR.

## Workbook findings

894 rows contain package metadata. The automated structural checks classified
762 as supported for the populated fields checked, 96 as partial, 25 as containing
a contradiction, and 11 as unresolved. The other 1,176 rows have no package claims;
they were still included in occurrence and binary screening. These statuses do not
approve every enrichment field or establish the truth of document contents.

Across 4,597 populated package-field checks, 4,149 were supported, 176 partial,
241 unresolved, five interpretation candidates and 26 contradicted. A description
was supported automatically only when its normalized wording agreed with the
manifest description/category and the binary membership was established. Other
descriptions remain unapproved, with exact source passages available for review.

Important exceptions:

* **22 rows have a manifest hash different from their linked binary's actual SHA.**
  This disproves an exact-byte match for that row. It does not rule out an older
  version, excerpt or later refiled copy. No automatic substitution was made.
* **Two SHA cells contain prose**, on rows 1869/1870. Manifest 42708379 provides
  actual hashes for Docs 2/3; those hashes and source page are in the exception list.
* **Rows 368 and 1094 label combined PDFs as standalone manifests.** Original
  covers and internal indexes establish the combined structure. Row 368's PDF has
  its own reference 18145983; row 1094's has 33348144.
* **39 claimed filing references differ from the PDF's own cover reference.**
  The alleged later parent relationship lacks exact-byte evidence. These are
  unresolved own-versus-parent relationships, not automatically wrong references.
* Visual inspection found incorrect combined-package labels on rows **565, 622,
  947, 805 and 989**: handwritten/paper submissions, a prosecution appeal response,
  or the request to lodge a physical PEN. These are separate visual findings.
* Rows **342, 1966 and 1994** put `Promoção` in the manifest-category field, while
  the manifest says `Outro`. The substantive document can still be a Promoção;
  source category and intrinsic type must remain separate. Two hyphenation-only
  category candidates were not silently normalized into source truth.

All six rows explicitly claiming a physical/manual submission were checked visually
and their package role supported. This resolves that narrow role question, not
every remaining field on those rows. Together, the automated and visual/category
checks identify 33 distinct rows with concrete, field-specific contradictions.
Their exact comparisons and proposed corrections are retained in the findings.

## Missing and recovered files

The 31 missing files span eight submissions: 12 videos, ten images, six audio files
and three entries categorized Comprovativo. These are manifest-declared categories,
not inferred formats. All are absent from the entire supplied file inventory.
The complete list includes full SHA, submission reference, annex number and source
PDF page in `data/exports/ptdocs-packages/2026-09-04/missing-files.md` and JSON.

| Filing reference | Missing items |
| --- | ---: |
| 36465981 | 10 |
| 36465689 | 9 |
| 48233560 | 3 |
| 46224704 | 3 |
| 38202632 | 2 |
| 42708379 | 2 |
| 36167479 | 1 |
| 36460658 | 1 |

The five recovered original images have exact manifest SHA matches: Docs 2/3 of
36037709 and Docs 2/3/6 of 38642470. Visual comparison supports their correspondence
to the five derived PDFs, but decoded pixels differ; the medical-note derivative
is also rotated/resized. They are not byte-identical substitutes, and exact
conversion provenance has not been established.

Rows 1641–1643 can now be tied to particular manifest annexes through the recovered
original hashes. They still cannot be individually assigned to canonical court
occurrences 1288–1290: the court records contain generic IMG entries, opaque IDs
and zero reported sizes. Bucket membership and order do not resolve that ambiguity.

## Evidence and limits

The pass rehashed all 1,248 supplied files and 1,238 canonical files, checked both
workbooks against the staged digests, and screened 2,375 independent existing text
representations. Explicit consultation selection was respected. The corpus has
124 image-only, 31 mostly-image and 16 mixed PDFs; OCR/literal nondetection is not
proof that no structure exists on an unreadable page. Selected manual cases used
16 rendered original pages plus five original/embedded-image comparison pairs.
This was full-set structural screening with targeted visual inspection, not a
human rereading of every page or validation of legal arguments and allegations.

The supplied extraction rules and taxonomy were used to distinguish manifest
categories, substantive types, package roles and missing-file identities. In
particular, their rule against assigning missing annexes from bucket/order alone
was followed. Full SHA matches were used instead of relying only on filename prefixes.

2,280 new records were appended to the existing review batch, leaving 2,971 total
findings including the earlier sample. New records comprise 2,070 row assessments,
72 manifest maps, 118 combined-package records, one coverage record and 19 targeted
visual/category/derivative findings. Evidence retains workbook row, exact source
binary, processor/version, representation digest, segment offsets and source pages.
No automatic latest-finding preference or canonical promotion was introduced.

The reproducible snapshot/parser/review/check tools are tracked in `app/ptdocs-package-*`.
Detailed local artifacts are under `data/exports/ptdocs-packages/2026-09-04/`, including
`package-map.json`, `row-review.json`, `complete-findings.json`,
`supplemental-findings.json`, `missing-files.json` and `verification.json`.
PostgreSQL holds the resulting evidence; local extracts and images also need backup.

Validation passed: source digests, representation artifact digests, every manifest
hash's source offset, independent literal/OCR hash sets, annex slot consistency,
page counts, parser regression tests, reviewer write-denial checks and duplicate
finding reimport. No corpus processing jobs or canonical mutations ran.

Recommended next step: review the 22 hash-discrepant row links and 39 unproven
own/parent reference relationships before promoting package metadata. The 31-file
recovery list is ready for a separate retrieval task. Neither recovery nor canonical
promotion was started in this phase.
