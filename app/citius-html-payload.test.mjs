import test from 'node:test';
import assert from 'node:assert/strict';
import {CITIUS_HTML_ADAPTER,validateCitiusPayloadAdapter} from './citius-html-payload.mjs';
const item={kind:'document_row',path:'row.html',sha256:'a'.repeat(64),raw_base64:'',context:{},rows:[{attributes:{},cells:['0'],links:[]}],elements:[]};
test('legacy payload can be labelled without mutating source metadata or payload',()=>{
  const meta={original:'retained'};const before=JSON.stringify({meta,item});
  assert.deepEqual(validateCitiusPayloadAdapter(meta,[item]),CITIUS_HTML_ADAPTER);
  assert.equal(JSON.stringify({meta,item}),before);
});
test('same adapter accepted; unknown identity and malformed payload rejected',()=>{
  validateCitiusPayloadAdapter({adapter:{key:'citius-saved-html',version:'1'}},[item]);
  assert.throws(()=>validateCitiusPayloadAdapter({adapter:{key:'citius-saved-html',version:'2'}},[item]));
  assert.throws(()=>validateCitiusPayloadAdapter({},[{...item,rows:null}]));
});
