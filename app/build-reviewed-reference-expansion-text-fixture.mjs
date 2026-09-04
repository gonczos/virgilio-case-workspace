import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

const selectionPath = new URL("../docs/evaluation/reference-extraction-expansion-v1/text-selection.json", import.meta.url);
const outputPath = new URL("../docs/evaluation/reference-extraction-expansion-v1/text-reviewed-fixture-v1.json", import.meta.url);
const selection = JSON.parse(await readFile(selectionPath, "utf8"));
const apiBase = process.env.CONSULTATION_API_BASE ?? "http://127.0.0.1:8091";
const cp = (text) => Array.from(text);
const sha256 = (text) => createHash("sha256").update(text, "utf8").digest("hex");
const rangeByKey = new Map(selection.ranges.map((range) => [range.range_key, range]));
const representationById = new Map(selection.selected_candidates.map(({ representation }) => [representation.id, representation]));
const contents = new Map();

for (const range of selection.ranges) {
  if (contents.has(range.representation_id)) continue;
  const response = await fetch(`${apiBase}/api/consultation/representations/${range.representation_id}/content?format=text`);
  if (!response.ok) throw new Error(`Representation ${range.representation_id}: HTTP ${response.status}`);
  contents.set(range.representation_id, await response.text());
}

const specs = [];
const add = (rangeKey, raw, polarity, classification, parsedCandidate = null, extra = {}, occurrence = 1) => {
  const range = rangeByKey.get(rangeKey);
  const chars = cp(contents.get(range.representation_id));
  const haystack = chars.slice(range.char_start, range.char_end).join("");
  let localStart = -1;
  let cursor = 0;
  for (let index = 0; index < occurrence; index += 1) {
    localStart = haystack.indexOf(raw, cursor);
    if (localStart < 0) throw new Error(`Missing ${JSON.stringify(raw)} occurrence ${occurrence} in ${rangeKey}`);
    cursor = localStart + raw.length;
  }
  specs.push({ rangeKey, charStart: range.char_start + cp(haystack.slice(0, localStart)).length, raw, polarity, classification, parsedCandidate, extra });
};

add("821:243872:243908", "Anexo nº 13", "positive", "local_attachment", { attachment_number: "13" }, { association_group: "r01-pair", association_evidence: "source_stated_hyphen", relationship_type: "unresolved" });
add("821:243872:243908", "DOC Nº12", "positive", "local_attachment", { attachment_number: "12" }, { association_group: "r01-pair", association_evidence: "source_stated_hyphen", relationship_type: "unresolved" });
add("6031:2268:2537", "fls.490", "positive", "physical_folio", { folio: "490" });
add("6031:2268:2537", "fls.491", "positive", "physical_folio", { folio: "491" });
add("3893:152:177", "Registo: 702380056723040", "positive", "external_register", { identifier: "702380056723040", source_label: "Registo" }, { authority: null, namespace: null, register_type: null });
add("821:243794:243830", "Anexo nº 11", "positive", "local_attachment", { attachment_number: "11" }, { association_group: "r04-pair", association_evidence: "source_stated_hyphen", relationship_type: "unresolved" });
add("821:243794:243830", "DOC Nº10", "positive", "local_attachment", { attachment_number: "10" }, { association_group: "r04-pair", association_evidence: "source_stated_hyphen", relationship_type: "unresolved" });

{
  const key = "4886:614:1472";
  const range = rangeByKey.get(key);
  const text = cp(contents.get(range.representation_id)).slice(range.char_start, range.char_end).join("");
  const matches = [...text.matchAll(/fls\.?\s?\d+/gu)];
  if (matches.length !== 60) throw new Error(`Expected 60 folio spans, got ${matches.length}`);
  for (let index = 0; index < matches.length; index += 1) {
    const raw = matches[index][0];
    const interval = Math.floor(index / 2) + 1;
    add(key, raw, "positive", "physical_folio", { folio: raw.match(/\d+/u)[0] }, { association_group: `r05-interval-${String(interval).padStart(2, "0")}`, association_evidence: "source_stated_interval_a", relationship_type: "interval_endpoint", interval_position: index % 2 === 0 ? "start" : "end" }, matches.slice(0, index + 1).filter((m) => m[0] === raw).length);
  }
}

