import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createDbClient, getWorkspaceRoot, loadDotEnv } from './processing-common.mjs';

const root=getWorkspaceRoot();
const hash=data=>crypto.createHash('sha256').update(data).digest('hex');
const read=async p=>JSON.parse(await fs.readFile(p,'utf8'));
export async function connectReviewer() {
  loadDotEnv(path.join(root,'.env'));
  const c=createDbClient('ptdocs-isolated-review');
  await c.connect();
  try {
  await c.query('SET ROLE ptdocs_reviewer');
  const unsafe=await c.query(`SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='casework' AND c.relkind IN ('r','p','v','m','f') AND
    (has_table_privilege(current_user,c.oid,'INSERT') OR has_table_privilege(current_user,c.oid,'UPDATE')
      OR has_table_privilege(current_user,c.oid,'DELETE') OR has_table_privilege(current_user,c.oid,'TRUNCATE'))`);
  assert.equal(unsafe.rowCount,0,'Reviewer has canonical write privileges');
  return c;
  } catch(error) { await c.end(); throw error; }
}
async function setup() {
  loadDotEnv(path.join(root,'.env'));
  const c=createDbClient('ptdocs-review-bootstrap'); await c.connect();
  try { await c.query('BEGIN'); await c.query(await fs.readFile(path.join(root,'db/migrations/2026-09-04-014-ptdocs-review.sql'),'utf8')); await c.query('COMMIT'); }
  catch(e){await c.query('ROLLBACK');throw e;} finally{await c.end();}
  const reviewer=await connectReviewer();
  try {
    // Real permission check, with zero target rows and a rollback.
    await reviewer.query('BEGIN');
    let denied=false;
    try{await reviewer.query('UPDATE casework.file_binary SET sha256=sha256 WHERE false');}
    catch(e){if(e.code!=='42501')throw e; denied=true;}
    await reviewer.query('ROLLBACK');assert(denied,'Canonical update was not denied');
  }finally{await reviewer.end();}
  console.log('Review schema installed; canonical UPDATE denied under reviewer role.');
}
async function stage(dir) {
  const manifest=await read(path.join(dir,'source-manifest.json'));
  const inputs={};
  for(const name of ['source-manifest.json','staged-rows.json','staged-binaries.json','row-matches.json','summary.json','sheets.json']) inputs[name]=hash(await fs.readFile(path.join(dir,name)));
  const batchKey=hash(JSON.stringify(inputs));
  const rows=await read(path.join(dir,'staged-rows.json'));
  const matches=await read(path.join(dir,'row-matches.json'));
  const c=await connectReviewer();
  try {
    await c.query('BEGIN');
    await c.query('SELECT pg_advisory_xact_lock(hashtext($1))',[batchKey]);
    const existing=(await c.query('SELECT id FROM ptdocs_review.import_batch WHERE batch_key=$1',[batchKey])).rows[0];
    if(existing){await c.query('COMMIT');console.log(JSON.stringify({batch_id:existing.id,reused:true}));return;}
    const batch=(await c.query(`INSERT INTO ptdocs_review.import_batch(batch_key,attribution,manifest)
      VALUES($1,$2,$3) RETURNING id`,[batchKey,'Virgílio with ChatGPT assistance; individual claim authorship not established',JSON.stringify({source:manifest,inputs,summary:await read(path.join(dir,'summary.json')),sheets:await read(path.join(dir,'sheets.json')),binaries:await read(path.join(dir,'staged-binaries.json')),loader_sha256:hash(await fs.readFile(fileURLToPath(import.meta.url)))})])).rows[0].id;
    for(let i=0;i<rows.length;i+=100) await c.query(`INSERT INTO ptdocs_review.source_row(batch_id,workbook,workbook_sha256,sheet,row_number,cells)
      SELECT $1,x->>'workbook',x->>'workbook_sha256',x->>'sheet',(x->>'row_number')::int,x->'cells'
      FROM jsonb_array_elements($2::jsonb) x`,[batch,JSON.stringify(rows.slice(i,i+100))]);
    for(const r of matches) {
      const src=(await c.query(`SELECT id FROM ptdocs_review.source_row WHERE batch_id=$1 AND workbook=$2 AND sheet='Document Register' AND row_number=$3`,[batch,r.source_row.workbook,r.row_number])).rows[0];
      const binary=r.sha256?(await c.query('SELECT id FROM casework.file_binary WHERE sha256=$1',[r.sha256])).rows[0]:null;
      if(r.match) {
        const check=(await c.query(`SELECT bd.id FROM casework.bucket_document bd JOIN casework.bucket b ON b.id=bd.bucket_id
          JOIN casework.case_file cf ON cf.id=b.case_file_id JOIN casework.document d ON d.id=bd.document_id
          WHERE bd.id=$1 AND cf.processo=$2 AND b.bucket_id=$3 AND d.document_procinfo=$4`,
          [r.match.bucket_document_id,r.process_number,r.source_bucket_id,r.source_document_reference])).rowCount;
        assert.equal(check,1,`Stale occurrence crosswalk for row ${r.row_number}`);
      }
      if(r.status==='exact_occurrence_and_binary') assert.equal((await c.query(`SELECT 1 FROM casework.bucket_document bd JOIN casework.document_binary db ON db.document_id=bd.document_id WHERE bd.id=$1 AND db.file_binary_id=$2`,[r.match.bucket_document_id,binary?.id])).rowCount,1);
      await c.query(`INSERT INTO ptdocs_review.row_match(batch_id,source_row_id,bucket_document_id,file_binary_id,method,evidence) VALUES($1,$2,$3,$4,$5,$6)`,[batch,src.id,r.match?.bucket_document_id??null,binary?.id??null,r.status,JSON.stringify(r)]);
    }
    assert.equal(Number((await c.query('SELECT count(*) FROM ptdocs_review.source_row WHERE batch_id=$1',[batch])).rows[0].count),rows.length);
    await c.query('COMMIT'); console.log(JSON.stringify({batch_id:batch,rows:rows.length,matches:matches.length}));
  }catch(e){await c.query('ROLLBACK');throw e;}finally{await c.end();}
}
export async function insertFindings(c,batch,findings) {
  for(const f of findings) {
    const src=f.row_number ? (await c.query(`SELECT id FROM ptdocs_review.source_row WHERE batch_id=$1 AND workbook='Documentation with Links.xlsx' AND sheet='Document Register' AND row_number=$2`,[batch,f.row_number])).rows[0] : null;
    if(f.row_number) assert(src,'Unknown source row');
    const payload={...f};
    const key=hash(JSON.stringify(payload));
    await c.query(`INSERT INTO ptdocs_review.validation_finding(batch_id,source_row_id,finding_key,check_kind,column_key,external_value,assessment,evidence,method,reviewer,proposed_value)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT(batch_id,finding_key) DO NOTHING`,
      [batch,src?.id??null,key,f.check_kind,f.column_key??null,JSON.stringify(f.external_value??null),f.assessment,
        JSON.stringify(f.evidence),f.method,f.reviewer,JSON.stringify(f.proposed_value??null)]);
  }
}
async function findings(batch,file) {
  const items=await read(file); const c=await connectReviewer();
  try{await c.query('BEGIN');await insertFindings(c,batch,items);await c.query('COMMIT');console.log(JSON.stringify({findings_supplied:items.length}));}
  catch(e){await c.query('ROLLBACK');throw e;}finally{await c.end();}
}
if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const [command,a,b]=process.argv.slice(2);
  if(command==='setup') await setup();
  else if(command==='stage'&&a) await stage(path.resolve(a));
  else if(command==='findings'&&a&&b) await findings(a,path.resolve(b));
  else throw new Error('Usage: node app/ptdocs-review.mjs setup | stage <reconciliation-directory> | findings <batch-id> <json-file>');
}
