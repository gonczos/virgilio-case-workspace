# Xberg Failure Notes - 2026-09-01

Scope: narrow corpus-run triage for `xberg` failures observed during the
full-corpus processing run.

## Current live implementation bug

### NUL byte in extracted text breaks persistence

Observed failed `xberg` jobs:

- `file_binary_id=116`,
  `sha256=17112a384025b5be4888fe038ac6beb77f2cb0717c1fffb24b95da3b8478544f`
- `file_binary_id=291`,
  `sha256=3c5df9607a63fb93851c4761e1412d53e58094c9fff10c4bd6af5145947627f2`
- `file_binary_id=525`,
  `sha256=6e97ec62825618863637e26f45de20f4179157d634304a68fbfdc9501fadead0`

Persisted failure:

- PostgreSQL rejected `document_segment.text_content` with
  `invalid byte sequence for encoding "UTF8": 0x00`.

Current likely cause:

- extracted text reaches `insertRepresentationArtifacts(...)` unsanitized;
- `segment.text_content` is inserted directly into
  `casework.document_segment`;
- no current stripping/sanitization of `U+0000` / NUL before persistence.

Impact:

- does not stop the worker pool globally;
- does cause affected `xberg` jobs to fail terminally;
- failure count can grow as more PDFs emit embedded NULs.

## Historical failure that does not appear live now

### Comparison order constraint failure

Observed historical failed `xberg` job:

- `file_binary_id=504`,
  `sha256=6836f8732aae33a3bc79491748134bd2a77a7b48aeaa2cd7c66647ff1f468f1c`

Persisted failure:

- `document_representation_comparison_order_check`

Current assessment:

- the same processor version later succeeded for the same binary;
- current code canonicalizes comparison pairs before insert;
- persisted comparison rows for that binary are correctly ordered.

Conclusion:

- likely historical pre-fix behavior, not a currently reproduced live bug.

## Honest invalid / unsupported input class under xberg

These are `image_only_pdf` inputs, but the failures occur at PDF parse/render
stage before successful OCR extraction.

Observed examples:

- `file_binary_id=97`,
  `sha256=130cc7b4475151321bf058d96b597e51b2e569599e8d8c065f59d9cbfa800e67`
  - invalid PDF catalog missing `/Pages`
- `file_binary_id=252`,
  `sha256=30ee9d6a50db5de7d6db98d4b7bf535a8e7ba245a50d291669d8d913a4239874`
  - invalid PDF pages node missing `Kids`
- `file_binary_id=274`,
  `sha256=36c216b08bde6dc1db446394ea6623244fa407547477b6a65cd6ae68ae358cb8`
  - invalid PDF catalog missing `/Pages`
- `file_binary_id=408`,
  `sha256=574318251cd1ef8eeec9171126cdcaa2da6f0acd7d81ae7ab98f544274c68a14`
  - invalid PDF catalog missing `/Pages`
- `file_binary_id=443`,
  `sha256=5d451af6a424bb4da5a330d6f36144fcd76b72f7a4f241e56114ee53bb2aac09`
  - invalid PDF catalog missing `/Pages`
- `file_binary_id=446`,
  `sha256=5d628b2b3a54f08639804c2a9f6f4198518d73064c981d9da1b8b80472dbfd59`
  - invalid PDF catalog missing `/Pages`

Current assessment:

- these look like honest `xberg` parse/render incompatibilities or corrupt PDF
  structure, not evidence of the same persistence bug;
- `docling` / `pdf_ocr_text` status for some of these remains queued, so
  cross-lane tolerance is not yet determined.
