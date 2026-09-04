import fs from "node:fs/promises";
import { withClient } from "./processing-common.mjs";
import { lookupRecordedReferences } from "./reference-observation-api.mjs";

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
  const samples=[];
  for(const request of requests){const response=await lookupRecordedReferences(client,request.value,{scope:"full",lifecycle:"include_history",limit:100,offset:0});const observations=response.observations.filter((item)=>item.provenance.extraction?.observation_identity_version==="reference-text-observation-identity-v1"&&item.provenance.extraction?.fixture_scope==="frozen-v5-expansion-and-foundation"&&item.provenance.extraction?.rule_key===request.rule);if(!observations.length)throw new Error(`Missing API sample ${request.case}`);samples.push({case:request.case,sample_scope:"canonical_frozen_v5_fixture_observations_only",request:{endpoint:"GET /api/consultation/references/lookup",value:request.value,scope:"full",lifecycle:"include_history",limit:100,offset:0},result_state:response.result_state,coverage:response.coverage,observations});}
  const reviewedHistory=await client.query(`SELECT COUNT(*)::int AS count FROM casework.reference_observation ro JOIN casework.reference_observation_review review ON review.reference_observation_id=ro.id WHERE ro.observed_in_kind='segment' AND ro.lifecycle_state<>'current'`);
  const artifact={schema_version:1,kind:"labelled_reference_v5_ingestion_read_only_api_samples",generated_at:new Date().toISOString(),samples,blocked_samples:reviewedHistory.rows[0].count===0?[{case:"current_vs_retained_reviewed_history",state:"blocked_no_authentic_source_row",reason:"The live database contains no reviewed historical segment observation. The lifecycle/review-preservation path is validated transactionally and rolled back; no sample is fabricated."}]:[]};await fs.writeFile(OUTPUT,`${JSON.stringify(artifact,null,2)}\n`,`utf8`);console.log(JSON.stringify({output:OUTPUT,samples:samples.length,observations:samples.reduce((n,x)=>n+x.observations.length,0),blocked_samples:artifact.blocked_samples.length},null,2));
});
