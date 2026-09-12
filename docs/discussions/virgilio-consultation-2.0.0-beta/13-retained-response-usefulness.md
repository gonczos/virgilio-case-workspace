# Useful information in retained API responses

Recorded 2026-09-12. Status: direct read-only analysis of existing originals for consumer
planning. The user asked to analyse usefulness before further login/live validation.
No new source access, implementation, import, binary processing or acceptance occurred.
This analysis can proceed independently of the new preservation module's pending live test.

## Actual inputs and method

Read all six lp entries in the saved case response, all fifteen lista_atos entries and
39 nested document appearances on its captured first page, and all 21 intervFinal entries
in the main-case participant response. Files are under
C:/repos/scraper/output/planning-live-20260912/attempt-2/:

| Original file | Recomputed SHA-256 |
| --- | --- |
| 1-ajax-processos.json | a1438a09a302637d524af49ecdc61b0ef6086f04cb583de9d3e29b179fbbc7db |
| 2-obter-info-intervenientes.json | 5aea35446b5b5a95d0a26c9824de3cf529d369aa9bc1782481a1e0ef08dc7166 |
| 3-ajax-get-atos.json | 517f160d9ae4633939fccf2fcc77aedd3dba376b01456b80546993b74a6dbc6e |

Hashes match the previously recorded live evidence. These are earlier inspection captures,
not new output from the response-preservation implementation. Observation context/times
remain in the original manifest and pinned scraper live report; this analysis is a new
interpretation of those exact inputs. No original was edited or copied into Git.

Parsed JSON, enumerated actual fields and wrapper values, counted populated/empty/zero
values, compared reported counts with nested arrays, compared calendar components and
raw/whitespace-normalized description pairs, and tested duplicate envelope arrays with
consistent JSON serialization. Aggregated results only are recorded; participant names,
identifiers and document values are not published. Empty/null aggregation below does not
change original distinctions. No legal meaning, permanent identity or completeness is
inferred from these mechanical comparisons.

## Findings with direct consultation value

| Evidence found | Direct observation | Use for Virgilio / proposed treatment |
| --- | --- | --- |
| Case classification/status/dates and court/unit | All six have classification, status, filing date, court/unit and two participant slots. dataDecisao populated in three; decisao text and both transito fields empty/null in all six | Familiar case overview and source-labelled dates. Do not promise decision text from these samples. Retain status labels without treating them as verified legal state |
| Status suitable for discussing normal open-case selection | Three source labels are Processo Pendente; three Processo com Decisão | Useful selection input, but a case with a decision is not automatically declared closed by this analysis. Open-case selection needs an explicit policy/user basis |
| Act-to-document membership | Fifteen acts contain 39 appearances; every ndocs equals its nested count, ranging from 1 to 12. Only 25 distinct retrieval tokens occur | Support case/bucket/document and document-first views. Preserve repeated appearances and source nesting; 39 appearances are not 39 permanently identified documents or acquisitions |
| Separate act and document dates | All 39 have dataStatus; 19 match containing act calendar date and 20 differ | Keep procedural act date and document's source-labelled date separately. Neither authoring/signature time nor legal effect is established |
| Two document descriptions | doc and descricao populated and unequal for all 39 appearances, even after trim/whitespace collapse | Retain both fields so navigation/detail can show the source's distinct labels; do not collapse them into a single replacement description |
| Act designation and presenter | All fifteen have descriptions/dates/references; presenter populated in eight, empty/null in seven | Explain what a bucket represents and whom the source labels presenter. Missing presenter is not proof nobody submitted it; do not merge presenter with a participant identity |
| Participant expansion | 21 entries, 20 distinct exact name/designation pairs, 21 distinct idInterv values within the response | Richer participant view than two slots. One repeated name/label pair must not be erased as a duplicate person; preserve ordered scoped entries |
| Source download attributes | All 39 have infoTecnica, type, extension, size and order fields; all extensions report .pdf | Link listing occurrence to source retrieval context. These attributes do not establish a successful PDF acquisition or usable bytes |
| Source digests | 33 appearances have a 64-hex-character source hash, six empty; 21 distinct nonempty hashes | Preserve as source assertions for later explanation/investigation. Not proven SHA-256 of downloaded bytes, not safe as an unchanged-content shortcut |
| Explicit page context | Captured act response declares page 1 and 55 pages | Valuable boundary for collection completeness checks. This retained page is not a complete case history, and the declaration alone does not prove all pages captured |