add("4233:5759:5911", "Registo n.° 1684/2020", "positive", "external_police_register", { identifier: "1684/2020", source_label: "Registo n.°" }, { authority_context: "P.S.P.", unit_context_raw: "69.* Esq.*", namespace: null });
add("4233:5759:5911", "69.* Esq.*", "negative", "organizational_unit", null, { negative_reason: "Police organizational-unit designation, not a referenced record; damaged extraction preserved." });

{
  const key = "704:3367:4294";
  const range = rangeByKey.get(key);
  const text = cp(contents.get(range.representation_id)).slice(range.char_start, range.char_end).join("");
  for (const match of text.matchAll(/DOC Nº ?\d+/gu)) add(key, match[0], "positive", "local_attachment", { attachment_number: match[0].match(/\d+/u)[0] });
  for (const match of text.matchAll(/1 folh(?:a)?/gu)) add(key, match[0], "negative", "sheet_count", null, { negative_reason: "Sheet-count expression, not an attachment or folio reference." }, [...text.slice(0, match.index).matchAll(new RegExp(match[0], "gu"))].length + 1);
  add(key, "1", "negative", "layout_page_indicator", null, { negative_reason: "Standalone layout/page indicator." });
  add(key, "2/129", "negative", "layout_page_indicator", null, { negative_reason: "Layout pagination indicator." });
}

add("5063:117381:117626", "01663", "ambiguous", "unclassified_reference_candidate", { identifier: "01663" }, { ambiguity: "Possible unit code or P.V. identifier; flattened table does not establish the column relationship.", remaining_verification: ["original_pdf"] });
add("5063:117381:117626", "1", "ambiguous", "unclassified_reference_candidate", { identifier: "1" }, { ambiguity: "Unresolved table-field value in damaged extraction.", remaining_verification: ["original_pdf"] }, 2);
add("5063:117381:117626", "14429", "ambiguous", "external_official_record_candidate", { identifier: "14429" }, { ambiguity: "Near dossier justice, but damaged column order prevents confident association.", remaining_verification: ["original_pdf"] });
add("5063:117381:117626", "2020", "negative", "year_or_date", null, { negative_reason: "Year/date value, with association to Année requiring original-page verification.", remaining_verification: ["original_pdf"] });
add("5063:117381:117626", "4", "positive", "local_attachment", { attachment_number: "4", source_label: "Nmr piéce" }, { source_context_association: "Nmr piéce", transcription_preserved: true }, 3);
add("5063:117381:117626", "1  /  1", "negative", "pagination_indicator", null, { negative_reason: "Nº feuillet pagination indicator, not a physical court-file folio." });

add("4528:7315:7495", "11-Nor-9-carboxi-D9-tetrahidrocanabinol", "negative", "chemical_analyte_designation", null, { negative_reason: "Embedded numbers form one atomic analyte name." });
add("4528:7315:7495", "4.3ng/mL", "negative", "measurement", null, { negative_reason: "Concentration measurement, not a reference." });
add("3887:12625:12646", "Anexo nº 6", "positive", "local_attachment", { attachment_number: "6" }, { association_group: "r10-pair", association_evidence: "source_stated_hyphen", relationship_type: "unresolved" });
add("3887:12625:12646", "DOCNº19", "positive", "local_attachment", { attachment_number: "19" }, { association_group: "r10-pair", association_evidence: "source_stated_hyphen", relationship_type: "unresolved" });
add("4964:42434:42998", "fls. 1329", "positive", "physical_folio", { folio: "1329" });

