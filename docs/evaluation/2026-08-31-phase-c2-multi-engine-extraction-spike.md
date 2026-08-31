# Phase C2 Multi-Engine Document Extraction Spike

Run date: 2026-08-31T10:31:39.130Z

## Scope

- Evaluated Docling and Xberg behind the existing Phase C1 processing boundary.
- Representative corpus size: 7 imported Virgilio PDFs.
- Plain-text `file_binary` rows were not present in the current corpus, so PDF was the only corpus-backed format exercised.

## Processing Outcome

- Processed representations retained: 14.
- Engine failures on corpus slice: docling 0, xberg 0.
- Canonical source rows before/after unchanged: file_binary 1238 -> 1238, document 1293 -> 1293, document_binary 1257 -> 1257.
- Phase C2 rows added: processing_job 14, document_representation 14, document_segment 14.

## Comparison Summary

- High disagreements: 6.
- Medium disagreements: 1.
- Exact normalized text matches: 0.
- Pairwise comparisons available: 7 of 7.

## High-Disagreement Examples

- 6836f8732aae33a3bc79491748134bd2a77a7b48aeaa2cd7c66647ff1f468f1c (text_pdf) token_jaccard=0.9625 char_ratio=0.918213
  first diff line 1:
  docling: Tribunal Judicial da Comarca de Lisboa Oeste
  xberg: Processo: 13608/14.8T2SNT
- 17eb40fa6ca2c37156d9c230640ff03efbddfa531111f09bb03a7152f9e4a691 (text_pdf) token_jaccard=0.969305 char_ratio=0.998902
  first diff line 1:
  docling: Tribunal Judicial da Comarca de Lisboa Oeste Juízo de Família e Menores de Sintra - Juiz 6
  xberg: Tribunal Judicial da Comarca de Lisboa Oeste
- ce0574353b545ed3a84c40194fd7571ea40b2339963061c407febc0522bf1800 (mixed_pdf) token_jaccard=0.972727 char_ratio=0.903516
  first diff line 2:
  docling: 
  xberg: Juízo de Família e Menores de Sintra - Juiz 5
- adcde0cb1e946487996d48762e70501bec852e2803c918aded1cb2ff3ace51c4 (mixed_pdf) token_jaccard=0.969626 char_ratio=0.986614
  first diff line 1:
  docling: FORMULÁRIO A
  xberg: Pedido de obtenção de provas nos termos do artigo 4º do Regulamento (CE) nº 1206/2001 do Conselho, de 28 de Maio de
- beaae8cef569cfddd3d14512aa4937561b0255df833973c312cec182755e594d (mostly_image_pdf) token_jaccard=0 char_ratio=0
  first diff line 1:
  docling: 
  xberg: 21:15 & FS @ ° BOO Fl il 57%e
- 02c8e7cee7eca2f83b98d64aa2dd64b1b888039210a8cbf5c2133322d1b1757e (image_only_pdf) token_jaccard=0.549596 char_ratio=0.904991
  first diff line 1:
  docling: SECRETARIE GERAL
  xberg: Tu

## Repeatability

- docling 6836f8732aae33a3bc79491748134bd2a77a7b48aeaa2cd7c66647ff1f468f1c: normalized text match = true
- xberg 6836f8732aae33a3bc79491748134bd2a77a7b48aeaa2cd7c66647ff1f468f1c: normalized text match = true

## Failure Handling

- docling:zero-byte-pdf: failed_as_expected
- xberg:zero-byte-pdf: failed_as_expected
- docling:malformed-pdf: failed_as_expected
- xberg:malformed-pdf: failed_as_expected

## Engine Integration Findings

- Docling completed 7/7 corpus documents on this spike path.
- Xberg completed 7/7 corpus documents on this spike path.
- Xberg OCR integration remained less clean locally because scan-heavy cases required writable cache/model locations and still attempted additional model download/network access.

## Recommendation

- D. Use one engine routinely and the other selectively for scans, mixed PDFs, and disagreement-driven spot checks.
- Neither engine should be treated as authoritative source truth; keep the original `file_binary` bytes and SHA-256 as canonical evidence.
- Preserve both engine outputs where disagreement is informative, especially on scans, mixed PDFs, identifiers, and reading-order edge cases.

## Operational Notes

- Docling has the heavier local dependency/model footprint and slower OCR path.
- Xberg is easier to invoke and returns strong whole-document text quickly, but its default native page/layout surface is thinner on this spike path.
- Original `file_binary` content was read-only throughout the spike.
