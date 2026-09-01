# Evidence Layers, Court-System Metadata, and Digital Signatures

## Status

Discussion note.

This records the current architectural reasoning about where
court-system metadata and PDF digital-signature information belong in
Virgilio.

It does not define a final schema or authorize a new implementation
phase.

------------------------------------------------------------------------

## 1. Core Purpose

Virgilio should act as a **facilitator between heterogeneous case
material and AI**, not as a replacement for AI reasoning.

Its durable responsibility is to preserve and expose:

-   original source material;
-   source-system context;
-   evidence contained in acquired files;
-   provenance;
-   relationships;
-   user-registered knowledge;
-   derived representations suitable for later AI consumption.

AI systems can then perform interpretation, comparison, summarization,
timeline construction, question answering, and other reasoning over that
substrate.

The durable value of Virgilio should therefore survive changes in AI
models, extractors, embedding systems, or retrieval strategies.

------------------------------------------------------------------------

## 2. Project Responsibility and Non-Goals

Virgilio is a **provenance-aware case and document substrate**.

Its primary responsibility is to:

-   **preserve** source material and evidence;
-   **relate** documents, occurrences, source-system records, and
    registered knowledge;
-   **retrieve** relevant material reliably;
-   **expose** that material, with provenance, to humans and AI systems.

Virgilio should be cautious whenever its responsibility starts moving
from preserving and exposing information toward deciding what that
information means.

A useful working rule is:

> **Store, preserve, relate, retrieve, and expose. Be cautious about
> understand, conclude, and decide.**

### 2.1 Capability boundary

| Capability | Virgilio responsibility? |
| --- | --- |
| Preserve original binaries | **Yes** |
| Maintain SHA/content identity | **Yes** |
| Preserve source-system and procedural occurrences | **Yes** |
| Preserve court-system metadata with provenance | **Yes** |
| Extract evidence channels reliably | **Yes** |
| Preserve PDF signature and structural evidence | **Yes** |
| Store user annotations and registered knowledge | **Yes** |
| Store explicit relationships | **Yes** |
| Track provenance | **Yes** |
| Retrieve relevant material for AI | **Yes** |
| Expose material through API/MCP or equivalent interfaces | **Yes** |
| Record AI-derived observations with provenance | **Yes, as provisional derived observations unless explicitly promoted or confirmed** |
| Store outputs produced by specialist classifiers or analytical tools | **Potentially yes** |
| Require sophisticated legal NLP classifiers as part of Virgilio's core | **No** |
| Decide what a judgment legally means | **No - this belongs to human/AI interpretation** |
| Build its own general-purpose summarization capability | **No** |
| Reproduce or compete with frontier AI document reasoning | **No** |

### 2.2 AI-derived observations

Virgilio may persist observations produced by AI or other analytical
systems, provided their provenance and epistemic status remain explicit.

For example:

``` text
AI observation
    |
    v
provisional derived observation
    |
    +--> retained with model/tool provenance
    |
    v
optional human review
    |
    +--> confirmed
    +--> corrected
    +--> rejected
    |
    v
registered knowledge, where appropriate
```

An AI observation should therefore not silently become a source fact or
human-confirmed fact.

Virgilio may store it because persistence, provenance, comparison, and
later review are useful. The distinction between **observed by AI** and
**confirmed as knowledge** must remain visible.

### 2.3 Specialist analysis

Virgilio does not need to prohibit specialist NLP, classification,
extraction, or analytical tools.

The important boundary is that these capabilities are **consumers or
producers of derived observations**, not part of Virgilio's core
identity.

For example, a future legal-document classifier could produce:

``` text
document
    |
    v
classifier
    |
    v
derived classification
    |
    +-- classifier identity
    +-- version
    +-- confidence/output
    +-- source representation(s)
```

Virgilio may preserve and expose that result without becoming dependent
on that classifier for its fundamental usefulness.

