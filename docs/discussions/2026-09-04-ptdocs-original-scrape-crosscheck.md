# Original upload and court scrape cross-check

Read-only comparison of the extracted folders under
`C:\repos\PTDocs\attila_originalScrapes` with the completed PTDocs package snapshot.
The supplied spelling `attila\_originalScrapes` did not exist. All three archive files
were ignored; no HTML scripts or download links were executed.

## Findings

* All 1,238 original PDFs were hashed and agree with the original export's SHA-256
  metadata. Every hash is present in the current PTDocs set. Its ten additional
  hashes are the previously examined five recovered images and five PDF derivatives.
* The original register has 2,070 occurrences. Matching case reference, bucket ID
  and court document reference identifies 2,067 current rows: 2,031 retain identical
  bytes, 34 remain fileless and two have newly recovered files. Rows 1641–1643 still
  lack an exact original occurrence match.
* For the matched rows, the compared source fields differ only in seven file/status
  fields on the two recovered-file rows. Drive-link fields were deliberately excluded
  because the handoff supports subsequent link enrichment. Added interpretation
  columns are assessed by the separate package review, not this baseline comparison.
* All 22 previously disputed AW hashes concern files identical to the original
  upload. Changed PDF bytes therefore do not explain those workbook hash claims.
  This establishes the discrepancy's scope, not who introduced it or why.
* The raw HTML contains 2,074 document-row observations representing exactly the
  register's 2,070 distinct occurrence keys. There are no missing or additional keys.
* All 2,074 raw observations have download-link titles absent from the export's
  `document_anchor_title` field, covering 1,293 distinct document references.
  These are additional court-interface observations, not automatically verified
  descriptions of document contents.

## Row order is not reliable identity evidence

The user clarified that the site's rendering order was not fully stable. Recorded
HTML positions describe one capture only. They cannot establish a binary-to-record
mapping, even where recovered filenames contain matching Roman numerals.

The April 2021 images therefore remain unresolved at occurrence level. Their
manifest membership can still be supported by full hashes; that does not bind
each image to a particular court `procinfo` identifier. No candidate assignment
based on positions 4, 5 and 8 is promoted. Resolution needs independent evidence
such as a preserved download response/log connecting a court identifier to bytes.

The original upload adds no new binary hashes, so it does not supply the 31 missing
manifest relationships identified earlier. The earlier structural conclusions
remain subject to their stated limits; this audit is not a fresh semantic reading
of every PDF or a validation of subjective case interpretations.

## Reproducible evidence

`app/ptdocs-original-audit.py` produces the source manifest, verified original file
hashes, occurrence comparisons, field differences, raw HTML observations and the
22 hash-discrepancy origin checks. Output is stored locally under
`data/exports/ptdocs-original-audit/2026-09-04/` (git-ignored). Its manifest hashes
5,126 non-archive source files; the summary records the audit script hash.

This cross-check writes local derived artifacts only. It changes neither canonical
records nor existing review database findings. The prior package findings retain
their provenance. Next, consult the preserved download titles where they can
independently clarify unresolved descriptions or roles, comparing them with PDF
content and retaining any disagreement explicitly.
