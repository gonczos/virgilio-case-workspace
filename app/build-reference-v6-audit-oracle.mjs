import crypto from "node:crypto";
import fs from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { withClient } from "./processing-common.mjs";

const SAMPLE = "docs/evaluation/reference-v5-corpus-rollout/audit-sample-v1.json";
const REVIEW = "docs/evaluation/reference-v5-corpus-rollout/audit-review-v1.json";
const OUTPUT = "docs/evaluation/reference-v5-corpus-rollout/v6-audit-oracle-v1.json";
const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");
const cpLength = (value) => [...value].length;

const namespaceNumbers = new Map([[23,"8656497"],[70,"8656497"],[78,"651161"],[106,"651161"]]);
const suffixCorrections = new Map([[4,"DOC Nº 14 A"],[102,"DOC Nº 13 -A"],[127,"Docnº18-A"],[133,"Doc nº5- A"]]);
const absent = new Set([17,32,36,46,56,77,114,129]);
const recalls = [
  { source_prediction_number:75, raw_value:"26v.", rule_key:"physical-folio-coordination-v1", parsed_candidate:{parsed_folio:"26",parsed_folio_side:"verso"}, cue:"e", provenance_kind:"inherited_from_coordinated_expression" },
  { source_prediction_number:116, raw_value:"7", rule_key:"local-attachment-range-v1", parsed_candidate:{parsed_attachment_number:"7"}, cue:"a", provenance_kind:"inherited_from_range_expression" },
  { source_prediction_number:141, raw_value:"838", rule_key:"physical-folio-coordination-v1", parsed_candidate:{parsed_folio:"838",parsed_folio_side:null}, cue:"e", provenance_kind:"inherited_from_coordinated_expression" },
  { source_prediction_number:142, raw_value:"1103", rule_key:"physical-folio-compact-range-v1", parsed_candidate:{parsed_folio:"1103"}, cue:"/", provenance_kind:"inherited_from_range_expression" },
];

const expectedRule = (item) => item.rule_key === "reference-labelled-v3" ? "reference-labelled-v4"
  : item.rule_key === "local-attachment-doc-v1" ? "local-attachment-doc-v2" : item.rule_key;

function nearest(text, raw, anchor) {
  const cp = [...text], needle = [...raw]; let best = -1, distance = Infinity;
  for (let index=0; index<=cp.length-needle.length; index++) if (cp.slice(index,index+needle.length).join("")===raw) {
    const d=Math.abs(index-anchor); if(d<distance){best=index;distance=d;}
  }
  if(best<0) throw new Error(`Missing oracle span ${JSON.stringify(raw)}`);
  return { char_start:best, char_end:best+needle.length };
}

