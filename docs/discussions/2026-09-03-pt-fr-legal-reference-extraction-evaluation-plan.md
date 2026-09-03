# Portuguese and French legal-reference extraction evaluation plan

Status: review draft; discussion-stage only. This is not authoritative
architecture, an implementation contract, or a recorded-run prompt.

Date: 2026-09-03

## Purpose and boundary

This plan defines the knowledge base and bounded evaluation needed before
implementing AI-assisted legal-reference extraction. It complements the
existing reference-observation architecture and Citius mapping work; it does
not replace or revise those decisions.

The immediate scope is:

1. document Portuguese, French, EU, and international legal-reference forms;
2. record common abbreviations, punctuation, OCR variants, and ambiguous
   number shapes;
3. create a small reviewed gold set from existing representations;
4. evaluate deterministic extraction before adding AI assistance.

This slice does not implement an extractor, resolve the full corpus, modify
canonical evidence, write to PostgreSQL, or infer procedural relationships.

All source representations, annotation fixtures, and this plan must be read
and written as UTF-8. Apparent mojibake produced by a caller's decoding path
must not be treated as source corruption or used to replace valid text.

## Core distinction

Three states must remain separate:

* **Observed**: an exact text span appears in a specific representation or
  source record, with its original spelling and location.
* **Normalized candidate**: a deterministic or reviewed interpretation maps
  the raw span to a namespace and normalized value.
* **Resolved target**: independent evidence establishes the represented
  proceeding, act, filing, attachment, legislation, register record, or other
  object.

A pattern match is not target resolution. Multiple observations may refer to
one target, and one ambiguous observation may retain multiple target
candidates. Corrections must not alter the processor output in which the text
was observed.

## Reference families to cover

### Portugal

* Court process/NUIP forms such as `13608/14.8T2SNT` and suffixed proceedings
  such as `13608/14.8T2SNT-C`.
* Citius and procedural references attached to requerimentos, despachos,
  atas, promoções, vistas, conclusões, notificações, expedientes, and other
  occurrences.
* Court decisions cited by court, type, date, process number, and optionally
  ECLI.
* Portuguese ECLI: `ECLI:PT:<court>:<year>:<serial>`, currently documented for
  the STJ and the Relações of Lisbon, Porto, Coimbra, Évora, and Guimarães.
* Filing-package and local references including `Doc`, `Documento`, `Anexo`,
  `Apenso`, `autos`, and physical-file references such as `fls. 3 e ss.`.
* Legislation by act type, number/year, date, and nested provision: `artigo`,
  `n.º`, `alínea`, and related abbreviated forms.
* External administrative, police, tax, civil, commercial, land, and other
  register references, always retaining their source label.

### France

* `n° RG` (*répertoire général*) identifiers, including numeric and locally
  suffixed forms.
* `n° Portalis`, kept separate from RG and judicial-dossier numbers.
* Cour de cassation `pourvoi n°`, including optional leading register letters.
* Conseil d'État numeric decisions and alphanumeric CAA identifiers.
* French ECLI: `ECLI:FR:<court>:<year>:<ordinal>`.
* Procedural acts including `requête`, `assignation`, `conclusions`, `mémoire`,
  `ordonnance`, `jugement`, `arrêt`, `notification`, and `signification`.
* Locally scoped `pièce n°`, `bordereau de pièces`, and `annexe` references.
* Legislation such as `loi n° YYYY-N`, `décret n° YYYY-N`, dated `arrêté`, and
  code provisions such as `L. 111-1` and `R. 421-1`.
* NOR, ELI, JORFTEXT, JORF issue, and text number as related but non-identical
  identifiers.

### EU and international

* ECLI, CELEX, and ELI as distinct identifier systems.
* EU case numbers such as `C-123/22`, `T-160/17`, and joined cases.
* EU acts cited by type, jurisdiction marker, number/year, institution, and
  date.
* ECHR application numbers, chamber markers, and paragraph references.
* Named instruments such as the Hague Convention, whose title/date may be the
  only observed reference.

## Authoritative research basis

