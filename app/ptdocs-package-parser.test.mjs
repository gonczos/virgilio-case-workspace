import test from 'node:test';
import assert from 'node:assert/strict';
import {parsePackageText} from './ptdocs-package-parser.mjs';
const hash='a'.repeat(64),hash2='b'.repeat(64);
const header=ref=>`Peça Processual entregue por via electrónica\nREFª: ${ref}\n`;
test('manifest first page may precede all hash entries',()=>{
 const text=header('12345678')+'Parties\f'+header('12345678')+`DOCUMENTOS\nRequerimento\nDocumento 0,1 MB (3 pág.) ${hash}\nDoc. 1 - Email\nDescription\nDocumento 0,2 MB (2 pág.) ${hash2}\nSHA-256`;
 const p=parsePackageText([{id:'1',text_content:text}]);assert.equal(p.kind,'electronic_manifest');
 assert.deepEqual(p.entries.map(e=>e.annex_number),[0,1]);assert.equal(p.entries[1].declared_type,'Email');
 for(const e of p.entries)assert.equal(text.slice(e.char_start,e.char_end),e.sha256);
});
test('embedded manifest is not the notification wrapper own reference',()=>{
 const p=parsePackageText([{id:'1',text_content:`NOTIFICAÇÃO\nReferência: 123456789\f${header('12345678')}DOCUMENTOS\nRequerimento\nDocumento 0,1 MB (1 pág.) ${hash}\nSHA-256`}]);
 assert.equal(p.own_reference,null);assert.equal(p.kind,'other');assert.equal(p.entries[0].reference,'12345678');
});
test('multiple references on hash page are quarantined',()=>{
 const p=parsePackageText([{id:'1',text_content:header('12345678')+`REFª: 87654321\nDOCUMENTOS\n${hash}`}]);
 assert.equal(p.entries.length,0);assert.equal(p.issues.length,1);
});
test('legacy combined package and five-digit institutional cover retain own references',()=>{
 assert.equal(parsePackageText([{id:'1',text_content:header('12345678')+'\fPleading\fÍndice da Peça Processual'}]).kind,'combined_package');
 const p=parsePackageText([{id:'1',text_content:'Referência: 30540\nData de Entrega: 09-08-2021\nFinalidade: Juntar\nCaracterização\fPleading'}]);
 assert.equal(p.own_reference,'30540');assert.equal(p.kind,'combined_package');
});
test('legacy internal index numbering is not converted to manifest annex numbering',()=>{
 const p=parsePackageText([{id:'1',text_content:header('12345678')+'\fÍndice da Peça Processual\nAnexo nº 1 - Requerimento\nAnexo nº 2 - Doc. 1'}]);
 assert.equal(p.entries.length,0);
 assert.deepEqual(p.internal_index[0].items,[{index_label:'Anexo nº',index_number:1,description:'Requerimento'},{index_label:'Anexo nº',index_number:2,description:'Doc. 1'}]);
});
