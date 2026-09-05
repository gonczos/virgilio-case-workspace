import assert from 'node:assert/strict';

// Payload interpretation contract, not a dynamic adapter registry or executor.
export const CITIUS_HTML_ADAPTER = Object.freeze({key:'citius-saved-html',version:'1'});

export function validateCitiusPayloadAdapter(metadata, items) {
  if(Object.hasOwn(metadata,'adapter')) assert.deepEqual(metadata.adapter,CITIUS_HTML_ADAPTER,
    'Unsupported capture adapter; do not reinterpret or overwrite its identity');
  for(const item of items) {
    assert(['case_row','bucket_row','document_row','artifact'].includes(item.kind),'Unsupported HTML payload kind');
    assert.equal(typeof item.path,'string');
    assert.match(item.sha256,/^[a-f0-9]{64}$/);
    assert.equal(typeof item.raw_base64,'string');
    assert(Array.isArray(item.rows) && Array.isArray(item.elements),'Missing parsed HTML arrays');
    assert(item.context && typeof item.context==='object','Missing source context');
    for(const row of item.rows) assert(row.attributes && Array.isArray(row.cells) && Array.isArray(row.links),'Invalid parsed row');
  }
  return CITIUS_HTML_ADAPTER;
}