### 2.4 Architectural consequence

The project should remain valuable even if:

-   Docling is replaced;
-   Xberg is replaced;
-   the preferred AI provider changes;
-   embedding models change;
-   retrieval techniques change;
-   context windows become dramatically larger;
-   AI systems eventually consume large document collections directly.

What should remain durable is:

``` text
original material
      +
source-system evidence
      +
binary/document evidence
      +
provenance
      +
relationships
      +
registered knowledge
      +
attributable derived observations
```

Everything above that boundary should be replaceable or recomputable.

A concise project definition is therefore:

> **Virgilio is a provenance-aware case and document substrate. Its job
> is to preserve, relate, retrieve, and expose heterogeneous source
> material, evidence channels, registered knowledge, and derived
> observations so that humans and AI can reason over them. Its core job
> is not to replace legal reasoning, decide meaning, or compete with
> general-purpose AI interpretation.**

------------------------------------------------------------------------

## 3. Court-System Metadata Is First-Class Source Evidence

Information exposed by the court system around a document should not be
treated merely as convenience metadata.

It is evidence of **what the source system recorded about a document or
procedural occurrence**.

Potential examples include:

-   source-system identifiers;
-   references;
-   bucket/grouping information;
-   document labels or names;
-   document categories where supplied;
-   source-system dates;
-   source ordering;
-   submitter or party information where supplied;
-   relationships or groupings represented by the source system;
-   filenames and download metadata;
-   source-system history where recoverable.

This information should be preserved independently of what can later be
inferred from the PDF.

For example:

``` text
court-system date:   2022-01-14
PDF document date:   2022-01-13
PDF signing time:    2022-01-13 14:47:37
user receipt date:   2022-01-17
```

These should not be collapsed into a generic `document.date`.

They are different observations with different provenance and
potentially different semantics.

The same principle applies to references, labels, identifiers, and
relationships.

Where historical court-system conventions changed over time, Virgilio
should preserve the raw source values before attempting normalization or
semantic interpretation.

------------------------------------------------------------------------

## 4. Document/Binary Evidence Is a Separate Layer

The acquired file provides another evidence boundary.

For a PDF, this includes information directly observable from the
acquired binary, for example:

-   SHA-256 content identity;
-   native/literal PDF text;
-   PDF metadata;
-   annotations;
-   widgets;
-   AcroForm fields;
-   digital-signature fields;
-   signature dictionaries;
-   embedded certificate material;
-   raster/page-image content;
-   embedded-file indicators;
-   other structural PDF information.

This evidence is distinct from both:

1.  metadata supplied by the court system; and
2.  downstream interpretation produced by Docling, Xberg, or AI.

An omission by one extractor is not evidence that the information is
absent from the PDF.

------------------------------------------------------------------------

## 5. Digital Signatures Are First-Class PDF/Binary Evidence

Digital signatures belong conceptually close to `file_binary`.

A PDF digital signature is represented by structures contained in the
PDF and is tied cryptographically to defined byte ranges of that PDF.

Directly observable signature evidence can include:

-   signature field existence;
-   field name;
-   populated/unpopulated state;
-   `/ByteRange`;
-   `/Contents`;
-   `/Filter`;
-   `/SubFilter`;
-   `/M` signing-time claim;
-   `/Name`;
-   `/Reason`;
-   `/Location`;
-   contact information;
-   embedded certificate material;
-   certificate subject;
-   certificate issuer;
-   certificate serial number;
-   certificate fingerprint;
-   signature appearance stream;
-   presence of multiple signatures.

These are facts about what the acquired PDF contains.

They are therefore not AI metadata and not court-system metadata.

Conceptually:

``` text
file_binary
    |
    +-- sha256
    +-- PDF literal/native text
    +-- PDF metadata
    +-- forms/widgets/annotations
    +-- raster content
    |
    +-- digital-signature evidence
          +-- signature fields
          +-- ByteRange
          +-- signature dictionary
          +-- certificate material
          +-- appearance stream
```

