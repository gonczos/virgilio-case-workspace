import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {connectReviewer} from './ptdocs-review.mjs';
import {LocalBinaryStore} from './binary-store.mjs';
import {getWorkspaceRoot} from './processing-common.mjs';

const [batch,outArg]=process.argv.slice(2);
if(!batch||!outArg)throw new Error('Usage: node app/ptdocs-package-snapshot.mjs <batch> <output-directory>');
const out=path.resolve(outArg),c=await connectReviewer();
await fs.mkdir(path.join(out,'texts'),{recursive:true});
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
try {
 const batchRow=(await c.query('SELECT * FROM ptdocs_review.import_batch WHERE id=$1',[batch])).rows[0];
 if(!batchRow)throw new Error('Unknown batch');
 const rows=(await c.query(`SELECT s.*,m.file_binary_id,m.bucket_document_id,m.method,m.evidence FROM ptdocs_review.source_row s JOIN ptdocs_review.row_match m ON m.source_row_id=s.id WHERE s.batch_id=$1 ORDER BY row_number`,[batch])).rows;
 const binaries=(await c.query('SELECT * FROM casework.file_binary ORDER BY id')).rows;
 const overrides=(await c.query(`SELECT file_binary_id,selected_representation_id FROM casework.document_representation_selection WHERE selection_purpose='consultation_default'`)).rows;
 const store=new LocalBinaryStore({workspaceRoot:getWorkspaceRoot()});const inventory=[];
 for(const b of binaries){
  await store.verify(b,{verifySha256:true});
  const reps=(await c.query(`SELECT dr.id,dr.processor_key,dr.processor_version,dr.metadata_json,COALESCE(sum(length(s.text_content)),0)::int AS text_length
   FROM casework.document_representation dr LEFT JOIN casework.document_segment s ON s.document_representation_id=dr.id WHERE dr.file_binary_id=$1 GROUP BY dr.id ORDER BY dr.id`,[b.id])).rows;
  const literal=reps.find(r=>r.processor_key==='pdf_literal_text'),ocr=reps.find(r=>r.processor_key==='docling'&&r.text_length>150);
  const override=overrides.find(r=>r.file_binary_id===b.id);
  const selected=override?reps.find(r=>r.id===override.selected_representation_id):(literal?.text_length>150?literal:ocr??literal);
  const record={binary_id:b.id,sha256:b.sha256,page_count:b.page_count,readability:b.machine_readability_status,explicit_selection:!!override,selected_representation_id:selected?.id??null,representations:[]};
  // Keep independent observations, never concatenate different extractor outputs.
  for(const rep of reps.filter(r=>r.id===selected?.id||r.id===literal?.id||r.id===ocr?.id)){
   const segments=(await c.query(`SELECT id,page_no,sequence_no,text_content,structural_path FROM casework.document_segment WHERE document_representation_id=$1 ORDER BY sequence_no`,[rep.id])).rows;
   const payload={...rep,binary_id:b.id,binary_sha256:b.sha256,segments};
   const data=JSON.stringify(payload);await fs.writeFile(path.join(out,'texts',rep.id+'.json'),data);
   record.representations.push({...rep,metadata_json:undefined,artifact:`texts/${rep.id}.json`,artifact_sha256:sha(data)});
  }
  inventory.push(record);
 }
 // Supplied files are external evidence. Resolve only inside the recorded read-only root.
 const sourceRoot=path.resolve(batchRow.manifest.source.source_root),files=[];
 for(const b of batchRow.manifest.binaries){
  const file=path.resolve(sourceRoot,b.relative_path);
  if(!file.startsWith(sourceRoot+path.sep))throw new Error('External path escapes source root');
  const data=await fs.readFile(file);if(sha(data)!==b.sha256)throw new Error('Changed external file: '+b.relative_path);
  files.push({...b,canonical_binary_id:binaries.find(x=>x.sha256===b.sha256)?.id??null});
 }
 for(const book of batchRow.manifest.source.workbooks)if(sha(await fs.readFile(path.join(sourceRoot,book.name)))!==book.sha256)throw new Error('Workbook changed');
 await fs.writeFile(path.join(out,'inventory.json'),JSON.stringify({batch_id:batch,source:batchRow.manifest.source,script_sha256:sha(await fs.readFile(new URL(import.meta.url))),rows,files,binaries:inventory},null,2));
 console.log(JSON.stringify({rows:rows.length,files:files.length,binaries:inventory.length,representations:inventory.reduce((n,x)=>n+x.representations.length,0)}));
}finally{await c.end();}
