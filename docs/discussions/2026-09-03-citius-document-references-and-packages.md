# Citius document references and filing packages

Status: researched discussion note; not an authoritative architecture or
implemented data contract.

Date: 2026-09-03

## Problem

The court-system label attached to an occurrence is not always a reliable name
for every file associated with it. A Citius entry labelled `Requerimento`, for
example, can represent an electronic filing package containing a generated
submission sheet, the substantive pleading, and independently meaningful
attachments. Reliable substantive classification may therefore require reading
the file rather than copying the occurrence label.

The same material can also be identified by several numbers. The court system,
a filing party, a notification, and people discussing the proceedings may refer
to related but different objects. SHA-256 remains the binary identity but is not
a practical conversational court reference.

## Publicly documented behavior

Portaria n.º 280/2013 distinguishes the electronic form, files containing the
material content of the procedural submission, and documents accompanying that
submission. It also states that the form and substantive files form part of the
procedural submission for legal purposes. The transmission service certifies the
delivery time and makes a copy of the submitted piece and accompanying documents
available to the user.

The historical size rules are also relevant. When accompanying documents made a
submission exceed the applicable limit, documents could be sent through one or
more additional `requerimentos`. Consequently:

* one history occurrence can contain several independently meaningful files;
* one logical filing can occupy several history occurrences;
* the occurrence label can describe the transport or procedural package rather
  than the intrinsic type of every contained document.