The existing `pdf_signature_metadata` representation is therefore
correctly positioned in the PDF evidence layer, even if the conceptual
term **PDF signature evidence** is somewhat more precise.

No rename is implied by this discussion note.

------------------------------------------------------------------------

## 6. Signature Evidence, Validation, and Legal Interpretation Must Remain Separate

Three different levels must not be collapsed.

### 6.1 Direct PDF evidence

Facts directly observable from the acquired PDF:

``` text
Signature1 exists
ByteRange = [...]
certificate subject = ...
claimed signing time = ...
reason = ...
```

### 6.2 Derived technical validation

Results obtained by applying a validation procedure:

``` text
signed byte ranges reproduce the expected digest
cryptographic signature verifies
certificate chain validates under trust policy X
revocation status was Y under check Z
incremental changes exist after the signed revision
```

These results depend on tools, algorithms, trust stores, policies, time,
and potentially network-accessible validation information.

They require their own provenance.

### 6.3 Legal/contextual interpretation

Possible conclusions such as:

``` text
this judgment was validly signed by the judge
this signature establishes authorship
this signature has a particular legal effect
```

These are not raw PDF facts and should not be encoded as though they
were.

They require legal and procedural interpretation.

The intended boundary is therefore:

``` text
PDF signature evidence
        |
        v
derived technical validation
        |
        v
legal/contextual interpretation
```

Extraction, cryptographic validation, trust assessment, and legal
validity are separate concerns.

------------------------------------------------------------------------

## 7. Historical or Derivative PDFs Make This Separation Important

A later PDF can incorporate material from an earlier signed document.

Subsequent assembly or modification can result in situations where:

-   historical signature structures remain present;
-   signer and certificate information remain extractable;
-   signature appearance text remains visible;
-   a validation procedure reports a digest mismatch or later
    modification;
-   the outer/derivative PDF may itself contain another signature.

A failed validation must therefore not erase or overwrite the underlying
observation that signature structures are present.

The evidence should remain available independently of the validation
result.

This is particularly important for court-generated derivative/container
PDFs.

------------------------------------------------------------------------

## 8. OCR Is Different From Direct PDF Structure

OCR also belongs on the evidence side of the architecture, but it has a
different epistemic status from directly observable PDF structures.

For example:

-   `/ByteRange` is directly present in the PDF structure;
-   a signature field is directly present in the PDF structure;
-   literal/native PDF text is directly encoded in the PDF;
-   OCR text is **derived by rendering visual content and applying
    recognition**.

Therefore provenance should make this distinction visible.

Conceptually:

``` text
direct binary/PDF observations
    +-- native text
    +-- signature structures
    +-- forms/widgets
    +-- annotations
    +-- PDF metadata

derived technical evidence
    +-- OCR text
    +-- cryptographic validation results
    +-- structural diagnostics where interpretation/tooling is involved
```

This does not make OCR unimportant. It means its derivation should
remain explicit.

------------------------------------------------------------------------

## 9. Registered Knowledge Is Another Separate Layer

Virgilio should also allow information to be registered after
acquisition.

Examples may include:

-   user annotations;
-   case/proceeding assignments;
-   matter/topic assignments;
-   document relationships;
-   corrections;
-   contextual observations;
-   links between procedural events;
-   human-confirmed AI observations.

This information should retain its own provenance and should not
silently mutate source-system or binary evidence.

An AI-derived observation can potentially become durable knowledge
through an explicit workflow such as:

``` text
AI observation
      |
      v
proposed fact / relationship
      |
      v
human confirmation, correction, or rejection
      |
      v
registered knowledge
```

------------------------------------------------------------------------

## 10. Four Durable Layer Families

At a repository-wide level, Virgilio should now be understood as
preserving four distinct durable layer families:

### 9.1 Source-system evidence

