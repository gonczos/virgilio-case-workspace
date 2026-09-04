import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { withClient } from "./processing-common.mjs";
import { lookupRecordedReferences } from "./reference-observation-api.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIR = path.join(ROOT, "docs", "evaluation", "reference-extraction-expansion-v1");
const FIXTURE_PATH = path.join(DIR, "metadata-reviewed-fixture-v1.json");
const MANIFEST_PATH = path.join(DIR, "manifest.json");
const OUTPUT_PATH = path.join(DIR, "metadata-baseline.json");
const VERSION = "reference-expansion-metadata-evaluator-v1";

const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");
const stable = (value) => JSON.stringify(value, null, 2) + "\n";
const scalar = (value) => value == null ? null : String(value);
const sorted = (values) => [...values].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));

function contextIdentity(value) {
  return {
    document_id: scalar(value.document_id),
    bucket_document_id: scalar(value.bucket_document_id),
    bucket_id: scalar(value.bucket_id),
    process_number: value.process_number ?? null,
    occurrence_reference: value.occurrence_reference ?? null,
    occurrence_date: value.occurrence_date ?? null,
    document_reference: value.document_reference ?? null,
    binary_sha256s: [...(value.binary_sha256s ?? [])].sort(),
  };
}


function containsExpectedContexts(observed, expected) {
  return expected.every((wanted) => observed.some((candidate) =>
    Object.entries(wanted).every(([key, value]) => {
      if (key === "binary_sha256s") {
        return value.every((sha) => candidate.binary_sha256s.includes(sha));
      }
      return value == null || candidate[key] === value;
    })));
}