Source:
[Portaria n.º 280/2013, particularly articles 6–10 and 13](https://files.dre.pt/1s/2013/08/16300/0515905165.pdf).

Public descriptions of Citius distinguish the chronological history of
procedural acts from the documents available through that history. Court-user
training material likewise describes the process history as being populated as
acts are performed and exposes PDFs through a procedural-history index. This
supports treating occurrence, act, and file as related but distinct concepts.

Sources:

* [Citius portal FAQ](https://www.citius.mj.pt/portal/faq.aspx?tipo=9)
* [DGAJ/CEJ material describing Citius process history](https://cej.justica.gov.pt/LinkClick.aspx?fileticket=vJFLWaF735A%3D&portalid=30)

## Reference-number behavior

Published decisions use `referência Citius` contextually rather than as the name
of one universal object type. Within the same proceeding, separate references
can identify:

* a party submission or requerimento;
* a judicial act such as a despacho;
* a registry act such as a cota;
* the notification or `expediente` transmitting an act;
* a payment guide or an external communication.

One published example separately identifies a party requerimento as `2409674`,
a despacho as `33226139`, a cota as `33359902`, and an associated notification
or expediente as `33261028`. The judgment relates them by date, type, and
procedural sequence rather than treating their numbers as aliases for a single
document.

Sources:

* [Tribunal da Relação de Évora example](https://www.dgsi.pt/jtre.nsf/134973db04f39bf2802579bf005f080b/d045a398a329efd680258c0a00348a33)
* [Supremo Tribunal de Justiça example](https://www.dgsi.pt/jstj.nsf/954f0ce6ad9dd8b980256b5f003fa814/f06ef16e9c9054f180258e340032c723)
* [Tribunal da Relação de Lisboa example](https://www.dgsi.pt/jtrl.nsf/33182fc732316039802565fa00497eec/3326858180c7158a802584ee0042d2f8)

The reviewed public sources do not document Citius's internal allocation of
identifier sequences. Number length or range must therefore not be used alone
to infer an identifier type. The printed label, surrounding text, actor, date,
and procedural context are required.

## Evidence from the supplied Document Register

Read-only inspection of `Documentation with Links - Document Register.csv`
found:

| Observation | Count |
| --- | ---: |
| Procedural/register rows | 2,070 |
| Distinct case references | 5 |
| Distinct bucket references / IDs | 897 |
| Distinct court document references | 1,293 |
| Rows with a linked file | 2,031 |
| Distinct linked files | 1,238 |
| Rows without a linked file | 39 |
| Non-empty Citius filing references | 864 |
| Distinct non-empty Citius filing references | 160 |

These counts align with the current corpus boundary: 1,238 available binaries,
2,031 binary-linked occurrences, and 39 occurrences for unavailable source
media. The register is therefore a strong candidate bridge between human/court
references, procedural occurrences, source documents, and binaries.

The register combines several semantic layers:

1. source/register identity and occurrence metadata;
2. file linkage and export/storage metadata;
3. separately reviewed or inferred classification, relationship, and lifecycle
   observations.

These layers must not be imported with the same evidential status. In addition,
the CSV contains 320 columns and four duplicate header names: `Author /
Signatory Role`, `Recipient / Addressee`, `Related File(s)`, and `Related /
Attached Document Type(s)`. Ordinary CSV readers may reject it or silently
overwrite a duplicate field. Any ingestion must address columns by an explicit,
reviewed schema rather than automatically converting the header row to an
object.

## Conceptual model

The corpus must not assume:

```text
one binary = one legal document = one occurrence = one reference
```

A more faithful starting model is:

```text
procedural occurrence
  -> recorded act or electronic submission
     -> package
        -> main document
        -> zero or more attachments/components
```

Related acts form additional relationships rather than aliases:

```text
requerimento ref. A
  -> considered by despacho ref. B
     -> transmitted by notification/expediente ref. C
```

A combined PDF can contain multiple components, while the same immutable binary
can occur in more than one procedural context. Component boundaries and legal
meaning must not be invented merely to make the model one-to-one.

## Proposed reference observations

Future implementation should store references as attributed observations, not a
single `document_reference` scalar. Each observation should retain, where
available:

* the exact value and source wording (`Ref.ª`, `N/Referência`, and similar);
* a normalized identifier namespace/type;
* the identified target kind: occurrence, submission package, court act,
  notification, file, component, payment guide, or external document;
* process and procedural occurrence context;
* linked source document and binary SHA-256;
* source artifact, page, and location;
* issuer/actor and attributed date;
* extraction or human-review provenance;
* confidence and review state;
* relationships to other observed references.

Candidate types include party-submission reference, judicial-act reference,
registry-act reference, notification/expediente reference, filing `REF.ª`,
bucket/history reference, court-document/export identity, external institution
reference, and unknown source-stated reference.

The exact source value must be preserved even when a normalized type is unknown.
An uncertain type should remain `unknown`; number shape must not silently decide
it. Taxonomy classifications can supply descriptive labels but must not become
identifiers or canonical evidence.

## Consultation and search behavior

Exact lookup by any observed reference should return the identified object and
its local procedural context, including:

* what kind of object the reference is believed to identify;
* process, date, actor, and source label;
* linked occurrence, source document, binary, and package component;
* related submission, decision, notification, or external references;
* provenance, confidence, and unresolved ambiguity.

Search results should display a court-facing reference and understandable
document label while retaining SHA-256 as the immutable binary identity. Related
references must not be presented as interchangeable aliases unless evidence
establishes that they identify the same object.

## Smallest useful validation slice

Before implementing a general registry, inspect a bounded sample of approximately
20–30 occurrences covering party submissions, court acts, notifications,
registry records, combined packages, split submissions, repeated binaries, and
missing media. For each sample, establish what the register's `Bucket Reference`,
`Court Document Reference`, `Citius Filing Reference`, and printed in-document
references actually identify.

The result should be a proposed namespace mapping with counterexamples and
unknowns. Only then should the reference-observation schema and exact-reference
search contract be promoted into `docs/architecture/`.

## Limitations

This note explains observed and publicly documented behavior; it is not a reverse
engineered specification of the internal Citius database. Public materials do
not establish the semantics of the project's exported column names. Manual
corpus validation remains necessary, and substantive document classification
may require reading the original binary.