What the court/source system recorded about a document or procedural
occurrence, for example:

-   source identifiers;
-   bucket/grouping placement;
-   document labels;
-   references;
-   source-system dates;
-   ordering;
-   document-type/category fields;
-   party/submitter fields where supplied;
-   source-exposed relationships;
-   filenames and download metadata.

### 10.2 Binary/document evidence

What the acquired file actually contains, for example:

-   direct observations
    - immutable binary identity;
    - SHA-256;
    - literal/native PDF text;
    - signatures;
    - forms/widgets/annotations;
    - PDF metadata;
    - raster/page-image content;
-   evidence-preserving derivations
    - OCR-derived page text;
    - future technical signature validation findings;
    - other attributable diagnostics.

### 9.3 Registered knowledge

Information later supplied, confirmed, corrected, or explicitly adopted
by Virgilio, for example:

-   user annotations;
-   case/matter assignments;
-   document relationships;
-   corrections;
-   contextual facts;
-   human-confirmed observations.

### 9.4 Interpretation / AI

Recomputable understanding and convenience projections, for example:

-   Docling/Xberg representations;
-   AI extraction;
-   summaries;
-   timelines;
-   search projections;
-   answers.

Most of the current repository detail fits naturally inside those four
families. Some narrower distinctions, such as OCR versus direct PDF
structure or future technical validation findings, remain useful inside
the broader binary/document-evidence family because they carry different
provenance and epistemic status.

------------------------------------------------------------------------

## 11. Cross-Layer Preservation Invariant

Facts from one layer must not be silently rewritten as facts from
another layer.

In particular:

-   layer 1 should not be inferred from layer 2;
-   layer 3 should not silently overwrite preserved source evidence;
-   layer 4 should remain provisional unless something is deliberately
    promoted into registered knowledge.

For example:

``` text
court-system date:   2022-01-14
PDF document date:   2022-01-13
PDF signing time:    2022-01-13 14:47:37
user receipt date:   2022-01-17
```

These are not competing candidates for a generic `document.date`.

They are different facts with different provenance, semantics, and
potential legal or procedural significance.

Likewise, if the court system labels a filing `Requerimento`, places it
in a particular grouping, or records a source reference, that should be
preserved as the court system's assertion even if the PDF or later AI
interpretation suggests something different.

------------------------------------------------------------------------

## 12. Working Layer Model

At the durable storage/responsibility level, Virgilio has four broad
families:

1.  source-system evidence;
2.  binary/document evidence;
3.  registered knowledge;
4.  interpretation/AI.

For provenance reasoning, the four durable families can be expanded into
the following five-stage conceptual model. This is an explanatory model,
not a claim that Virgilio must collapse everything into five physical
tables or one linear workflow.

The current conceptual model is therefore:

``` text
1. SOURCE-SYSTEM EVIDENCE
   What the court/source system recorded
   about documents and procedural occurrences
                 |
                 v
2. DOCUMENT / BINARY EVIDENCE
   What the acquired file actually contains
   +-- content identity
   +-- native/literal text
   +-- signatures
   +-- forms/widgets/annotations
   +-- raster content
   +-- PDF metadata
                 |
                 v
3. DERIVED TECHNICAL EVIDENCE / FINDINGS
   What reproducible processing derives
   +-- OCR
   +-- signature validation, if implemented later
   +-- structural diagnostics
                 |
                 v
4. REGISTERED KNOWLEDGE
   Human/user-confirmed contextual information,
   relationships, corrections, and annotations
                 |
                 v
5. INTERPRETATION / AI
   Recomputable understanding
   +-- Docling/Xberg interpretations
   +-- search projections
   +-- summaries
   +-- timelines
   +-- entity resolution
   +-- AI answers and analysis
```

The arrows do not imply that each layer replaces the previous one.

Higher layers should remain traceable to the evidence and provenance on
which they depend.