add("6125:45171:46358", "Symptom Checklist 90 - Revised", "negative", "assessment_name", null, { negative_reason: "The number is part of an assessment title." });
add("6125:45171:46358", "3º Versão", "negative", "version_designation", null, { negative_reason: "Version designation, not a reference." });
add("6125:45171:46358", "3.", "negative", "structural_list_number", null, { negative_reason: "Structural list number." });
add("6125:45171:46358", "11-nor -9-Carboxi-D9 Tetrahidrocanibinol ( THC-COOL)", "negative", "chemical_analyte_designation", null, { negative_reason: "Embedded numbers form one atomic analyte name." });
add("6125:45171:46358", "4.", "negative", "structural_list_number", null, { negative_reason: "Structural list number." });
add("6125:45171:46358", "2020", "negative", "year_or_date", null, { negative_reason: "Year/date value, not a reference." });
add("6125:45171:46358", "ponto III.  deste requerimento", "negative", "out_of_scope_internal_structural_cross_reference", { section_label: "III" }, { negative_reason: "Genuinely referential but outside the frozen expansion protocol's positive families.", containing_object_context: "Requerimento", target_identity: null });

specs.sort((a, b) => selection.ranges.findIndex((r) => r.range_key === a.rangeKey) - selection.ranges.findIndex((r) => r.range_key === b.rangeKey) || a.charStart - b.charStart);

const annotations = specs.map((spec, index) => {
  const range = rangeByKey.get(spec.rangeKey);
  const chars = cp(contents.get(range.representation_id));
  const charEnd = spec.charStart + cp(spec.raw).length;
  if (chars.slice(spec.charStart, charEnd).join("") !== spec.raw) throw new Error(`Span mismatch ${spec.rangeKey} ${spec.charStart} ${spec.raw}`);
  const contextStart = Math.max(range.char_start, spec.charStart - 80);
  const contextEnd = Math.min(range.char_end, charEnd + 80);
  return {
    id: `expansion-text-v1-${String(index + 1).padStart(3, "0")}`,
    range_key: spec.rangeKey,
    representation_id: range.representation_id,
    char_start: spec.charStart,
    char_end: charEnd,
    raw_span: spec.raw,
    polarity: spec.polarity,
    classification: spec.classification,
    parsed_candidate: spec.parsedCandidate,
    normalized_candidate: null,
    target_resolution: "unresolved",
    target_identity: null,
    document_identity: null,
    binary_identity: null,
    source_evidence: spec.extra,
    bounded_context: { char_start: contextStart, char_end: contextEnd, text: chars.slice(contextStart, contextEnd).join("") },
    review_state: "human_reviewed",
    human_review: {
      session_id: "guided-reference-expansion-text-review-attila-test-1",
      reviewer_identity: "case_support_reviewer_attila_test_1",
      reviewed_at: null,
      reviewed_at_status: "unavailable_not_captured",
      decision: spec.polarity,
      rationale: spec.extra.negative_reason ?? spec.extra.ambiguity ?? "Confirmed from the exact extracted span and bounded source context under the frozen taxonomy.",
      remaining_verification: spec.extra.remaining_verification ?? []
    }
  };
});

const ranges = selection.ranges.map((range) => {
  const representation = representationById.get(range.representation_id);
  const chars = cp(contents.get(range.representation_id));
  const rangeText = chars.slice(range.char_start, range.char_end).join("");
  const ids = annotations.filter((a) => a.range_key === range.range_key).map((a) => a.id);
  return {
    ...range,
    representation: {
      id: representation.id,
      binary_sha256: representation.binary_sha256,
      kind: representation.kind,
      processor_key: representation.processor_key,
      processor_version: representation.processor_version,
      processor_configuration_identity: representation.processor_configuration_identity,
      content_sha256: representation.content_sha256
    },
    range_content_sha256: sha256(rangeText),
    completeness: {
      status: "exhaustive",
      candidate_definition: "Every in-scope positive reference, plausible confusable negative, and genuinely ambiguous reference-like span in the exact half-open range.",
      reviewer_attested_no_intentional_omissions: true,
      annotation_ids: ids
    }
  };
});