## Important interpretation traps established by the sample

- All fifteen raw act lenBytes are zero while all 39 nested lenDoc values are positive.
  Preserve source act size, source document size and portal-computed displayed total
  separately. Do not silently replace zero with a sum or label binaries missing.
- The 60 examined date objects (six filing dates, fifteen act dates, 39 document dates)
  have zero clock components and timezone sentinel -2147483648. Preserve their original
  representation; zero clock components do not establish midnight UTC or precise instants.
  The three populated decision dates were counted but not included in that 60-object test.
- Order values repeat within ten of the fifteen acts; 32 of 39 order values are zero.
  They are not unique occurrence IDs. Their meaning beyond a source attribute is open.
- desigIntervPrinc and destino are empty/null in all fifteen acts; idEntidade/idPedido
  are zero throughout. These samples do not demonstrate useful destination/principal
  relationships. Retain source values without creating interpreted edges.
- Eight participant entries have nonempty nifInterv; cedulaInterv and nomeIntervPrinc
  are empty throughout. Required originals retain them; the agreed phase does not
  automatically expose sensitive IDs or perform cross-case identity resolution.

## What is mostly packaging or repetition

Case lp equals the six-entry lista_processos.listaProcessos array under consistent JSON
serialization. Act lista_atos equals the fifteen-entry lista_atos_return.listaAtosProcessuais
array by the same test. They are two presentations inside one response, not independent
source observations. Keep the original body but avoid doubling domain occurrence counts.

Wrappers such as declaredType, scope, name namespace and typeSubstituted largely describe
serialization. They need not become consultation fields. Their nil/value/date context
still matters to faithful interpretation, and preserving the original permits correction.
Other named envelope sections (e.g. documentContent, dadosOSAE, dadosUtilizador) are null
in the inspected case/act envelopes; names alone do not establish hidden document content,
executive data or user information in these captures.

## Assessment and revised next step

Yes: these originals offer useful structured evidence, not merely diagnostics. Highest
value is source nesting/multiplicity, separate descriptions and dates, explicit page scope,
case context and expanded participants. Some of that content already appears in rendered
captures; the originals supply a stronger interpretation basis and additional unprojected
fields. Not all of it is a new capability or a reason to expose every field.

Use this sample-backed inventory to refine the proposed field mapping before fixing
R3 delivery units. The new preservation module's bounded live validation is still needed
to verify future capture behavior; it is not a prerequisite for analysing these existing
bodies. Additional case/page samples may reveal other populated fields, but that remains
unestablished here. No fresh collection is requested by this analysis.

The three agreed directions remain intact. R3–R5/full-contract acceptance and Virgilio
runtime work remain open. Validation comprised parsing, aggregate comparisons and original
hash verification plus documentation link/whitespace checks; no corpus-wide audit.

## User decision: source preparation belongs to the scraper

Following this analysis, the user clarified: "cleaning up the source material should
stay with the scraper. we just need to consume the agreed format".

The scraper owns Citius-specific parsing and normalization: response wrappers, repeated
payload arrays, raw/display field distinctions, source identifiers, date/null handling
and source-level interpretation under declared/versioned rules. It preserves original
evidence and uncertainty; cleaning means preparing attributed structured output, not
rewriting original evidence, merging distinct events or inventing settled meanings.

Virgilio specifies its consumer needs and agrees the exchange format, then validates
and consumes that format. Its adapter maps delivered contract fields into VIEC with
exact upstream and mapping-rule provenance. It does not independently parse Citius HTML,
unwrap raw source payloads or repair producer normalization defects to make deliveries
fit. Such defects are reported back to the scraper for attributed correction. Adapter
mapping defects remain Virgilio's responsibility and distinct from scraper corrections.
The Evidence Broker retains final acceptance and preservation authority.

Original responses may remain required supporting material under R2 and be available
for inspection/custody without becoming Virgilio's operational ingestion interface.
This bounded source analysis informed requirements; it does not transfer ongoing Citius
source preparation to Virgilio. Next coordination should ask for the scraper's proposed
versioned output format and assess its consumer semantics, dependencies and limitations,
rather than design a second source-cleaning pipeline in Virgilio. R3–R5 and full-contract
acceptance remain open. No implementation or import is authorized by this clarification.