------------------------------------------------------------------------

## 13. Architectural Consequence

The architecture should not seek a single universal `"best text"` or
`"best metadata"` representation.

Instead, Virgilio should make independently attributable channels
available so that downstream consumers can choose the appropriate
evidence for a particular purpose.

A future AI-facing projection may combine several channels, but the
combination should be explicit and reproducible rather than silently
destroying their provenance.

The desired long-term relationship is:

``` text
court/source systems
        |
        +--------------------+
        |                    |
        v                    v
source-system evidence   acquired binaries
                             |
                             v
                       PDF/file evidence
                             |
                             v
                    technical derivations
                             |
             +---------------+---------------+
             |                               |
             v                               v
      registered knowledge          interpreted representations
             |                               |
             +---------------+---------------+
                             |
                             v
                    AI-facing projections
                             |
                             v
                      AI / ChatGPT / API
```

Virgilio's role is to make this material **persistent, attributable,
retrievable, and usable by AI**.

It should not attempt to reproduce the reasoning capabilities of the AI
layer.

------------------------------------------------------------------------

## 14. Future Investigation

A separate investigation is warranted for the **court-system evidence
layer**.

The goal should be to determine empirically:

-   exactly what metadata the court system supplied;
-   what each source identifier identifies;
-   what belongs to a document versus an occurrence;
-   how buckets/groupings behave;
-   what the different source dates mean;
-   whether ordering has procedural meaning;
-   whether labels/categories are controlled or free-form;
-   how references changed over the lifetime of the corpus;
-   which relationships are explicitly represented by the source system;
-   which apparent relationships would instead be later inference;
-   whether the current imported schema preserves the original source
    semantics sufficiently.

This investigation should begin from the existing scraped/source data,
not from assumptions inferred from PDF contents.

It should preserve raw source-system evidence before proposing
normalization.

------------------------------------------------------------------------

## 15. Current Position

The current PDF evidence work remains aligned with this model.

In particular:

-   the immutable original binary remains authoritative;
-   `pdf_literal_text` preserves a native/literal text projection;
-   `pdf_signature_metadata` preserves structural signature evidence
    without claiming legal validity;
-   `pdf_structure_inventory` preserves structural observations;
-   `pdf_ocr_text` remains a distinct derived OCR channel;
-   Docling and Xberg remain interpretation engines;
-   disagreements between channels are retained rather than silently
    reconciled.

No implementation change is required merely because of this discussion
note.

The main architectural clarification is that **court-system evidence and
binary/PDF evidence are both first-class provenance-bearing inputs to
Virgilio, while interpretation and AI remain downstream consumers of
those inputs.**

------------------------------------------------------------------------

## 16. Follow-Up Notes

### 16.1 Operational

-   Add a narrow follow-up for worker-visible extractor progress and
    heartbeat reporting.
-   The immediate need is not a full queue redesign; it is enough to
    let long-running Docling/OCR jobs expose coarse states such as
    materialized, extractor-started, OCR-running, persisting-artifacts,
    and last-seen heartbeat.
-   Keep this separate from evidence semantics. Progress reporting is
    operational runtime state, not document evidence.
-   Add a narrow consultation-viewer follow-up for problematic scanned
    PDFs whose original-page preview renders faint or apparently empty
    in the current pdf.js canvas viewer even though the binary contains
    visible scanned page content.
-   Treat this as an original-binary rendering issue in the consultation
    UI boundary, not as proof that the evidence or OCR-derived
    representation is wrong.
-   Current concrete examples:
    - `922d4ab87f16cf1bf288af338eab2aca6fa4c4c34ad76461931baf3bd68d6333`
    - `dbde4c5a91c03031fccaddd963c3fa2b4c274bf52e0d9da7b75a2a4946f75c23`

### 16.2 Evidence tooling

-   Remember the deferred Linux/container tool path as a future
    implementation option for PDF evidence extraction and validation.
