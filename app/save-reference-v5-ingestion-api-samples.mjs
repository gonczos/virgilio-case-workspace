import fs from "node:fs/promises";
import crypto from "node:crypto";
import { withClient } from "./processing-common.mjs";
import { lookupRecordedReferences } from "./reference-observation-api.mjs";
import { ingestV5Observations } from "./reference-v5-ingestion.mjs";

const OUTPUT="docs/evaluation/reference-extraction-expansion-v1/labelled-reference-v5-ingestion-api-samples.json";
const requests=[
  {case:"direct_attachment",value:"Anexo nº 13",rule:"local-attachment-anexo-v1"},
  {case:"physical_folio_reused_binary",value:"fls.490",rule:"physical-folio-fls-v1"},
  {case:"register_colon",value:"Registo: 702380056723040",rule:"external-register-colon-v1"},
  {case:"register_numbered",value:"Registo n.° 1684/2020",rule:"external-register-numbered-v1"},
  {case:"damaged_french_inherited_label",value:"4",rule:"local-attachment-french-damaged-piece-v1"},
  {case:"coordinated_procedural",value:"122178618",rule:"procedural-coordination-respectivamente-v1"},
];
await withClient("reference-v5-api-samples",async(client)=>{
  const sequenceState=async()=>{
    const result=await client.query(`SELECT 'reference_observation_id_seq' AS sequence_name,last_value::text,is_called FROM casework.reference_observation_id_seq UNION ALL SELECT 'reference_observation_lifecycle_event_id_seq',last_value::text,is_called FROM casework.reference_observation_lifecycle_event_id_seq ORDER BY sequence_name`);
    return result.rows;
  };
  const samples=[];
  for(const request of requests){const response=await lookupRecordedReferences(client,request.value,{scope:"full",lifecycle:"include_history",limit:100,offset:0});const observations=response.observations.filter((item)=>item.provenance.extraction?.observation_identity_version==="reference-text-observation-identity-v1"&&item.provenance.extraction?.fixture_scope==="frozen-v5-expansion-and-foundation"&&item.provenance.extraction?.rule_key===request.rule);if(!observations.length)throw new Error(`Missing API sample ${request.case}`);samples.push({case:request.case,sample_scope:"canonical_frozen_v5_fixture_observations_only",request:{endpoint:"GET /api/consultation/references/lookup",value:request.value,scope:"full",lifecycle:"include_history",limit:100,offset:0},result_state:response.result_state,coverage:response.coverage,observations});}
  let lifecycleSample;
  const canonical=(await client.query(`SELECT * FROM casework.reference_observation WHERE lifecycle_state='current' AND metadata_json->>'observation_identity_version'='reference-text-observation-identity-v1' AND metadata_json->>'fixture_scope'='frozen-v5-expansion-and-foundation' AND metadata_json->>'extractor_rule_key' IN ('reference-labelled-v3','cited-reference-labelled-v3','procedural-coordination-respectivamente-v1') ORDER BY id LIMIT 1`)).rows[0];
  if(!canonical)throw new Error("No canonical procedural source span for lifecycle sample");
  const oldKey=crypto.createHash("sha256").update(`rolled-back-api-history:${canonical.observation_key}`).digest("hex");
  const sequencesBefore=await sequenceState();
  await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ");
  try {
    const old=(await client.query(`INSERT INTO casework.reference_observation(observation_key,raw_value,normalized_value,raw_label,observed_in_kind,file_binary_id,document_representation_id,document_segment_id,page_no,char_start,char_end,context_text,observer_key,observer_version,namespace_hint,role_hint,target_candidates_json,confidence,review_state,metadata_json,lifecycle_state) SELECT $1,raw_value,normalized_value,raw_label,observed_in_kind,file_binary_id,document_representation_id,document_segment_id,page_no,char_start,char_end,context_text,observer_key,'labelled-reference-v4',namespace_hint,role_hint,target_candidates_json,confidence,review_state,'{"transactional_validation_only":true}', 'current' FROM casework.reference_observation WHERE id=$2 RETURNING id`,[oldKey,canonical.id])).rows[0];
    await client.query(`INSERT INTO casework.reference_observation_review(reference_observation_id,namespace_hint,role_hint,target_candidates_json,resolution_state,confidence,review_state,review_note,reviewer_key,metadata_json) VALUES($1,NULL,'procedural_reference','[]','unresolved','high','reviewed','Transactional review-preservation validation','transactional-validation-reviewer','{"transactional_validation_only":true}')`,[old.id]);
    await ingestV5Observations(client,{write:true,manageTransaction:false});
    const response=await lookupRecordedReferences(client,canonical.raw_value,{scope:"full",lifecycle:"include_history",limit:100,offset:0});
    const observations=response.observations.filter((item)=>item.observation_key===canonical.observation_key||item.observation_key===oldKey);
    if(observations.length!==2)throw new Error("Transactional lifecycle API sample did not contain both observations");
    const historical=observations.find((item)=>item.observation_key===oldKey),current=observations.find((item)=>item.observation_key===canonical.observation_key);
    if(historical.lifecycle.state!=="superseded"||historical.lifecycle.current_observation_key!==canonical.observation_key||!historical.human_review||current.lifecycle.state!=="current")throw new Error("Transactional lifecycle API semantics failed");
    lifecycleSample={case:"older_procedural_and_current_vs_retained_reviewed_history",sample_scope:"transactionally_constructed_and_rolled_back_validation",durable_database_evidence:false,request:{endpoint:"GET /api/consultation/references/lookup",value:canonical.raw_value,scope:"full",lifecycle:"include_history",limit:100,offset:0},result_state:response.result_state,coverage:response.coverage,observations};
  } finally { await client.query("ROLLBACK"); }
  const persisted=(await client.query(`SELECT (SELECT COUNT(*)::int FROM casework.reference_observation WHERE observation_key=$1) observation_rows,(SELECT COUNT(*)::int FROM casework.reference_observation_review rv JOIN casework.reference_observation ro ON ro.id=rv.reference_observation_id WHERE ro.observation_key=$1) review_rows,(SELECT COUNT(*)::int FROM casework.reference_observation_lifecycle_event e JOIN casework.reference_observation ro ON ro.id=e.reference_observation_id WHERE ro.observation_key=$1) lifecycle_event_rows`,[oldKey])).rows[0];
  if(Object.values(persisted).some(Number))throw new Error("Transactional lifecycle sample left persisted row, review, or lifecycle-event residue");
  const sequencesAfter=await sequenceState();
  const sequenceAdvances=sequencesAfter.map((after)=>{const before=sequencesBefore.find((item)=>item.sequence_name===after.sequence_name);return{sequence_name:after.sequence_name,before,after,advanced:BigInt(after.last_value)>BigInt(before.last_value)||(!before.is_called&&after.is_called)};});
  const artifact={schema_version:2,kind:"labelled_reference_v5_ingestion_api_validation_samples",generated_at:new Date().toISOString(),generation:{state_affecting_validation:true,routine_read_only_operation:false,warning:"The transactional sample rolls back rows, reviews, and lifecycle events, but PostgreSQL sequence nextval effects are nontransactional. Sequence values are observed and are not restored with setval.",sequence_advances:sequenceAdvances},durable_samples:samples,transactional_rolled_back_samples:[lifecycleSample],validation:{persisted_transactional_sample_residue:persisted}};await fs.writeFile(OUTPUT,`${JSON.stringify(artifact,null,2)}\n`,`utf8`);console.log(JSON.stringify({output:OUTPUT,durable_samples:samples.length,durable_observations:samples.reduce((n,x)=>n+x.observations.length,0),transactional_rolled_back_samples:1,persisted_transactional_sample_residue:persisted,sequence_advances:sequenceAdvances},null,2));
});
