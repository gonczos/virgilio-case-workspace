import test from 'node:test';
import assert from 'node:assert/strict';
import {sourceTimeFromLabel} from './import-execution.mjs';
test('source time is inferred only from a valid run timestamp',()=>{
  assert.deepEqual(sourceTimeFromLabel('audit-2026-08-29T22-50-36-257Z'),{started_at:'2026-08-29T22:50:36.257Z',ended_at:null,basis:'inferred_run_label'});
  for(const label of ['unknown','audit-2026-02-30T22-50-36-257Z','audit-2026-08-29T25-50-36-257Z'])
    assert.deepEqual(sourceTimeFromLabel(label),{started_at:null,ended_at:null,basis:'unknown'});
});