function expectedLookupOrder(observations) {
  const originOrder = { court_metadata: 1, external_register: 2, document_text: 3 };
  return [...observations].sort((a, b) =>
    (originOrder[a.origin] ?? 4) - (originOrder[b.origin] ?? 4)
    || (a.direct_anchor.occurrence_date == null) - (b.direct_anchor.occurrence_date == null)
    || (a.direct_anchor.occurrence_date ?? "").localeCompare(b.direct_anchor.occurrence_date ?? "")
    || a.observation_key.localeCompare(b.observation_key));
}
async function evaluate(client, fixture, manifest) {
  const details = [];
  for (const entry of fixture.assertions) {
    const expected = entry.source_assertion;
    const dbResult = await client.query(`
      SELECT id, observation_key, source_assertion_key, raw_value, normalized_value,
             normalization_identity, observation_origin, source_field, identifier_type,
             lifecycle_state, case_file_id, bucket_id, document_id,
             to_char(anchored_occurrence_date, 'YYYY-MM-DD') AS anchored_occurrence_date,
             metadata_json
      FROM casework.reference_observation
      WHERE source_assertion_key = $1
      ORDER BY id
    `, [expected.source_assertion_key]);
    const currentRows = dbResult.rows.filter((row) => row.lifecycle_state === "current");
    const current = currentRows[0] ?? null;
    const rawLookup = await lookupRecordedReferences(client, expected.raw_value, {
      scope: "full", lifecycle: "include_history", limit: 100, offset: 0,
    });
    const normalizedLookup = await lookupRecordedReferences(client, expected.normalized_value, {
      scope: "full", lifecycle: "include_history", limit: 100, offset: 0,
    });
    const matching = rawLookup.observations.filter((item) =>
      item.origin === expected.origin
      && item.provenance.source_field === expected.source_field
      && scalar(item.direct_anchor.case_file_id) === scalar(expected.direct_anchor.case_file_id)
      && scalar(item.direct_anchor.bucket_id) === scalar(expected.direct_anchor.bucket_id)
      && scalar(item.direct_anchor.document_id) === scalar(expected.direct_anchor.document_id));
    const observed = matching.find((item) => item.lifecycle.state === "current") ?? null;
    const expectedContexts = expected.occurrence_contexts.map(contextIdentity);
    const observedContexts = (observed?.associated_contexts ?? []).map(contextIdentity);
    const expectedShas = [...new Set(expectedContexts.flatMap((item) => item.binary_sha256s))].sort();
    const observedShas = (observed?.associated_binaries ?? []).map((item) => item.sha256).sort();
    const currentEventsValid = observed?.lifecycle.state === "current"
      && observed.lifecycle.current_observation_key === observed.observation_key
      && observed.lifecycle.events.every((event) => event.to_state != null);
    const noFabricatedAction = expected.category !== "missing_file" || (
      observed?.associated_binaries.length === 0
      && observed.associated_contexts.every((item) => item.file_availability === "missing")
    );
    const checks = {
      one_current_row_for_source_assertion: currentRows.length === 1,
      raw_value_preserved: current?.raw_value === expected.raw_value && observed?.reference.raw_value === expected.raw_value,
      normalized_value_preserved: current?.normalized_value === expected.normalized_value && observed?.reference.normalized_value === expected.normalized_value,
      normalization_identity_preserved: current?.normalization_identity === expected.normalization_identity && observed?.provenance.normalization_identity === expected.normalization_identity,
      source_assertion_identity_preserved: current?.source_assertion_key === expected.source_assertion_key,
      source_origin_field_type_preserved: current?.observation_origin === expected.origin && current?.source_field === expected.source_field && current?.identifier_type === expected.identifier_type,
      direct_anchor_preserved: scalar(current?.case_file_id) === scalar(expected.direct_anchor.case_file_id)
        && scalar(current?.bucket_id) === scalar(expected.direct_anchor.bucket_id)
        && scalar(current?.document_id) === scalar(expected.direct_anchor.document_id)
        && current?.anchored_occurrence_date === expected.direct_anchor.anchored_occurrence_date,
      current_lifecycle_correct: Boolean(currentEventsValid),
      availability_state_preserved: observed?.binary_association_state === expected.binary_association_state,
      binary_sha256s_preserved: expectedShas.length > 0
        ? JSON.stringify(observedShas) === JSON.stringify(expectedShas)
        : observedShas.length === expected.available_file_count
          && observedShas.every((sha) => /^[0-9a-f]{64}$/u.test(sha)),
      expected_contexts_retrieved: containsExpectedContexts(observedContexts, expectedContexts),
      missing_file_has_no_fabricated_action: noFabricatedAction,
      raw_lookup_retrieves_assertion: observed != null,
      normalized_lookup_retrieves_assertion: normalizedLookup.observations.some((item) => item.observation_key === observed?.observation_key),
      raw_lookup_order_deterministic: JSON.stringify(rawLookup.observations.map((item) => item.observation_key))
        === JSON.stringify((await lookupRecordedReferences(client, expected.raw_value, { scope: "full", lifecycle: "include_history", limit: 100, offset: 0 })).observations.map((item) => item.observation_key)),
      raw_lookup_order_matches_contract: JSON.stringify(rawLookup.observations.map((item) => item.observation_key))
        === JSON.stringify(expectedLookupOrder(rawLookup.observations).map((item) => item.observation_key)),
    };
    details.push({
      assertion_id: entry.assertion_id,
      source_assertion_key: expected.source_assertion_key,
      category: expected.category,
      query: { raw_value: expected.raw_value, normalized_value: expected.normalized_value },
      expected_direct_anchor: expected.direct_anchor,
      observed: {
        observation_key: observed?.observation_key ?? null,
        direct_anchor: observed?.direct_anchor ?? null,
        matching_observations: matching.length,
        lifecycle_states: matching.map((item) => item.lifecycle.state),
        binary_association_state: observed?.binary_association_state ?? null,
        binary_sha256s: observedShas,
        context_count: observedContexts.length,
      },
      checks,
      passed: Object.values(checks).every(Boolean),
    });
  }

  const checkNames = Object.keys(details[0].checks);
  const metrics = Object.fromEntries(checkNames.map((name) => {
    const passed = details.filter((item) => item.checks[name]).length;
    return [name, { passed, total: details.length, rate: passed / details.length }];
  }));
  const normalizedGroups = Map.groupBy(fixture.assertions, (entry) => entry.source_assertion.normalized_value);
  const collisions = [...normalizedGroups.entries()].filter(([, entries]) =>
    new Set(entries.map((entry) => entry.source_assertion.raw_value)).size > 1);
  const output = {
    schema_version: 1,
    evaluation_id: "reference-extraction-expansion-v1-metadata-baseline",
    evaluation_kind: "metadata_preservation_retrieval",
    evaluator: { key: "app/evaluate-reference-expansion-metadata.mjs", version: VERSION },
    evaluation_time: null,
    evaluation_time_status: "omitted_for_deterministic_artifact",
    inputs: {
      manifest_commit: "45f72f5",
      manifest_sha256: sha256(await fs.readFile(MANIFEST_PATH)),
      fixture_path: "metadata-reviewed-fixture-v1.json",
      fixture_sha256: sha256(await fs.readFile(FIXTURE_PATH)),
      expected_fixture_sha256: manifest.artifacts["metadata-reviewed-fixture-v1.json"].sha256,
      database_access: "read_only_queries",
      lookup_contract: "lookupRecordedReferences(scope=full,lifecycle=include_history,limit=100,offset=0)",
    },
    summary: {
      assertions: details.length,
      passed: details.filter((item) => item.passed).length,
      failed: details.filter((item) => !item.passed).length,
      by_category: Object.fromEntries(["reused_binary", "missing_file", "ordinary_binary_linked"].map((category) => [category, {
        total: details.filter((item) => item.category === category).length,
        passed: details.filter((item) => item.category === category && item.passed).length,
      }])),
      normalization_collisions_in_sample: collisions.length,
      acceptance_gate_passed: details.every((item) => item.passed) && collisions.length === 0,
    },
    metrics,
    normalization_collisions: collisions.map(([normalized_value, entries]) => ({
      normalized_value, raw_values: [...new Set(entries.map((entry) => entry.source_assertion.raw_value))].sort(),
    })),
    assertions: details,
    limitations: [
      "This evaluates only the 24 assertions frozen in reference-expansion-v1.",
      "Raw and normalized query strings are identical for every sampled assertion; both lookup paths were still executed independently.",
      "Target resolution and semantic correctness are outside this preservation/retrieval evaluation.",
      "Text-span extraction metrics are intentionally excluded.",
    ],
  };
  return output;
}

const fixture = JSON.parse(await fs.readFile(FIXTURE_PATH, "utf8"));
const manifest = JSON.parse(await fs.readFile(MANIFEST_PATH, "utf8"));
if (sha256(await fs.readFile(FIXTURE_PATH)) !== manifest.artifacts["metadata-reviewed-fixture-v1.json"].sha256) {
  throw new Error("Frozen metadata fixture hash does not match manifest");
}
const output = await withClient("reference-expansion-metadata-evaluator-v1", (client) => evaluate(client, fixture, manifest));
await fs.writeFile(OUTPUT_PATH, stable(output), "utf8");
console.log(stable(output.summary));
