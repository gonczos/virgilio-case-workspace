# Citius reference mapping experiment

Status: bounded evaluation result; not an authoritative architecture or
implemented schema.

Date: 2026-09-03

## Objective

Test whether the available Document Register, consultation package, and
extracted PDF evidence support stable rules for identifying documents by the
references used by the court and participants.

The experiment does not classify the full corpus, change persisted data, or
treat extracted text as canonical evidence.

## Inputs and method

The evaluation used:

* `Documentation with Links - Document Register.csv` as a candidate reference
  and enrichment crosswalk;
* `data/exports/ai-consultation/2026-09-02-full-v2` as the stable package
  snapshot;
* literal PDF text where available;
* independently attributed Docling and Xberg outputs as supporting observations;
* original binary SHA-256 as the immutable file identity.

A stratified sample of 24 register rows covered the main proceeding and
appendices A, C, D, and E. It included a party submission, submission sheet,
despacho, notification, acórdão, ata, termo, conclusão, visto, vista, cota,
certidão package, external communication, reused binary, and missing multimedia
items.

This was principally a structured-text evidence review. It did not visually
verify every reference on rendered original pages. Findings based only on an
interpretation remain attributed to that processor; literal PDF text is called
out separately below.

## Results

### Reference namespaces are real, not cosmetic aliases

At least the following concepts occur independently:

| Candidate namespace | Example | Observed target |
| --- | --- | --- |
| Process number | `13608/14.8T2SNT-A.L1` | Proceeding or appellate instance |
| Occurrence/bucket reference | `12273569` | Procedural-history occurrence |
| Printed document reference | `110478264` | Court act/document identified in its content or transmitting context |
| Filing-sheet `REF.ª` | `33348144` | Electronic submission shown on the Citius filing sheet |
| Referenced prior act | `105398957` | Earlier despacho cited from a later cota |
| External reference | `200460-10080840` | Postal, office, or institutional reference |
| External process reference | `2019/000529/LX-C-1` | Process maintained by another institution |
| Court-document source key | `3994056_..._<UUID>` | Source/export identity; not observed as the conversational number printed in the PDF |
| Binary SHA-256 | `16ee8d...` | Immutable file identity, not a court-facing reference |

The target type cannot safely be inferred from the numeric shape alone.

### Occurrence reference often matches a printed reference, but not always

For a `Termo de apresentação e exame`, an `Ata de sessão e julgamento`, and an
appellate notification, the register's `Bucket Reference` was also present as
`Referência:` in literal PDF text or all available readable projections. This is
strong evidence that the bucket reference can serve as a court-facing occurrence
reference in those cases.

Counterexamples are material:

* A `Certidão` occurrence `110506941` contains an Ata whose literal text retains
  its earlier reference `12258756`.
* A later certidão-package occurrence `133705905` contains an Ofício whose
  literal text identifies itself as `125926657`.
* Some short registry records expose no readable printed reference even though
  the occurrence has a bucket reference.

Therefore, `Bucket Reference` is not universally the intrinsic reference of the
contained binary.

### One binary can participate in differently named occurrences

The binary with SHA-256
`16ee8d2a5e2a9a7124b2287e4284bb1bb4632767442fc42f96dd5eac6a4e81db`
appears as:

| Occurrence date | Bucket reference | Occurrence designation | Binary/content classification |
| --- | --- | --- | --- |
| 2017-12-19 | `110478264` | Despacho | Despacho |
| 2017-12-20 | `110504576` | Notificação c/Registo | The same Despacho binary |

The later register row explicitly records `Referência no documento: 110478264`.
This supports a relationship of “notification occurrence transmits or points to
the earlier despacho,” not two aliases for one occurrence and not evidence that
the binary itself became a notification.

### One occurrence can group multiple independently identified binaries

The `Certidão` occurrence `110506941` includes at least two different binaries:

* an Ata de Sessão e Julgamento with its own source key and printed reference
  `12258756`;
