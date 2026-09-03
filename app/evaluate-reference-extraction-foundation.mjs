import crypto from "node:crypto";
import fs from "node:fs/promises";
import { pathToFileURL } from "node:url";
import {
  extractLabelledReferences,
  REFERENCE_EXTRACTOR_KEY,
  REFERENCE_EXTRACTOR_VERSION,
} from "./reference-search-store.mjs";

export const DEFAULT_FIXTURE = "docs/evaluation/reference-extraction-foundation-fixture/annotations.json";
export const DEFAULT_SCOPE = "representation-6038-chronological-entries-a-through-n-v1";
export const DEFAULT_OUTPUT = "docs/evaluation/reference-extraction-foundation-deterministic-v4.json";

const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");
const overlaps = (left, right) => left.char_start < right.char_end && right.char_start < left.char_end;

export function evaluatePredictions({ predictions, annotations }) {
  const positives = annotations.filter((item) => item.polarity === "positive");
  const negatives = annotations.filter((item) => item.polarity === "negative");
  const predictionResults = predictions.map((prediction) => {
    const exact = positives.find((gold) => gold.char_start === prediction.char_start && gold.char_end === prediction.char_end);
    const partial = exact ? null : positives.find((gold) => overlaps(gold, prediction));
    const negativeOverlaps = negatives.filter((gold) => overlaps(gold, prediction)).map((gold) => gold.id);
    return {
      ...prediction,
      outcome: exact ? "exact" : partial ? "partial_or_overlapping" : "spurious",
      matched_annotation_id: exact?.id ?? partial?.id ?? null,
      overlapped_negative_annotation_ids: negativeOverlaps,
    };
  });
  const goldResults = positives.map((gold) => {
    const exact = predictionResults.find((prediction) => prediction.char_start === gold.char_start && prediction.char_end === gold.char_end);
    const partial = exact ? null : predictionResults.find((prediction) => overlaps(gold, prediction));
    return {
      annotation_id: gold.id,
      family: gold.label === "local_attachment" ? "attachment" : "procedural",
      raw_span: gold.raw_span,
      char_start: gold.char_start,
      char_end: gold.char_end,
      outcome: exact ? "exact" : partial ? "partial_or_overlapping" : "missed",
      prediction_index: exact ? predictionResults.indexOf(exact) : partial ? predictionResults.indexOf(partial) : null,
    };
  });
  const counts = (family) => {
    const rows = family ? goldResults.filter((row) => row.family === family) : goldResults;
    const exact = rows.filter((row) => row.outcome === "exact").length;
    const partial = rows.filter((row) => row.outcome === "partial_or_overlapping").length;
    const missed = rows.filter((row) => row.outcome === "missed").length;
    return { gold_positive_count: rows.length, exact, partial_or_overlapping: partial, missed, recall: rows.length ? (exact + partial) / rows.length : null, exact_span_recall: rows.length ? exact / rows.length : null };
  };
  return {
    summary: {
      overall: counts(),
      procedural: counts("procedural"),
      attachment: counts("attachment"),
      prediction_count: predictionResults.length,
      spurious_prediction_count: predictionResults.filter((row) => row.outcome === "spurious").length,
      predictions_overlapping_date_negatives: predictionResults.filter((row) => row.overlapped_negative_annotation_ids.length).length,
      reviewed_date_negative_count: negatives.length,
    },
    gold_positive_results: goldResults,
    predictions: predictionResults,
  };
}

function parseArgs(argv) {
  const options = { fixture: DEFAULT_FIXTURE, scope: DEFAULT_SCOPE, output: DEFAULT_OUTPUT, apiBase: "http://localhost:8091" };
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    if (key === "--fixture") options.fixture = argv[++index];
    else if (key === "--scope") options.scope = argv[++index];
    else if (key === "--output") options.output = argv[++index];
    else if (key === "--api-base") options.apiBase = argv[++index];
    else throw new Error(`Unknown argument: ${key}`);
  }
  return options;
}

export async function runBaseline(options) {
  const fixtureBytes = await fs.readFile(options.fixture);
  const fixture = JSON.parse(fixtureBytes.toString("utf8"));
  const scope = fixture.exhaustive_evaluation_scopes.find((item) => item.scope_id === options.scope);
  if (!scope) throw new Error(`Unknown exhaustive scope: ${options.scope}`);
  const representation = fixture.representations.find((item) => item.representation_id === scope.representation_id);
  const response = await fetch(`${options.apiBase}/api/consultation/representations/${scope.representation_id}/content?format=text`);
  if (!response.ok) throw new Error(`Representation request failed: HTTP ${response.status}`);
  const content = await response.text();
  const contentHash = sha256(Buffer.from(content, "utf8"));
  if (contentHash !== representation.representation_content_sha256) throw new Error(`Representation SHA-256 mismatch: ${contentHash}`);
  const annotationsById = new Map(fixture.annotations.map((item) => [item.id, item]));
  const annotations = scope.annotation_ids.map((id) => annotationsById.get(id));
  if (annotations.some((item) => !item)) throw new Error("Scope names an unknown annotation");
  const section = [...content].slice(scope.char_start, scope.char_end).join("");
  const predictions = extractLabelledReferences(section).map((item) => ({
    ...item,
    char_start: item.char_start + scope.char_start,
    char_end: item.char_end + scope.char_start,
  }));
  const comparison = evaluatePredictions({ predictions, annotations });
  const result = {
    schema_version: 1,
    evaluation_kind: "frozen_deterministic_reference_extraction_baseline",
    generated_at: new Date().toISOString(),
    reproducible_command: "npm run reference:evaluate-foundation",
    fixture: { path: options.fixture.replaceAll("\\", "/"), sha256: sha256(fixtureBytes), scope_id: scope.scope_id },
    input: {
      representation_id: scope.representation_id,
      representation_content_sha256: contentHash,
      char_start: scope.char_start,
      char_end: scope.char_end,
      offset_unit: scope.unit,
      range: scope.range,
    },
    extractor: {
      key: REFERENCE_EXTRACTOR_KEY,
      version: REFERENCE_EXTRACTOR_VERSION,
      configuration_kind: "built_in_static_patterns_no_external_configuration",
      function_source_sha256: sha256(extractLabelledReferences.toString()),
    },
    ...comparison,
  };
  await fs.writeFile(options.output, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  return result;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const options = parseArgs(process.argv.slice(2));
  const result = await runBaseline(options);
  console.log(JSON.stringify(result.summary, null, 2));
}