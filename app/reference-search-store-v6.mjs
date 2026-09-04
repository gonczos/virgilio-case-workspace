import {
  extractLabelledReferences as extractV5,
  normalizeReferenceValue,
} from "./reference-search-store.mjs";

export const REFERENCE_EXTRACTOR_KEY = "app/reference-search-store-v6.mjs";
export const REFERENCE_EXTRACTOR_VERSION = "labelled-reference-v6";
export { normalizeReferenceValue };

function compactContext(text, start, end, radius = 90) {
  const points = [...text];
  return points.slice(Math.max(0, start - radius), Math.min(points.length, end + radius)).join("")
    .replace(/\s+/gu, " ").trim();
}

const codePointIndex = (source, utf16Index) => [...source.slice(0, utf16Index)].length;

function observation(source, { rawValue, rawLabel, role, ruleKey, start, end, provenance, metadata = {} }) {
  return {
    raw_value: rawValue,
    normalized_value: normalizeReferenceValue(rawValue),
    raw_label: rawLabel,
    role_hint: role,
    rule_key: ruleKey,
    label_provenance: provenance,
    char_start: start,
    char_end: end,
    context_text: compactContext(source, start, end),
    ...metadata,
  };
}

function addDirectMatches(source, output) {
  const generic = /\b(REF(?:ER[ÊE]NCIA)?\s*(?:N[.º°O]+)?|REF[.ªº]*)(?:\s*[:.]\s*|\s+)([A-Z0-9][A-Z0-9./_-]{4,})/giu;
  for (const match of source.matchAll(generic)) {
    const rawValue = match[2].replace(/[.,;:)]+$/gu, "");
    if (!/\d/u.test(rawValue)) continue;
    const rawLabel = match[1].trim();
    const start = codePointIndex(source, match.index + match[0].lastIndexOf(match[2]));
    output.push(observation(source, { rawValue, rawLabel, role: "labelled_reference", ruleKey: "reference-labelled-v4", start, end: start + rawValue.length,
      provenance: { kind: "direct", source_label: rawLabel, label_char_start: codePointIndex(source, match.index), label_char_end: codePointIndex(source, match.index + match[1].trimEnd().length) } }));
  }

  const qualified = /\b(REF[.ªº]*\s+CITIUS)\s*[:.]?\s*([0-9][0-9./_-]{4,})/giu;
  for (const match of source.matchAll(qualified)) {
    const rawLabel = match[1].trim();
    const rawValue = match[2].replace(/[.,;:)]+$/gu, "");
    const start = codePointIndex(source, match.index + match[0].lastIndexOf(match[2]));
    output.push(observation(source, { rawValue, rawLabel, role: "cited_reference", ruleKey: "reference-citius-qualified-v1", start, end: start + rawValue.length,
      provenance: { kind: "direct", source_label: rawLabel, label_char_start: codePointIndex(source, match.index), label_char_end: codePointIndex(source, match.index + match[1].trimEnd().length) } }));
  }

  const doc = /\b([Dd][Oo][Cc]\s*[Nn][.º°Oo]+\s*)(\d+(?:\s*(?:-\s*)?A)?)(?![\p{L}\p{N}])/gu;
  for (const match of source.matchAll(doc)) {
    const rawLabel = match[1].trim();
    const rawValue = match[0];
    const parsed = match[2].replace(/[\s-]+/gu, "");
    const start = codePointIndex(source, match.index);
    output.push(observation(source, { rawValue, rawLabel, role: "local_attachment_reference", ruleKey: "local-attachment-doc-v2", start, end: start + [...rawValue].length,
      provenance: { kind: "direct", source_label: rawLabel, label_char_start: start, label_char_end: codePointIndex(source, match.index + match[1].trimEnd().length) },
      metadata: { reference_family: "local_attachment", parsed_attachment_number: parsed, target_resolution: "unresolved", document_identity: "unresolved", binary_identity: "unresolved" } }));
  }
}