const counts = Object.fromEntries(["positive", "negative", "ambiguous"].map((polarity) => [polarity, annotations.filter((a) => a.polarity === polarity).length]));
if (annotations.length !== 131 || counts.positive !== 93 || counts.negative !== 35 || counts.ambiguous !== 3) throw new Error(`Unexpected totals ${JSON.stringify({ total: annotations.length, ...counts })}`);

const fixture = {
  schema_version: 1,
  fixture_id: "reference-extraction-expansion-text-v1",
  fixture_kind: "reviewed_exhaustive_text_span_evaluation",
  status: "reviewed_frozen",
  protocol_version: selection.protocol_version,
  selection_fixture: "text-selection.json",
  selection_fixture_sha256: sha256(await readFile(selectionPath, "utf8")),
  offset_contract: "zero-based Unicode code-point indexes with half-open [char_start, char_end) ranges",
  taxonomy_boundary: {
    positive_families: ["court_identifier", "local_attachment", "physical_folio", "external_register", "ecli", "eu_case_identifier", "french_rg", "french_portalis", "french_pourvoi"],
    internal_document_section_reference: "out_of_scope_negative",
    absent_families: ["french_rg", "french_portalis", "french_pourvoi", "portuguese_ecli", "french_ecli", "eu_case_identifier"],
    absent_family_evaluation_state: "not_evaluated"
  },
  review_sessions: [{
    session_id: "guided-reference-expansion-text-review-attila-test-1",
    reviewer_identity: "case_support_reviewer_attila_test_1",
    method: "interactive_guided_exhaustive_span_review",
    reviewed_at: null,
    reviewed_at_status: "unavailable_not_captured",
    scope: "All candidates and plausible confusable spans in the 12 exact ranges frozen by reference-expansion-v1.",
    reviewed_range_keys: selection.ranges.map((r) => r.range_key),
    reviewed_annotation_ids: annotations.map((a) => a.id),
    limitations: [
      "The exact review timestamp was not captured and is not inferred from conversation, filesystem, or commit timestamps.",
      "Completeness and future metrics apply only to these exact ranges and the frozen candidate definition.",
      "Ambiguous spans remain unresolved pending the recorded verification; no target, document, or binary identity is inferred."
    ]
  }],
  independent_verification_sessions: [{
    session_id: "independent-reference-expansion-text-review-v1",
    reviewer_identity: "codex_root_independent_fixture_review_v1",
    method: "independent_complete_range_semantic_audit",
    reviewed_at: null,
    reviewed_at_status: "unavailable_not_captured",
    scope: "Complete text of all 12 declared ranges compared with every guided-review decision under the frozen taxonomy and candidate definition.",
    decision: "candidate_completeness_confirmed",
    confirmed_range_keys: selection.ranges.map((range) => range.range_key),
    confirmed_annotation_ids: annotations.map((annotation) => annotation.id),
    findings: [],
    confirmation: {
      all_complete_range_texts_inspected: true,
      every_in_scope_positive_accounted_for: true,
      every_plausible_confusable_negative_accounted_for: true,
      every_genuinely_ambiguous_candidate_accounted_for: true,
      no_taxonomy_expansion_after_selection: true
    },
    limitations: [
      "The exact independent-review timestamp was not captured and is not inferred from conversation, filesystem, or commit timestamps.",
      "Completeness is confirmed only for the exact declared ranges and frozen taxonomy."
    ]
  }],
  summary: { ranges: ranges.length, annotations: annotations.length, ...counts },
  ranges,
  annotations,
  validation_requirements: [
    "Strict UTF-8 and JSON parsing",
    "Selection-fixture hash and unchanged frozen selection",
    "Live representation-content SHA-256",
    "Exact range-content SHA-256",
    "All 131 raw spans reconstructed at Unicode code-point offsets",
    "Non-overlapping spans within each range",
    "Every annotation inside its declared exhaustive range and bounded context",
    "Per-range completeness membership and totals 93 positive, 35 negative, 3 ambiguous",
    "Independent review of candidate completeness before status is changed to frozen"
  ]
};

await writeFile(outputPath, `${JSON.stringify(fixture, null, 2)}\n`, "utf8");
console.log(JSON.stringify(fixture.summary));