* [Council ECLI specification, 2019/C 360/01](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=oj%3AJOC_2019_360_R_0001)
* [European e-Justice Portal: Portuguese ECLI](https://e-justice.europa.eu/topics/legislation-and-case-law/european-case-law-identifier-ecli/pt_pt)
* [European e-Justice Portal: French ECLI](https://e-justice.europa.eu/topics/legislation-and-case-law/european-case-law-identifier-ecli/fr_fr)
* [Lei n.º 74/98: publication, identification, and form of Portuguese acts](https://files.dre.pt/gratuitos/1s/2007/08/16300.pdf)
* [Portuguese electronic-court procedure and individually identified attachments](https://portal.oa.pt/publicacoes/informacao-juridica/direito-nacional/%C3%A1reas-de-referencia/justica/tramitacao-eletronica-dos-processos/)
* [Légifrance search and identifier examples](https://www.legifrance.gouv.fr/contenu/menu/cas-d-usage)
* [French Guide de légistique](https://www.legifrance.gouv.fr/contenu/menu/autour-de-la-loi/guide-de-legistique)
* [Justice.fr: Portalis and judicial-dossier data](https://www.justice.fr/donnees-personnelles/portail-justiciable)
* [Conseil d'État decision-reference guidance](https://www.conseil-etat.fr/decisions-de-justice/jurisprudence/rechercher-une-decision-arianeweb/se-procurer-une-decision-ou-des-conclusions-d-un-rapporteur-public)
* [EUR-Lex CELEX identifier guide](https://eur-lex.europa.eu/content/tools/eur-lex-celex-infographic-A3.pdf)
* [EUR-Lex ELI guide](https://eur-lex.europa.eu/content/help/eurlex-content/eli.html?locale=en)

These sources describe public citation and lookup behavior. They do not specify
undocumented internal Citius allocation rules, so number length or range must
not be used alone to infer an identifier type.

## Surface and OCR variants

The evaluation must include:

* `n.º`, `nº`, `n.°`, `n°`, `no`, `N.º`, `N°`, `Ref`, `Ref.ª`, `Referência`,
  and missing accents;
* `artigo`, `art.`, `art.º`, `artº`, and French code forms including
  `L. 111-1`, `L111-1`, `L 111-1`, and `L.111-1`;
* dates written with hyphens, slashes, dots, month names, spaces around
  separators, and two-digit years;
* line-wrapped identifiers, nonbreaking spaces, repeated words, dropped
  punctuation, and colon/semicolon confusion;
* OCR substitutions such as `O/0`, `I/l/1`, `S/5`, `B/8`, `º/°`, and damaged
  accents;
* historical Portuguese spelling such as `acto` and `electrónico`;
* French lexical false positives such as `pourvoi` versus the verb `pourvoir`.

## Pilot evidence already gathered

The read-only exploratory pass used bounded consultation-API `GET` requests.
No database queries, file writes, service changes, or corpus processing were
performed. API results are an exploratory snapshot because another task was
actively running the local services.

### Positive document

Binary SHA-256:
`17eb40fa6ca2c37156d9c230640ff03efbddfa531111f09bb03a7152f9e4a691`.

Docling representation ID: `6038`.

Observed families include:

* process `13608/14.8T2SNT`;
* filing/procedural reference `39176427`;
* at least 14 distinct explicit Citius/reference values;
* `artº 32 nº3 RGPTC` and `artº 646 nº3 CPC`;
* `Regulamento (CE) nº2201/2003`;
* `Convenção de Haia, de 25 de Outubro de 1980`;
* local references `Doc nº1`, `Doc 25`, and `25 A`.

The Citius values were also found in the independent Docling, Xberg, and
literal-text representations. This supports transcription confidence but does
not prove target identity. Locations exposed by search were document-level,
not verified PDF pages.

Example representation-relative span:

```text
raw: 122397168
char_start: 7624
char_end: 7633
context: Promoção em 4.04.2018 ... referência citius 122397168
provisional_class: court_occurrence_or_citius_reference
status: observed
location: document_level
```

### Negative-control document

Binary SHA-256:
`02c8e7cee7eca2f83b98d64aa2dd64b1b888039210a8cbf5c2133322d1b1757e`.

Docling representation ID: `4950`.

Reference-like negatives include passport, NIF, telephone, postal, fiscal
document, birth-register, and service numbers. The same `n.º + digits` surface
shape also introduces the genuine external police reference
`Registo n.º 1086/2014`. Context therefore determines the class; number shape
alone cannot.

### Retrieval findings

* `2201/2003` returned the EU regulation, while `2201 2003` and a longer
  paraphrase did not. Search recall is punctuation- and phrasing-sensitive.
* A `pourvoi` search returned occurrences of `pourvoir`, a required negative
  test.
* `126015835` occurred in two selected binaries, supporting a cross-document
  reference candidate without proving target identity.
* A text mention of `126207455` and a source-recorded metadata occurrence with
  that value can be joined as candidates, but the join alone does not prove
  that an associated binary is the referenced ordonnance.
* `PA 1666/2020` appeared in Docling but not Xberg and therefore requires source
  verification.
* Much scanned material lacks verified text-to-PDF-page mapping. Exact offsets
  can be recorded within a representation, but PDF page must remain unavailable
  unless separately supported.

## Proposed gold annotation record

Each record should contain:

* immutable binary SHA-256;
* representation ID, kind, representation-content SHA-256, processor key,
  processor version, and processor configuration identity;
* segment ID when available;
* exact raw span and representation-relative `char_start`/`char_end`;
* offsets defined as zero-based Unicode code-point indexes with half-open
  ranges `[char_start, char_end)`;
* bounded preceding/following context;
* strongest supported location kind and optional verified PDF page;
* provisional reference family and namespace;
* optional normalized candidate, without replacing the raw span;
* observation status, candidate targets, and resolution state;
* positive, negative, or ambiguous label;
* annotation producer/version, confidence, and review state;
* reviewer decision and rationale when applicable.

Processor agreement or disagreement is a separately attributed derived
comparison between observations from identified representations. It is not an
intrinsic property of an individual gold annotation and must retain the
identities and content hashes of every compared representation.

Suggested initial classes are `court_process`,
`court_occurrence_or_citius_reference`, `source_document_reference`,
`procedural_act_by_date`, `local_attachment`, `legislation`,
`international_instrument`, `external_register`, `court_or_authority`,
`unclassified_numeric_candidate`, and `reference_like_negative`.

## Required case-expert review

Before the draft becomes a gold set, review:

1. whether `39176427` is specifically a Citius filing reference;
2. whether the unusually long `1606407299` is correctly transcribed;
3. whether generic `Referência` values inherit a Citius classification from
   broader context;
4. the scope and intended targets of `Doc nº1`, `Doc 25`, and `25 A`;
5. the most useful narrow class for PSP `Registo n.º 1086/2014`;
6. whether processor-specific `PA 1666/2020` is supported by the original page;
7. whether repeated citations remain separate observations. The proposed
   answer is yes, with optional deduplicated presentation later.

The reviewer should decide labels and supported interpretations, not edit the
underlying extracted text.

## Bounded evaluation sequence

### Stage A: freeze the two-document fixture

After expert review, save the positive and negative annotations with exact
representation provenance. Re-fetch the representations after the current
server work is committed and confirm that IDs, content hashes, and offsets have
not changed before treating the snapshot as stable.

### Stage B: deterministic baseline

Evaluate high-structure recognizers for explicit process numbers, ECLI,
labelled Citius references, legislation, and labelled external registers.
Require context labels for ambiguous numeric forms. Emit uncertain candidates
rather than correcting OCR or guessing targets.

### Stage C: error analysis

Measure errors separately by reference family, language, processor, location
kind, and positive/negative/ambiguous label. Record failures caused by OCR,
tokenization, missing page mapping, lexical ambiguity, local scope, and target
resolution.

### Stage D: representative capped expansion

Only after the two-document fixture is stable, add examples needed to cover
French RG, Portalis, pourvoi, administrative-court identifiers, ECLI, physical
folio references, mixed bundles, reused binaries, and missing media. Use a hard
ceiling agreed before expansion; an unresolved reference does not automatically
grow the sample. Freeze the expanded fixture before using it to decide between
deterministic and AI-assisted approaches.

### Stage E: rerun the deterministic baseline and error analysis

Rerun the Stage B recognizers against the complete frozen representative
fixture, then repeat the Stage C error analysis. Publish positive, negative,
and ambiguous denominators for every reference family, together with applicable
exact-span precision and recall, classification accuracy, and normalization
accuracy. These post-expansion results supersede the seed-fixture results when
deciding whether AI is warranted; retain the seed results as historical
diagnostics.

### Stage F: decide whether AI is warranted

Use AI only for bounded tasks where the deterministic baseline fails on the
representative capped fixture and the output can retain evidence and
uncertainty, such as contextual classification or ranking multiple target
candidates. AI must not manufacture identifiers, silently repair source text,
or convert a candidate into a resolved target. The decision must be limited to
the reference families actually represented by reviewed examples.

## Acceptance criteria to agree before implementation

Do not use one aggregate score. Report exact-span precision and recall by
family, plus classification and normalization accuracy only on records where
those tasks are applicable. A family must have a non-zero reviewed denominator
for the relevant metric. Families absent from the fixture are reported as
`not evaluated`, never as zero-error, 100% recall, or evidence that a method is
adequate for that family.

Proposed initial gates for the reviewed fixture:

* zero false positive court/document references from passports, NIFs,
  telephone numbers, postal codes, dates, amounts, page numbers, and pleading
  paragraph numbers;
* 100% recall for exact, explicitly labelled process numbers and ECLI in the
  fixture;
* at least 98% precision and 95% recall for explicitly labelled Citius and
  legislation spans, with every miss and false positive reviewed;
* 100% preservation of raw spans and representation lineage;
* zero unsupported PDF-page claims;
* zero automatic `resolved` states without independently recorded supporting
  evidence;
* ambiguous attachment, bare-number, and external-register cases remain
  explicitly unresolved rather than forced into a class.

These thresholds are provisional and must be recalibrated when the fixture is
expanded. A small pilot cannot substantiate full-corpus performance.

## Stop boundary and review decision

Reviewers should decide whether this plan is sufficient to authorize creation
of the saved two-document foundation fixture and its later capped expansion.
Approval of this discussion draft does not authorize extractor implementation,
AI classification, full-corpus processing, database writes, or architecture
changes.

If approved, the exact next step is to revalidate the API snapshot after the
current server task is complete, obtain the case-expert decisions above, and
save only the reviewed two-document foundation fixture and its annotation
guide. Representative capped expansion remains a later fixture-authoring stage,
not authorization to implement an extractor.