function addContinuations(source, output) {
  const folioCoordination = /\b(fls\.?\s*)(\d+(?:v\.)?)\s+(e)\s+(\d+v\.|\d+)(?![\p{L}\p{N}])/giu;
  for (const match of source.matchAll(folioCoordination)) {
    const rawLabel = match[1].trim(), rawValue = match[4];
    const start = codePointIndex(source, match.index + match[0].lastIndexOf(match[4]));
    const verso = /v\.$/iu.test(rawValue);
    output.push(observation(source, { rawValue, rawLabel, role: "physical_folio_reference", ruleKey: "physical-folio-coordination-v1", start, end: start + rawValue.length,
      provenance: { kind: "inherited_from_coordinated_expression", source_label: rawLabel, label_char_start: codePointIndex(source, match.index), label_char_end: codePointIndex(source, match.index + match[1].trimEnd().length), coordination_cue: match[3], preceding_value: match[2] },
      metadata: { reference_family: "physical_folio", parsed_folio: rawValue.replace(/v\.$/iu, ""), parsed_folio_side: verso ? "verso" : null, target_resolution: "unresolved", document_identity: "unresolved", binary_identity: "unresolved" } }));
  }

  const folioRange = /\b(fls\.?\s*)(\d+)\s*(\/)\s*(\d+)\b/giu;
  for (const match of source.matchAll(folioRange)) {
    const rawLabel = match[1].trim(), rawValue = match[4];
    const start = codePointIndex(source, match.index + match[0].lastIndexOf(match[4]));
    output.push(observation(source, { rawValue, rawLabel, role: "physical_folio_reference", ruleKey: "physical-folio-compact-range-v1", start, end: start + rawValue.length,
      provenance: { kind: "inherited_from_range_expression", source_label: rawLabel, label_char_start: codePointIndex(source, match.index), label_char_end: codePointIndex(source, match.index + match[1].trimEnd().length), range_cue: match[3], preceding_value: match[2] },
      metadata: { reference_family: "physical_folio", parsed_folio: rawValue, target_resolution: "unresolved", document_identity: "unresolved", binary_identity: "unresolved" } }));
  }

  const attachmentRange = /\b([Dd][Oo][Cc]\s*[Nn][.º°Oo]+\s*)(\d+)\s+(a)\s+(\d+)\b/gu;
  for (const match of source.matchAll(attachmentRange)) {
    const rawLabel = match[1].trim(), rawValue = match[4];
    const start = codePointIndex(source, match.index + match[0].lastIndexOf(match[4]));
    output.push(observation(source, { rawValue, rawLabel, role: "local_attachment_reference", ruleKey: "local-attachment-range-v1", start, end: start + rawValue.length,
      provenance: { kind: "inherited_from_range_expression", source_label: rawLabel, label_char_start: codePointIndex(source, match.index), label_char_end: codePointIndex(source, match.index + match[1].trimEnd().length), range_cue: match[3], preceding_value: match[2] },
      metadata: { reference_family: "local_attachment", parsed_attachment_number: rawValue, target_resolution: "unresolved", document_identity: "unresolved", binary_identity: "unresolved" } }));
  }
}

export function extractLabelledReferences(text) {
  const source = String(text ?? "");
  const retained = extractV5(source).filter((item) => item.rule_key !== "reference-labelled-v3" && item.rule_key !== "local-attachment-doc-v1").map((item) => ({ ...item,
    char_start: codePointIndex(source, item.char_start), char_end: codePointIndex(source, item.char_end),
    label_provenance: { ...item.label_provenance, label_char_start: codePointIndex(source, item.label_provenance.label_char_start), label_char_end: codePointIndex(source, item.label_provenance.label_char_end) },
  }));
  const additions = [];
  addDirectMatches(source, additions);
  addContinuations(source, additions);
  const seen = new Set();
  return [...retained, ...additions]
    .sort((a, b) => a.char_start - b.char_start || a.char_end - b.char_end || a.rule_key.localeCompare(b.rule_key))
    .filter((item) => { const key = `${item.char_start}:${item.char_end}:${item.normalized_value}`; if (seen.has(key)) return false; seen.add(key); return true; });
}
