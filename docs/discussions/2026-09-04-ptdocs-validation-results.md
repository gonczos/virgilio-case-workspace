# PTDocs initial validation results — 4 September 2026

The enrichment is useful as an attributed source of candidate metadata, package
relationships and review leads. It should not be imported wholesale as verified
facts. The first validation found both strong reusable information and concrete
misclassifications. All proposed corrections remain in `ptdocs_review`, batch 1.
Original PTDocs files and canonical casework records were not modified.

## Identity and snapshot

Two workbooks, 47 sheets and 17,471 nonempty rows were staged, preserving workbook
SHA, sheet/row coordinates, raw cell data, formula text and cached values. There
are 2,070 occurrence crosswalk records, of which 2,067 have exact occurrence matches.
The remaining 295 auxiliary Document Register rows are preserved as source rows
without being treated as occurrences.

| Match outcome | Rows |
| --- | ---: |
| Exact occurrence and canonical binary | 2,031 |
| Exact occurrence, recovered external binary only | 2 |
| Exact occurrence without local binary | 34 |
| Unresolved occurrence | 3 |

All 1,238 canonical binary hashes match PTDocs files despite renamed filenames.
PTDocs has 1,248 files: ten additional files comprise five recovered images and
five derived PDFs. This does not authorize importing the extras as canonical.
The two recovered July 2020 PDF derivatives match occurrences 912/913. Three April 2021
rows (1641–1643) lack individual source references; bucket 18667032 suggests
canonical occurrences 1288–1290, but no one-to-one assignment was invented.

Across 12 source metadata fields on 2,067 occurrence matches, all 43 differences
are sizes: exported actual bytes versus source-reported size metadata. No binary
integrity discrepancy follows from those differences. The newer workbook has
2,036 file-linked rows, with 1,720 marked reliable, 22 manual and 294 deeper-pass;
the documentation's earlier counts were 2,033 and 1,717. Its hidden binary helper
sheet still has 1,238 rows and does not incorporate all recovered derivatives.

## Consistency and evidence review

253 enrichment columns are populated. Identical binaries have differing document
type labels in 211 groups and signature-date values in seven groups. These 218
groups are review candidates, not 218 proven errors: package context and multiple
embedded acts can explain differences. Two manifest-hash cells are not single
full hashes. No cached formula-error cells were found; formula logic and cache
freshness were not certified or recalculated.

The targeted sample contains 40 unique binaries: four each of Notificação,
Certidão, Requerimento, Folha de Submissão Citius, Despacho, Promoção, Ofício,
Email, Ata and Acórdão. Selection prioritizes conflicts, scans, flagged rows and
reliable rows, then uses deterministic SHA order. It is not a random prevalence
sample and does not measure overall workbook accuracy.

The 73 individually inspected field claims yielded 55 supported, eight partially
supported, nine contradicted and one unresolved. Three additional parent-file
relationships were supported through filing manifests and actual SHA verification:
18 of 18 listed file hashes across those manifests resolve to canonical binaries
with matching bytes. Thus the combined 76 assessments are 58 supported, eight
partial, nine contradicted and one unresolved. These are claim counts, not counts
of fully approved documents.

Key findings, using one-based workbook row numbers:

| Row | Field | Finding |
| ---: | --- | --- |
| 1094 | AQ | Workbook reference 32973078 contradicts original filing reference 33348144. |
| 1094 | AR | A 40-page combined application/attachment package was labelled a standalone filing manifest. |
| 805 | AR | A one-page application to lodge a physical PEN was labelled a combined electronic package. |
| 241 | AB | An email with flight-image attachments was labelled Certidão as intrinsic type. |
| 507 | AB | Registration/certification of an appellate decision was labelled the appellate decision itself. |
| 1289, 1207 | AJ | Procuradora-Adjunta conflicts with source signing role Procurador da República. |
| 81, 197 | AC | Certificate subtypes were applied to an institutional report-transmission letter and an email chain. |
| 1358 | Z | Conclusion, body and signing dates differ; a single combined date field loses meaning. |
| 108 | AI | Prosecutor signing the registry wrapper must not become author of the judges' appended decision. |

Several useful details were supported: named notification recipients, court
certificate authors, filing references, external correspondence references,
minutes classifications, and appellate panel names. Three main-file links on
rows 1320, 1477 and 1581 were independently tied to full manifest SHA values and
canonical bytes. Conversely, overprinted medical correspondence signature blocks
remain ambiguous. Visible signature wording was not treated as cryptographic
certificate validation.

Every claim assessment retains workbook lineage, exact binary SHA, representation
identity/processor/version, text digest and segment passages; visual checks also
retain page numbers and rendered-page digests. Thirteen pages across eleven
binaries were inspected visually. Other assessments used existing extracted text.
Long documents were checked only for relevant fields/components, not comprehensively
reread for substantive legal meaning. Source allegations remain attributed statements.

## Delivery and verification

The migration, loader, consistency/sample tool and bounded integration check are
tracked in the repository. Runtime evidence is under the git-ignored directory
`data/exports/ptdocs-review/2026-09-04/`: `sample.json`, `sample-findings.json`,
`package-findings.json`, `field-inventory.json`, `same-binary-conflicts.json`,
rendered pages and the scripts used to build this snapshot's findings. The prior
reconciliation snapshot remains under `data/exports/ptdocs-reconciliation/2026-09-04/`.
Core imported source and finding evidence is persisted in PostgreSQL; rendered
images and local snapshots need the usual local backup because Git excludes them.
Batch 1 contains 691 finding records: 76 claim/package assessments, 572 per-row
conflict candidates, two hash-format candidates, 39 identity exceptions and two
informational checks. Candidate counts repeat a binary group across its rows.

Validation passed: canonical insert/update/delete denied under reviewer role;
review source update/delete denied; finding deduplication; source-row foreign key;
transaction rollback of test rows; identical snapshot reload reused batch 1.
All 40 sampled originals and all 18 manifest entries were SHA-verified through
BinaryStore. No extraction jobs, model processing or canonical corrections ran.
An independent openpyxl check reconfirmed all 2,070 occurrence rows, unchanged
hashes for both workbooks and all 1,248 PTDocs files, and all 43 size explanations.

Recommended next phase: validate package relationships at scale using full
manifest hashes, resolve the three recovered-image occurrence identities, and
separate intrinsic document type from court occurrence/package labels. Only then
define an explicit promotion contract for approved fields. Subjective summaries,
intent, credibility and legal conclusions should remain attributed review leads
until separately evidenced. That next phase has not been started.
