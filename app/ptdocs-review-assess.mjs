import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { connectReviewer, insertFindings } from './ptdocs-review.mjs';

const [batch,outArg]=process.argv.slice(2);
if(!batch||!outArg)throw new Error('Usage: node app/ptdocs-review-assess.mjs <batch-id> <output-directory>');
const out=path.resolve(outArg);await fs.mkdir(out,{recursive:true});
const save=(name,data)=>fs.writeFile(path.join(out,name),JSON.stringify(data,null,2));
const value=(r,col)=>r.cells[col]?.value??null;
const present=x=>x!==null&&x!==undefined&&x!=='';
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const c=await connectReviewer();
try {
  const rows=(await c.query(`SELECT s.*,m.file_binary_id,m.bucket_document_id,m.method AS match_method,m.evidence AS match_evidence,
      b.sha256,b.machine_readability_status,b.page_count FROM ptdocs_review.source_row s
      JOIN ptdocs_review.row_match m ON m.source_row_id=s.id LEFT JOIN casework.file_binary b ON b.id=m.file_binary_id
      WHERE s.batch_id=$1 ORDER BY s.row_number`,[batch])).rows;
  const header=(await c.query(`SELECT cells FROM ptdocs_review.source_row WHERE batch_id=$1 AND workbook='Documentation with Links.xlsx'
      AND sheet='Document Register' AND row_number=1`,[batch])).rows[0].cells;
  const columnNumber=s=>[...s].reduce((a,x)=>a*26+x.charCodeAt(0)-64,0);
  const inventory=Object.keys(header).filter(col=>columnNumber(col)>=22).map(col=>({column:col,label:header[col].value,
    populated_rows:rows.filter(r=>present(value(r,col))).length,
    unique_values:new Set(rows.map(r=>value(r,col)).filter(present)).size}));
  const findings=[];
  const emit=f=>findings.push({method:'deterministic consistency check v1',reviewer:'Codex',...f});
  const grouped=new Map();for(const r of rows.filter(r=>r.sha256)){if(!grouped.has(r.sha256))grouped.set(r.sha256,[]);grouped.get(r.sha256).push(r);}
  const conflicts=[];
  for(const [hash,group] of grouped) for(const col of ['AB','Y','AI','AJ','AK']) {
    const values=[...new Set(group.map(r=>value(r,col)).filter(present))];
    if(values.length<2)continue;
    const conflict={sha256:hash,column:col,label:header[col].value,values,rows:group.map(r=>r.row_number)};conflicts.push(conflict);
    for(const r of group.filter(r=>present(value(r,col)))) emit({row_number:r.row_number,column_key:col,
      check_kind:'same_binary_conflicting_values',external_value:value(r,col),assessment:'candidate',
      evidence:{...conflict,reason:'Same binary has distinct populated values. Context, multiple embedded acts, or spelling may explain this; not automatically an error.'}});
  }
  for(const r of rows.filter(r=>r.match_method!=='exact_occurrence_and_binary')) emit({row_number:r.row_number,
    check_kind:'identity_exception',assessment:'unresolved',evidence:{match_method:r.match_method,sha256:r.match_evidence.sha256,
      reason:'Occurrence identity, binary availability, and enrichment truth are separate questions.'}});
  const malformed=[];
  for(const r of rows)for(const col of ['AW']) if(present(value(r,col))&&!/^[a-f0-9]{64}$/i.test(value(r,col))) {
    malformed.push({row:r.row_number,column:col,value:value(r,col)});
    emit({row_number:r.row_number,column_key:col,external_value:value(r,col),check_kind:'hash_format',assessment:'candidate',evidence:{reason:'Value is not a single full SHA-256; may contain multiple claims or commentary.'}});
  }
  const errorCells=(await c.query(`SELECT s.workbook,s.sheet,s.row_number,e.key AS column_key,e.value->>'value' AS error
    FROM ptdocs_review.source_row s CROSS JOIN LATERAL jsonb_each(s.cells) e WHERE s.batch_id=$1 AND e.value->>'type'='e'`,[batch])).rows;
  emit({check_kind:'cached_formula_errors',assessment:'informational',evidence:{count:errorCells.length,errors:errorCells,
    limitation:'Only cached error cells checked; formula correctness and cache freshness not certified.'}});
  const families=['Notificação','Certidão','Requerimento','Folha de Submissão Citius','Despacho','Promoção','Ofício','Email','Ata','Acórdão'];
  const selected=[];const used=new Set();
  const conflictHashes=new Set(conflicts.filter(x=>x.column==='AB').map(x=>x.sha256));
  for(const family of families) {
    const pool=rows.filter(r=>value(r,'AB')===family&&r.match_method==='exact_occurrence_and_binary')
      .sort((a,b)=>sha('ptdocs-review-v1:'+a.sha256).localeCompare(sha('ptdocs-review-v1:'+b.sha256))||a.row_number-b.row_number);
    for(const [stratum,test] of [['classification_conflict',r=>conflictHashes.has(r.sha256)],
      ['image_or_mixed',r=>r.machine_readability_status!=='text_pdf'],
      ['flagged',r=>value(r,'GA')!=='Processed and reliable'],['reliable',r=>value(r,'GA')==='Processed and reliable']]) {
      const r=pool.find(r=>!used.has(r.sha256)&&test(r));if(r){selected.push({...r,sample_family:family,stratum});used.add(r.sha256);}
    }
    while(selected.filter(r=>r.sample_family===family).length<4){const r=pool.find(r=>!used.has(r.sha256));if(!r)break;selected.push({...r,sample_family:family,stratum:'deterministic_fill'});used.add(r.sha256);}
  }
  assert.equal(selected.length,40);assert.equal(used.size,40);
  const sample=[];
  for(let index=0;index<selected.length;index++) {
    const r=selected[index];
    const representations=(await c.query(`SELECT dr.*,COALESCE(sum(length(s.text_content)),0)::int AS text_length
      FROM casework.document_representation dr LEFT JOIN casework.document_segment s ON s.document_representation_id=dr.id
      WHERE dr.file_binary_id=$1 GROUP BY dr.id ORDER BY dr.id`,[r.file_binary_id])).rows;
    const override=(await c.query(`SELECT selected_representation_id FROM casework.document_representation_selection
      WHERE file_binary_id=$1 AND selection_purpose='consultation_default'`,[r.file_binary_id])).rows[0];
    const literal=representations.find(x=>x.processor_key==='pdf_literal_text');
    const preferred=override?representations.find(x=>x.id===override.selected_representation_id):null;
    const rep=preferred??(literal?.text_length>150?literal:representations.find(x=>x.processor_key==='docling'&&x.text_length>150))??literal;
    const segments=rep?(await c.query(`SELECT id,page_no,sequence_no,text_content,structural_path FROM casework.document_segment
      WHERE document_representation_id=$1 ORDER BY sequence_no`,[rep.id])).rows:[];
    const claims=Object.fromEntries(Object.entries(r.cells).filter(([col,v])=>columnNumber(col)>=22&&present(v.value))
      .map(([col,v])=>[col,{label:header[col]?.value,value:v.value,formula:v.formula}]));
    sample.push({sample_id:index+1,row_number:r.row_number,family:r.sample_family,stratum:r.stratum,
      sha256:r.sha256,file_binary_id:r.file_binary_id,bucket_document_id:r.bucket_document_id,
      readability:r.machine_readability_status,page_count:r.page_count,filename:value(r,'G'),claims,
      evidence:rep?{representation_id:rep.id,processor:rep.processor_key,version:rep.processor_version,
        metadata:rep.metadata_json,text_sha256:sha(segments.map(s=>s.text_content??'').join('\n')),segments}:null,
      representations:representations.map(x=>({id:x.id,processor:x.processor_key,version:x.processor_version,text_length:x.text_length,kind:x.representation_kind}))});
  }
  emit({check_kind:'sample_plan',assessment:'informational',evidence:{count:sample.length,selection:'Four unique binaries per ten major families, targeting conflicts, scans, flags, and reliable rows; deterministic hash order; not a random prevalence sample.',
    sample:sample.map(s=>({sample_id:s.sample_id,row:s.row_number,sha256:s.sha256,family:s.family,stratum:s.stratum}))}});
  await c.query('BEGIN');await insertFindings(c,batch,findings);await c.query('COMMIT');
  await save('field-inventory.json',inventory);await save('consistency-findings.json',findings);await save('same-binary-conflicts.json',conflicts);
  await save('sample.json',sample);
  console.log(JSON.stringify({batch_id:batch,rows:rows.length,populated_enrichment_fields:inventory.filter(x=>x.populated_rows).length,
    same_binary_conflict_groups:conflicts.length,conflicts_by_field:conflicts.reduce((a,x)=>(a[x.column]=(a[x.column]??0)+1,a),{}),malformed_hash_cells:malformed.length,
    formula_errors:errorCells.length,sample:sample.map(s=>({id:s.sample_id,row:s.row_number,family:s.family,readability:s.readability,pages:s.page_count,processor:s.evidence?.processor,chars:s.evidence?.segments.reduce((n,s)=>n+(s.text_content?.length??0),0)}))},null,2));
}finally{await c.end();}
