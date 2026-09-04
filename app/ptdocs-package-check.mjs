import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
const [dirArg]=process.argv.slice(2);if(!dirArg)throw new Error('Usage: node app/ptdocs-package-check.mjs <snapshot-directory>');
const dir=path.resolve(dirArg),read=async p=>JSON.parse(await fs.readFile(path.join(dir,p),'utf8'));
const inv=await read('inventory.json'),map=await read('package-map.json'),rows=await read('row-review.json');
assert.equal(rows.length,inv.rows.length);assert.equal(new Set(rows.map(r=>r.row_number)).size,inv.rows.length);
const reps=new Map();let matchingHashSets=0;
for(const b of map.binaries){
 const sets={};
 for(const r of b.representations){
  const data=await fs.readFile(path.join(dir,r.artifact));assert.equal(crypto.createHash('sha256').update(data).digest('hex'),r.artifact_sha256);
  const rep=JSON.parse(data);reps.set(r.id,rep);
  sets[r.processor_key]=[...new Set(rep.segments.flatMap(s=>[...(s.text_content??'').matchAll(/\b[a-f0-9]{64}\b/ig)].map(m=>m[0].toLowerCase())))].sort();
 }
 if(sets.pdf_literal_text?.length){assert.deepEqual(sets.pdf_literal_text,sets.docling);matchingHashSets++;}
}
const edges=new Map(),missing=[];let pageChecks=0;
for(const pkg of map.packages){
 const slots=new Map();
 for(const e of pkg.entries){
  const rep=reps.get(e.representation_id),segment=rep.segments.find(s=>s.id===e.segment_id);
  assert.equal(segment.text_content.slice(e.char_start,e.char_end).toLowerCase(),e.sha256);
  assert.equal(rep.binary_sha256,e.source_sha256);assert.notEqual(e.annex_number,null);
  if(slots.has(e.annex_number))assert.equal(slots.get(e.annex_number),e.sha256);slots.set(e.annex_number,e.sha256);
  const key=[pkg.reference,e.annex_number,e.sha256].join(':');edges.set(key,e);
  if(e.target?.canonical_binary_id&&e.declared_pages){const b=map.binaries.find(b=>b.binary_id===e.target.canonical_binary_id);assert.equal(e.declared_pages,b.page_count);pageChecks++;}
 }
 assert.deepEqual([...slots.keys()].sort((a,b)=>a-b),Array.from({length:Math.max(...slots.keys())+1},(_,i)=>i));
}
for(const e of edges.values())if(!e.target)missing.push(e);
const result={occurrences:rows.length,files:inv.files.length,canonical_binaries:map.binaries.length,matching_literal_and_docling_hash_sets:matchingHashSets,manifest_submissions:map.packages.length,
 combined_submissions:map.binaries.filter(b=>b.selected?.kind==='combined_package').length,unique_manifest_edges:edges.size,available_edges:[...edges.values()].filter(e=>e.target).length,
 unavailable_edges:missing.length,unique_target_hashes:new Set([...edges.values()].map(e=>e.sha256)).size,page_count_observations_checked:pageChecks,
 checked:'Snapshot digests; segment offsets; cross-extractor full hash sets; unambiguous contiguous annex slots; declared versus actual canonical page counts; occurrence coverage.'};
await fs.writeFile(path.join(dir,'verification.json'),JSON.stringify(result,null,2));await fs.writeFile(path.join(dir,'missing-files.json'),JSON.stringify(missing,null,2));
console.log(JSON.stringify(result));