* an earlier Ata with a different source key and SHA-256.

The large certidão-package occurrences in appendices C, D, and E similarly group
many source files. In the register, Citius filing reference `34820097` is shared
by 20 rows in one appendix-C package, while `36179121` is shared by 48 rows in an
appendix-D package. Package membership is therefore a relationship, not an
intrinsic property or name of every attachment.

### Filing reference fields require provenance repair

The tested filing-sheet PDFs contain explicit `REF.ª` values in literal PDF
text:

| Register row/date | Bucket | Literal filing-sheet `REF.ª` | Register `Citius Filing Reference` |
| --- | ---: | ---: | ---: |
| 2014-11-10 Requerimento | `532882` | `17964927` | `46269572` |
| 2014-11-28 Alegações | `651161` | `18145983` | `36179121` |
| 2014-11-28 Requerimento | `652884` | `18149133` | `46269572` |
| 2019-09-10 Requerimento | `15365104` | `33348144` | `32973078` |

The register field therefore cannot be treated as the filing-sheet reference of
the current occurrence without additional provenance.

There is evidence of context leakage through reused binaries. For example,
`46269572` is shared by 22 rows, most visibly as a package relationship in the
2026 appendix-E certidão occurrence, but it also appears on historical
occurrences of reused 2014 binaries. A binary-level enrichment appears to have
been projected onto every register occurrence of that binary. It may be valid
for one package relationship while being misleading as an identifier of another
occurrence.

### Documents cite other documents by reference

The sampled cota with occurrence reference `105492248` states in literal PDF
text that it was made in compliance with a despacho under reference
`105398957`. These are related references with different targets.

The 2019 submission sheet and pleading provide an even denser example:

* current occurrence/bucket: `15365104`;
* current filing-sheet `REF.ª`: `33348144`;
* register `Citius Filing Reference`: `32973078`;
* prior requerimento cited in the pleading: `33157723`;
* another referenced item: `30033264`.

A flat list of numbers without source location and relationship role would make
this document harder, not easier, to use.

### External documents carry their own reference systems

The sampled external/INML material contains fields such as `Vossa Referência`,
`Nossa referência`, an external process number `2019/000529/LX-C-1`, and a
request to quote the reference when responding. The court occurrence, court
communication, external institution, postal, and external-process identifiers
must remain separate namespaces.

### Missing media still have useful reference context

Two sampled multimedia records in appendix E have no binary but retain:

* occurrence `165718265`;
* package/family reference `46224704`;
* distinct UUID-like court-document source keys;
* explicit `Missing in corpus` status.

The reference model must permit a source document or package component without a
binary. SHA-256 cannot be the only lookup anchor.

## Sample matrix

`Printed relation` reports only what was established from the inspected register
and readable artifacts. `Not established` is deliberately not converted to
`absent from the original`.

