import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {createDbClient,loadDotEnv,getWorkspaceRoot} from './processing-common.mjs';
import {sourceTimeFromLabel} from './import-execution.mjs';

const [snapshotPath,reportPath]=process.argv.slice(2);
assert(snapshotPath && reportPath,'Usage: node app/citius-html-import.mjs <snapshot.json> <report.json>');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const bytes=await fs.readFile(snapshotPath); const snapshot=JSON.parse(bytes);
for(const r of snapshot.items) {const raw=Buffer.from(r.raw_base64,'base64');assert.equal(hash(raw),r.sha256);assert.equal(raw.length,r.size);}
loadDotEnv(path.join(getWorkspaceRoot(),'.env'));
// Create after loading configuration; never print connection parameters.
const db=createDbClient('citius-saved-html-provenance');
const report={snapshot_sha256:hash(bytes),extractor_sha256:snapshot.extractor_sha256,loader_sha256:hash(await fs.readFile(fileURLToPath(import.meta.url))),
  counts:snapshot.counts,comparisons:[],unmatched:[],unmodeled_attributes:[],coverage:{},scope:'Saved multicase HTML capture only; not a live-site completeness claim'};
const norm=v=>v===null||v===undefined||v==='null'||v==='undefined'?'':String(v).trim();
const numeric=v=>norm(v).replaceAll('.','');
await db.connect();
let executionId; let committed=false;
try {
  executionId=(await db.query(`INSERT INTO casework.import_execution(importer_key,importer_version,input_sha256,source_label,status)
    VALUES('citius-html-import',$1,$2,$3,'running') RETURNING id`,[report.loader_sha256,report.snapshot_sha256,snapshot.source_label])).rows[0].id;
  report.import_execution_id=executionId;
  await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ');
  await db.query('SELECT pg_advisory_xact_lock(hashtext($1))',['citius-html:'+snapshot.manifest_sha256]);
  const cases=(await db.query("SELECT *,data_autuacao::text AS data_autuacao,data_decisao::text AS data_decisao FROM casework.case_file WHERE source_system='tribunais_org_pt'")).rows;
  const buckets=(await db.query("SELECT *,bucket_date::text AS bucket_date FROM casework.bucket WHERE source_system='tribunais_org_pt'")).rows;
  const docs=(await db.query("SELECT d.*,d.document_date::text AS document_date,bd.id AS occurrence_id,bd.bucket_id AS internal_bucket_id FROM casework.document d JOIN casework.bucket_document bd ON bd.document_id=d.id WHERE d.source_system='tribunais_org_pt'")).rows;
  const covered={case:new Set(),bucket:new Set(),document:new Set()}; const links=[];
  function compare(r,target,field,value) {
    const a=norm(value),b=norm(target[field]);
    report.comparisons.push({path:r.path,source_sha256:r.sha256,target_id:target.id,kind:r.kind,field,observed_raw:value??null,current:target[field]??null,
      assessment:a===b?'equal':!b&&a?'omitted_in_current':!a&&b?'source_empty_current_populated':'different'});
  }
  for(const r of snapshot.items) {
    if(r.kind==='artifact')continue;
    assert.equal(r.rows.length,1,`Unexpected row structure: ${r.path}`);
    const row=r.rows[0],attrs=row.attributes,ca=r.context.case;
    const cf=cases.filter(x=>x.processo===ca?.['data-processo'] && x.idprocesso===ca?.['data-idprocesso']);
    let targets=[];let type;const used=new Set();
    if(r.kind==='case_row'){targets=cf;type='case_file_id';}
    else if(cf.length===1){
      const bs=buckets.filter(x=>x.case_file_id===cf[0].id && x.bucket_id===r.context.bucket?.['data-proc']);
      if(r.kind==='bucket_row'){targets=bs;type='bucket_id';}
      else if(bs.length===1){targets=docs.filter(x=>x.internal_bucket_id===bs[0].id&&x.document_procinfo===attrs['data-procinfo']);type='document_id';}
    }
    if(targets.length!==1){report.unmatched.push({path:r.path,kind:r.kind,candidate_ids:targets.map(x=>x.id)});continue;}
    const t=targets[0];links.push({path:r.path,type,id:t.id});
    if(r.kind==='case_row'){
      covered.case.add(t.id);
      for(const [attr,field] of Object.entries({'data-processo':'processo','data-idprocesso':'idprocesso','data-especie':'especie','data-estadoprocesso':'estado','data-dataautuacao':'data_autuacao','data-datadecisao':'data_decisao'})){used.add(attr);compare(r,t,field,attrs[attr]);}
    } else if(r.kind==='bucket_row'){
      covered.bucket.add(t.id);used.add('data-proc');compare(r,t,'bucket_id',attrs['data-proc']);
      for(const [i,field] of ['bucket_date','designation','presenter','reference_number','displayed_bucket_size_bytes'].entries())compare(r,t,field,i===4?numeric(row.cells[i]):row.cells[i]);
    } else {
      covered.document.add(t.occurrence_id);used.add('data-procinfo');used.add('data-tipoconteudo');
      compare(r,t,'document_procinfo',attrs['data-procinfo']);compare(r,t,'document_type_from_attr',attrs['data-tipoconteudo']);
      for(const [i,field] of ['document_date','document_name','document_type','claimed_size_bytes'].entries())compare(r,t,field,i===3?numeric(row.cells[i]):row.cells[i]);
      compare(r,t,'document_anchor_title',row.links.find(a=>a.class?.split(/\s+/).includes('downloadDocument'))?.title);
    }
    for(const [attribute,value] of Object.entries(attrs))if(!used.has(attribute)&&attribute.startsWith('data-'))report.unmodeled_attributes.push({path:r.path,attribute,value,note:'Not compared to a normalized field by this mapper; may exist in older provenance or another entity'});
  }
  report.coverage={cases:covered.case.size,buckets:covered.bucket.size,document_occurrences:covered.document.size,
    current_cases_not_in_capture:cases.filter(x=>!covered.case.has(x.id)).map(x=>x.id),
    current_buckets_not_in_capture:buckets.filter(x=>!covered.bucket.has(x.id)).map(x=>x.id),
    current_occurrences_not_in_capture:docs.filter(x=>!covered.document.has(x.occurrence_id)).map(x=>x.occurrence_id)};
  report.summary={};for(const r of report.comparisons){const k=r.kind+':'+r.field+':'+r.assessment;report.summary[k]=(report.summary[k]??0)+1;}
  const key='saved-html:'+snapshot.manifest_sha256;
  let cap=(await db.query("SELECT id,metadata_json FROM casework.source_capture WHERE capture_kind='manual_source_capture' AND source_system='tribunais_org_pt' AND capture_key=$1",[key])).rows[0];
  if(cap){assert.equal(cap.metadata_json.snapshot_sha256,report.snapshot_sha256,'Same capture with changed parsing; use a deliberate new processor snapshot identity');report.reused=true;}
  else {
    const time=sourceTimeFromLabel(snapshot.source_label);
    cap=(await db.query(`INSERT INTO casework.source_capture(source_system,capture_kind,capture_key,external_source_label,captured_at,capture_time_basis,source_locator,metadata_json)
      VALUES('tribunais_org_pt','manual_source_capture',$1,$2,$4,$5,$2,$3) RETURNING id`,[key,snapshot.source_label,JSON.stringify({snapshot_sha256:report.snapshot_sha256,extractor_sha256:report.extractor_sha256,loader_sha256:report.loader_sha256,
        captured_at_semantics:'Source run start inferred from label when available; not verified per-row capture time',source_time_evidence:snapshot.source_label,order_policy:snapshot.order_policy}),time.started_at,time.basis])).rows[0];
    const bypath=new Map(links.map(x=>[x.path,x]));
    for(const r of snapshot.items){
      // Individual raw rows use package_artifact: do not mislabel them as deduplicated occurrence groups.
      const kind=['case_row','bucket_row'].includes(r.kind)?r.kind:'package_artifact';
      const attrs=r.rows[0]?.attributes??{};
      const id=(await db.query(`INSERT INTO casework.source_observation(source_capture_id,observation_kind,observation_key,source_native_id,parent_source_native_id,source_path,payload_json)
        VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id`,[cap.id,kind,r.path,attrs['data-procinfo']??attrs['data-proc']??attrs['data-idprocesso']??null,
        r.context.bucket?.['data-proc']??r.context.case?.['data-idprocesso']??null,r.path,JSON.stringify(r)])).rows[0].id;
      const link=bypath.get(r.path);
      if(link)await db.query(`INSERT INTO casework.source_observation_link(source_observation_id,${link.type},mapper_key,mapper_version) VALUES($1,$2,'citius-html-exact-source-keys',$3)`,[id,link.id,report.loader_sha256]);
    }
    await db.query(`INSERT INTO casework.source_observation(source_capture_id,observation_kind,observation_key,source_path,payload_json)
      VALUES($1,'package_artifact','coverage-report','derived/coverage-report.json',$2)`,[cap.id,JSON.stringify(report)]);
  }
  report.capture_id=cap.id;
  const stored=(await db.query('SELECT payload_json FROM casework.source_observation WHERE source_capture_id=$1 AND observation_key<>$2',[cap.id,'coverage-report'])).rows;
  assert.equal(stored.length,snapshot.items.length);
  for(const {payload_json:r} of stored)assert.equal(hash(Buffer.from(r.raw_base64,'base64')),r.sha256);
  assert.equal(Number((await db.query('SELECT count(*) FROM casework.source_observation_link l JOIN casework.source_observation o ON o.id=l.source_observation_id WHERE o.source_capture_id=$1',[cap.id])).rows[0].count),links.length);
  report.persisted_html_hashes_verified=stored.length;report.links=links.length;
  await db.query(`UPDATE casework.import_execution SET source_capture_id=$2,status='succeeded',finished_at=clock_timestamp(),reused_capture=$3,counts_json=$4 WHERE id=$1`,
    [executionId,cap.id,report.reused??false,JSON.stringify({html_artifacts:stored.length,links:links.length,coverage:report.coverage})]);
  await db.query('COMMIT');
  committed=true;
  await fs.mkdir(path.dirname(reportPath),{recursive:true});await fs.writeFile(reportPath,JSON.stringify(report,null,2));
  console.log(JSON.stringify({capture_id:cap.id,reused:report.reused??false,coverage:report.coverage,unmatched:report.unmatched.length,links:links.length,summary:report.summary}));
}catch(e){if(!committed){await db.query('ROLLBACK');if(executionId)await db.query("UPDATE casework.import_execution SET status='failed',finished_at=clock_timestamp(),error_json=$2 WHERE id=$1",[executionId,JSON.stringify({code:e.code??'IMPORT_ERROR',name:e.name,note:'Import transaction rolled back; inspect local error output for details'})]);}throw e;}finally{await db.end();}
