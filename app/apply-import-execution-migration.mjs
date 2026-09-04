import fs from 'node:fs/promises';
import path from 'node:path';
import {loadDotEnv,getWorkspaceRoot,createDbClient} from './processing-common.mjs';
import {sourceTimeFromLabel} from './import-execution.mjs';
const root=getWorkspaceRoot();loadDotEnv(path.join(root,'.env'));
const db=createDbClient('import-execution-migration');await db.connect();
try{
  await db.query('BEGIN');
  await db.query(await fs.readFile(path.join(root,'db/migrations/2026-09-05-015-import-execution.sql'),'utf8'));
  const rows=(await db.query("SELECT id,external_source_label FROM casework.source_capture WHERE capture_key LIKE 'saved-html:%' AND capture_time_basis='unknown' AND metadata_json ? 'legacy_registration_at'")).rows;
  for(const r of rows){const time=sourceTimeFromLabel(r.external_source_label);if(time.started_at)await db.query(`UPDATE casework.source_capture SET captured_at=$2,capture_time_basis=$3,
    metadata_json=metadata_json || $4::jsonb WHERE id=$1`,[r.id,time.started_at,time.basis,JSON.stringify({captured_at_semantics:'Inferred run start from source label; not verified per-row scrape time',source_time_evidence:r.external_source_label})]);}
  await db.query('COMMIT');console.log('Import execution migration applied; prior registration timestamps preserved.');
}catch(e){await db.query('ROLLBACK');throw e;}finally{await db.end();}