| Row | Case | Type/context | Bucket | Printed relation | Result |
| ---: | --- | --- | ---: | --- | --- |
| 4 | A | Termo | `12063566` | Same `Referência` in literal text | Direct occurrence reference |
| 6 | A | Conclusão | `12063574` | Not established | Keep occurrence reference only |
| 7 | A | Visto 1.º Adjunto | `12124970` | Not established | Keep occurrence reference only |
| 11 | A | Acórdão | `12258668` | Process number found; reference not established | Do not infer intrinsic reference |
| 12 | A | Ata | `12258756` | Same `Referência` in literal text | Direct occurrence reference |
| 13 | A | Notification of Acórdão | `12273569` | Same `Referência` plus external postal reference | Multiple namespaces |
| 15 | A | Acórdão registry/MP notification package | `12273712` | Not conclusively resolved | Mixed-container review needed |
| 18 | A | Despacho | `110478264` | Reused binary establishes this as document reference | Intrinsic act candidate |
| 19 | A | Notification occurrence | `110504576` | Points to document reference `110478264` | Occurrence-to-act relationship |
| 24 | A | Certidão package item | `110506941` | Embedded Ata says `12258756` | Package occurrence differs from item |
| 25 | A | Certidão package item | `110506941` | Different Ata/source key | Multiple binaries in occurrence |
| 29 | A | Cota | `111015507` | Not established in readable text | Keep occurrence reference only |
| 80 | C | External/INML item in certidão package | `133698460` | External reference family present | Multiple institutional namespaces |
| 102 | C | Ata | `17805829` | Not conclusively resolved | No rule inferred |
| 213 | D | Ofício in certidão package | `133705905` | Literal document reference `125926657` | Package occurrence differs from item |
| 303 | E | Missing multimedia | `165718265` | No binary; distinct source UUID | Referenceable without binary |
| 350 | E | Missing multimedia | `165718265` | No binary; distinct source UUID | Separate component, same package |
| 362 | Main | Requerimento | `532882` | Literal `REF.ª 17964927`; register filing ref differs | Filing field is not current PDF ref |
| 367 | Main | Citius submission sheet | `651161` | Literal `REF.ª 18145983`; register filing ref differs | Filing field is contextual/derived |
| 369 | Main | Requerimento | `652884` | Literal `REF.ª 18149133`; register filing ref differs | Split filing/package complexity |
| 578 | Main | Cota | `105492248` | Cites despacho `105398957` | Directed relationship, not alias |
| 1093 | Main | Citius submission sheet | `15365104` | Current `33348144`, cited `33157723` and `30033264` | Several roles in one PDF |
| 1583 | Main | Vista | `129324215` | Not established | Event reference only |
| 1603 | Main | Vista | `129613983` | Not established | Event reference only |

## Conclusions

The experiment supports building a reference registry, but it rejects a single
preferred-reference column and a one-to-one document model.

1. `Bucket Reference` is a useful and often printed court-facing occurrence
   reference, but it does not always identify the contained binary.
2. `Court Document Reference` behaves as a precise source/export identity in the
   sample and was not observed as the number people quote from the document.
3. The register's `Citius Filing Reference` is useful package/relationship data,
   but its current row placement does not reliably identify the current
   occurrence or PDF.
4. Filing-sheet `REF.ª` values extracted from the original PDF text are highly
   valuable and should be retained as page-attributed observations.
5. Notifications, transmitted acts, package occurrences, attachments, and reused
   binaries require explicit relationships rather than copied scalar fields.
6. Missing media must remain addressable through source-document and occurrence
   references even without SHA-256.

## Smallest useful implementation slice

The next slice should introduce attributed reference observations and exact
lookup without attempting full document decomposition.

Minimum fields:

* exact reference value and exact source label;
* conservative namespace/type, including `unknown`;
* target kind: occurrence, source document, binary, submission/package, court
  act, notification, component, external item, or unknown;
* case and occurrence context;
* source document and optional binary identity;
* evidence artifact and page/item lineage;
* relationship role when the reference points to another object;
* observation producer/version, confidence, and review state.

Initial population should use only:

1. source-recorded process, bucket, and court-document identifiers already in
   PostgreSQL;
2. explicitly labelled references from the Document Register, preserving its
   review provenance;
3. high-precision patterns such as `REF.ª`, `Referência:`, and `sob a ref.` from
   literal text or page-attributed processor items.

The importer must not ingest the 320-column CSV generically because it contains
duplicate header names and mixed evidential layers. A reviewed column mapping is
required. Search should return all matching observations and their context,
rather than silently selecting one number as the document's universal name.

## Remaining limitations

* Twenty-four examples establish counterexamples and a viable model, not the
  complete internal Citius schema.
* Not every sampled original was visually rendered; `not established` does not
  mean a reference is absent from the page image.
* OCR and layout can separate labels from values. Automated extraction requires
  page/item lineage and conservative confidence.
* The provenance of each enriched Document Register column still needs to be
  documented before import.
* Package-component boundaries may remain unknown until a later, separately
  attributed contents-inventory phase.