export async function buildOracle(client) {
  const [sampleBytes,reviewBytes]=await Promise.all([fs.readFile(SAMPLE),fs.readFile(REVIEW)]);
  const sample=JSON.parse(sampleBytes),review=JSON.parse(reviewBytes);
  const ids=[...new Set([...sample.prediction_sample.map(x=>x.document_segment_id),...sample.no_prediction_segment_controls.map(x=>x.document_segment_id)])];
  const rows=(await client.query("SELECT id,text_content FROM casework.document_segment WHERE id = ANY($1::bigint[])",[ids])).rows;
  const texts=new Map(rows.map(x=>[Number(x.id),x.text_content]));
  if(texts.size!==ids.length) throw new Error("ORACLE_SOURCE_SEGMENT_MISSING");
  const cases=[];
  for(let index=0;index<sample.prediction_sample.length;index++){
    const number=index+1,item=sample.prediction_sample[index],decision=review.prediction_reviews[index],text=texts.get(item.document_segment_id);
    if(decision.observation_key!==item.observation_key) throw new Error("AUDIT_ORDER_MISMATCH");
    const base={source_prediction_number:number,source_observation_key:item.observation_key,document_representation_id:item.document_representation_id,document_segment_id:item.document_segment_id,representation_content_sha256:item.representation_content_sha256,segment_content_sha256:item.segment_content_sha256};
    if(absent.has(number)){cases.push({...base,disposition:"expected_absent",rejected_raw_value:item.raw_value,rejected_char_start:item.char_start,rejected_char_end:item.char_end});continue;}
    let raw=item.raw_value, span={char_start:item.char_start,char_end:item.char_end}, rule=expectedRule(item), parsed=item.parsed_candidate??{}, label=item.raw_label;
    if(namespaceNumbers.has(number)){
      raw=namespaceNumbers.get(number); span=nearest(text,raw,item.char_end); rule="reference-citius-qualified-v1";
      const labelStart=item.label_provenance.representation_label_char_start??item.label_provenance.label_char_start;
      label=[...text].slice(labelStart,span.char_start).join("").replace(/\s*:\s*$/u,"").trim();
      parsed={};
    } else if(suffixCorrections.has(number)) {
      raw=suffixCorrections.get(number); span=nearest(text,raw,item.char_start); rule="local-attachment-doc-v2";
      parsed={parsed_attachment_number:raw.match(/(\d+)\s*-?\s*A$/iu)?.[1]+"A"};
    }
    const replacement = namespaceNumbers.has(number) || suffixCorrections.has(number)
      ? { raw_value:item.raw_value, char_start:item.char_start, char_end:item.char_end, rule_key:item.rule_key }
      : undefined;
    cases.push({...base,disposition:decision.decision==="needs_original_pdf_verification"?"unscored_preserved":"expected_exact",...(replacement?{replaces:replacement}:{}),expected:{raw_value:raw,char_start:span.char_start,char_end:span.char_end,rule_key:rule,raw_label:label,parsed_candidate:parsed,target_resolution:"unresolved",relationship_resolution:"unresolved"}});
  }
  for(const recall of recalls){
    const source=sample.prediction_sample[recall.source_prediction_number-1],text=texts.get(source.document_segment_id),span=nearest(text,recall.raw_value,source.char_end);
    cases.push({source_prediction_number:recall.source_prediction_number,source_observation_key:source.observation_key,document_representation_id:source.document_representation_id,document_segment_id:source.document_segment_id,representation_content_sha256:source.representation_content_sha256,segment_content_sha256:source.segment_content_sha256,disposition:"expected_recall_addition",expected:{raw_value:recall.raw_value,...span,rule_key:recall.rule_key,raw_label:source.raw_label,parsed_candidate:recall.parsed_candidate,label_provenance_kind:recall.provenance_kind,coordination_cue:recall.cue,target_resolution:"unresolved",relationship_resolution:"unresolved"}});
  }
  const result={schema_version:1,oracle_id:"labelled-reference-v6-corpus-audit-oracle-v1",source:{sample_path:SAMPLE,sample_sha256:sha256(sampleBytes),review_path:REVIEW,review_sha256:sha256(reviewBytes)},extractor_version:"labelled-reference-v6",offset_unit:"unicode_code_points_half_open",cases,no_prediction_controls:sample.no_prediction_segment_controls.map(x=>({document_representation_id:x.representation_id,document_segment_id:x.document_segment_id,segment_content_sha256:x.segment_content_sha256,expected_supported_v6_predictions:0})),protected_fixture_controls:sample.protected_fixture_controls,summary:{source_predictions:180,expected_exact:cases.filter(x=>x.disposition==="expected_exact").length,expected_absent:cases.filter(x=>x.disposition==="expected_absent").length,expected_recall_additions:4,unscored_preserved:2,no_prediction_controls:30,protected_negatives:50,protected_ambiguous:3},limitations:["The two original-PDF-dependent cases remain unscored and unchanged.","Targets and relationships remain unresolved.","Unsupported families remain not evaluated."]};
  return result;
}

export async function main(){await withClient("reference-v6-oracle",async client=>{await client.query("BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");try{const result=await buildOracle(client);await fs.writeFile(OUTPUT,`${JSON.stringify(result,null,2)}\n`,"utf8");await client.query("COMMIT");console.log(JSON.stringify(result.summary,null,2));}catch(error){await client.query("ROLLBACK");throw error;}});}
if(import.meta.url===pathToFileURL(process.argv[1]).href) await main();
