import assert from "node:assert/strict";
import test from "node:test";
import crypto from "node:crypto";
import { withClient } from "../app/processing-common.mjs";
import { ingestV5Observations } from "../app/reference-v5-ingestion.mjs";
import { seedReferencePilot } from "../app/reference-index-pilot.mjs";

test("live supersession preserves a reviewed older row and rolls test state back",async()=>withClient("v5-integration-review",async(client)=>{
  await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ");
  try{
    const canonical=(await client.query(`SELECT * FROM casework.reference_observation WHERE metadata_json->>'observation_identity_version'='reference-text-observation-identity-v1' ORDER BY id LIMIT 1`)).rows[0];
    assert.ok(canonical);
    const oldKey=crypto.createHash("sha256").update(`integration-v4-${canonical.observation_key}`).digest("hex");
    const old=(await client.query(`INSERT INTO casework.reference_observation(observation_key,raw_value,normalized_value,raw_label,observed_in_kind,file_binary_id,document_representation_id,document_segment_id,page_no,char_start,char_end,context_text,observer_key,observer_version,namespace_hint,role_hint,target_candidates_json,confidence,review_state,metadata_json,lifecycle_state) SELECT $1,raw_value,normalized_value,raw_label,observed_in_kind,file_binary_id,document_representation_id,document_segment_id,page_no,char_start,char_end,context_text,observer_key,'labelled-reference-v4',namespace_hint,role_hint,target_candidates_json,confidence,review_state,'{}', 'current' FROM casework.reference_observation WHERE id=$2 RETURNING id`,[oldKey,canonical.id])).rows[0];
    await client.query(`INSERT INTO casework.reference_observation_review(reference_observation_id,namespace_hint,role_hint,target_candidates_json,resolution_state,confidence,review_state,review_note,reviewer_key,metadata_json) VALUES($1,'candidate','reviewed_role','[]','unresolved','medium','reviewed','preserve exactly','integration-reviewer','{"marker":"unchanged"}')`,[old.id]);
    const before=(await client.query("SELECT namespace_hint,role_hint,target_candidates_json,resolution_state,confidence,review_state,review_note,reviewer_key,metadata_json,created_at,updated_at FROM casework.reference_observation_review WHERE reference_observation_id=$1",[old.id])).rows[0];
    const result=await ingestV5Observations(client,{write:true,manageTransaction:false});
    assert.equal(result.committed.supersede,1);
    const after=(await client.query("SELECT namespace_hint,role_hint,target_candidates_json,resolution_state,confidence,review_state,review_note,reviewer_key,metadata_json,created_at,updated_at FROM casework.reference_observation_review WHERE reference_observation_id=$1",[old.id])).rows[0];
    assert.deepEqual(after,before);
    const lifecycle=(await client.query("SELECT lifecycle_state FROM casework.reference_observation WHERE id=$1",[old.id])).rows[0];
    assert.equal(lifecycle.lifecycle_state,"superseded");
    const event=(await client.query("SELECT transition_kind,related_reference_observation_id FROM casework.reference_observation_lifecycle_event WHERE reference_observation_id=$1 ORDER BY id DESC LIMIT 1",[old.id])).rows[0];
    assert.deepEqual(event,{transition_kind:"supersede",related_reference_observation_id:canonical.id});
    const current=(await client.query("SELECT COUNT(*)::int n FROM casework.reference_observation WHERE document_representation_id=$1 AND document_segment_id=$2 AND char_start=$3 AND char_end=$4 AND lifecycle_state='current'",[canonical.document_representation_id,canonical.document_segment_id,canonical.char_start,canonical.char_end])).rows[0].n;
    assert.equal(current,1);
  } finally { await client.query("ROLLBACK"); }
}));

test("live legacy pilot seeder rerun adds no v5 rows or lifecycle events",async()=>withClient("v5-integration-seeder",async(client)=>{
  await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ");
  try {
    const snapshot=async()=>{const r=await client.query(`SELECT jsonb_build_object('observations',COALESCE((SELECT jsonb_agg(to_jsonb(ro) ORDER BY ro.id) FROM casework.reference_observation ro WHERE ro.observer_key='app/reference-search-store.mjs' AND ro.observer_version='labelled-reference-v5'),'[]'),'reviews',COALESCE((SELECT jsonb_agg(to_jsonb(rv) ORDER BY rv.reference_observation_id) FROM casework.reference_observation_review rv JOIN casework.reference_observation ro ON ro.id=rv.reference_observation_id WHERE ro.observer_key='app/reference-search-store.mjs' AND ro.observer_version='labelled-reference-v5'),'[]'),'events',COALESCE((SELECT jsonb_agg(to_jsonb(e) ORDER BY e.id) FROM casework.reference_observation_lifecycle_event e JOIN casework.reference_observation ro ON ro.id=e.reference_observation_id WHERE ro.observer_key='app/reference-search-store.mjs' AND ro.observer_version='labelled-reference-v5'),'[]')) AS state`);return r.rows[0].state;};
    const before=await snapshot();await seedReferencePilot(client,{manageTransaction:false});const after=await snapshot();assert.deepEqual(after,before);
  } finally { await client.query("ROLLBACK"); }
}));
