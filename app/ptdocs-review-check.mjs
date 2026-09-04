// Bounded integration checks against installed review schema; no durable test rows.
import assert from 'node:assert/strict';
import {connectReviewer,insertFindings} from './ptdocs-review.mjs';
const c=await connectReviewer();
try {
  for(const sql of [
    'UPDATE casework.file_binary SET sha256=sha256 WHERE false',
    'DELETE FROM casework.file_binary WHERE false',
    'INSERT INTO casework.file_binary SELECT * FROM casework.file_binary WHERE false',
    'UPDATE ptdocs_review.source_row SET cells=cells WHERE false',
    'DELETE FROM ptdocs_review.source_row WHERE false',
  ]) {
    await c.query('BEGIN');
    try { await assert.rejects(c.query(sql),e=>e.code==='42501'); }
    finally { await c.query('ROLLBACK'); }
  }
  await c.query('BEGIN');
  try {
    const batch=(await c.query(`INSERT INTO ptdocs_review.import_batch(batch_key,attribution,manifest)
      VALUES('integration-'||txid_current(),'rollback-only check','{}') RETURNING id`)).rows[0].id;
    const f={check_kind:'integration_check',assessment:'informational',evidence:{rollback:true},method:'test',reviewer:'test'};
    await insertFindings(c,batch,[f,f]);
    assert.equal((await c.query('SELECT * FROM ptdocs_review.validation_finding WHERE batch_id=$1',[batch])).rowCount,1);
    await c.query('SAVEPOINT invalid_row');
    await assert.rejects(c.query(`INSERT INTO ptdocs_review.validation_finding(batch_id,source_row_id,finding_key,check_kind,assessment,evidence,method,reviewer)
      VALUES($1,-1,'invalid','test','informational','{}','test','test')`,[batch]),e=>e.code==='23503');
    await c.query('ROLLBACK TO invalid_row');
  } finally { await c.query('ROLLBACK'); }
  console.log('PASS: canonical writes denied; staging updates/deletes denied; duplicate findings deduplicated; source-row FK enforced; test rows rolled back.');
} finally {await c.end();}
