import fs from 'node:fs/promises';
import path from 'node:path';
const [dirArg]=process.argv.slice(2);if(!dirArg)throw new Error('Usage: node app/ptdocs-package-review.mjs <snapshot-directory>');
const dir=path.resolve(dirArg),read=async p=>JSON.parse(await fs.readFile(path.join(dir,p),'utf8'));
const inv=await read('inventory.json'),map=await read('package-map.json');
const byBinary=new Map(map.binaries.map(b=>[b.binary_id,b])),byRef=new Map(map.packages.map(p=>[p.reference,p]));
const filename=new Map(inv.files.map(f=>[f.filename,f]));
const allEntries=map.packages.flatMap(p=>p.entries),findings=[],reviews=[];
const numeric=v=>v&&Number.isSafeInteger(Number(v))?String(Number(v)):v;
for(const row of inv.rows){
 const v=k=>row.cells[k]?.value??null,reference=numeric(v('AQ')),role=v('AR'),b=byBinary.get(row.file_binary_id),own=b?.selected;
 const actual=row.evidence.sha256??b?.sha256,pkg=byRef.get(reference),recovered=role?.includes('recovered'),missing=role?.startsWith('Expected Annex');
 const claimedHash=/^[a-f0-9]{64}$/i.test(v('AW'))?v('AW').toLowerCase():null;
 const targetHash=recovered?claimedHash:actual;
 const membership=pkg?.entries.filter(e=>e.sha256===targetHash)??[];
 const globalMembership=allEntries.filter(e=>e.sha256===actual);
 const uniqueSlots=[...new Set(membership.map(e=>e.annex_number))];
 const mainHashes=[...new Set(pkg?.entries.filter(e=>e.annex_number===0).map(e=>e.sha256)??[])];
 const checks=[];
 const add=(column,assessment,reason,proposed=null)=>{if(v(column)!==null)checks.push({column,value:v(column),assessment,reason,proposed});};
 if(reference){
  if(own?.own_reference&&(role?.includes('Combined')||role==='Electronic Filing Manifest'))add('AQ',reference===own.own_reference?'supported':membership.length?'partially_supported':'unresolved','Own cover reference retained separately. A different claimed outer submission requires independent membership evidence; difference alone is not proof of an error.',own.own_reference);
  else if(membership.length)add('AQ',recovered?'partially_supported':'supported',recovered?'Manifest proves original-image membership; PDF derivative linkage requires separate evidence.':'Actual binary SHA is listed in this filing manifest.');
  else if(missing&&pkg)add('AQ','partially_supported','Manifest exists, but absent binary prevents individual occurrence assignment.');
  else add('AQ','unresolved','No deterministic own-cover or byte-identity membership evidence for this row.');
 }
 if(role){
  if(role==='Electronic Filing Manifest'||role.startsWith('Combined')){
   const expected=role==='Electronic Filing Manifest'?'electronic_manifest':'combined_package';
   add('AR',own?.kind===expected?'supported':own?.kind==='electronic_manifest'||own?.kind==='combined_package'?'contradicted':'unresolved','PDF cover and manifest/index structure; generic classification does not certify pleading subtype.',own?.kind??null);
  }else if(recovered)add('AR','partially_supported','Original hash membership and derivative provenance are separate; awaiting derivative image check.');
  else if(missing)add('AR',pkg?'partially_supported':'unresolved','Expected manifest entry can be verified, but row-to-missing-file identity is not established from row order.');
  else if(role==='Annex'||role.startsWith('Main')){
   const ok=role==='Annex'?uniqueSlots.some(n=>n>0):uniqueSlots.includes(0);
   add('AR',ok?'supported':membership.length?'contradicted':'unresolved','Role checked against actual binary SHA and main/annex position in manifest.');
  }else add('AR','unresolved','Manual submission requires targeted page inspection; no electronic structure inferred.');
 }
 if(v('AS')){
  const parent=filename.get(v('AS'));
  if(mainHashes.length===1&&parent)add('AS',parent.sha256===mainHashes[0]?(membership.length||own?.own_reference===reference?'supported':'partially_supported'):'contradicted','Named main file resolved by SHA. Parent identity does not prove this row belongs to that submission without own-cover or membership evidence.',mainHashes[0]);
  else if(role?.startsWith('Combined')&&own?.kind==='combined_package'&&parent)add('AS',parent.sha256===actual?'supported':'contradicted','Self-contained combined package must resolve to its own binary.');
  else add('AS','unresolved','No unique manifest main file or proven combined self-reference.');
 }
 const slot=Number(v('AT')?.match(/Doc\.\s*(\d+)/i)?.[1]);
 if(v('AT')){
  if(membership.length)add('AT',uniqueSlots.includes(slot)?recovered?'partially_supported':'supported':'contradicted','Annex number checked against manifest entry for target full hash.',uniqueSlots);
  else if(missing&&pkg?.entries.some(e=>e.annex_number===slot))add('AT','partially_supported','This slot exists in manifest; individual fileless occurrence assignment remains unproven.');
  else add('AT','unresolved','No byte-identified manifest slot.');
 }
 if(v('AW')){
  if(!claimedHash)add('AW','contradicted','Manifest SHA field contains prose, not a full SHA-256.',missing?pkg?.entries.find(e=>e.annex_number===slot)?.sha256:null);
  else if(recovered)add('AW',membership.length?'supported':'unresolved','Hash checked against manifest and recovered original bytes, not derivative PDF bytes.');
  else if(actual&&claimedHash!==actual)add('AW','contradicted','Claimed hash differs from actual linked binary.');
  else if(membership.some(e=>e.sha256===claimedHash))add('AW','supported','Full manifest SHA agrees with actual linked binary.');
  else if(missing&&pkg?.entries.some(e=>e.sha256===claimedHash))add('AW','partially_supported','Hash exists in manifest but unavailable binary prevents occurrence-level assignment.');
  else add('AW','unresolved','Hash alone does not prove the claimed submission relationship.');
 }
 if(v('AU')){
  const cats=[...new Set(membership.map(e=>e.declared_type))];
  add('AU',cats.includes(v('AU'))?'supported':cats.length?'candidate':'unresolved','Annex Category compared with literal manifest category; differences require interpretation, not silent recategorization.',cats);
 }
 if(v('AV')){
  const norm=t=>(t??'').replace(/\s+/g,' ').trim().toLocaleLowerCase('pt');
  const exact=membership.some(e=>norm(e.declared_description)===norm(v('AV'))||norm(e.declared_type)===norm(v('AV')));
  add('AV',exact?'supported':'unresolved',exact?'Description agrees with literal manifest wording; this does not establish truth of content.':'Free-text annex description not automatically certified by structural matching; exact manifest passages retained for review.');
 }
 const status=!checks.length?'not_applicable':checks.some(c=>c.assessment==='contradicted')?'contradicted':checks.every(c=>c.assessment==='supported')?'supported':checks.some(c=>c.assessment==='supported'||c.assessment==='partially_supported')?'partially_supported':'unresolved';
 const evidence={row_number:row.row_number,actual_binary_sha256:actual,canonical_occurrence_id:row.bucket_document_id,match_method:row.method,reference,role,
  checks,own_structure:own?{kind:own.kind,own_reference:own.own_reference,representation_id:own.representation_id,processor:own.processor,processor_version:own.version,representation_artifact_sha256:own.representation_artifact_sha256,first_page:own.first_page,internal_index:own.internal_index}:null,
  membership_evidence:membership,other_manifest_references:[...new Set(globalMembership.map(e=>e.reference))],
  scope:'Structural fields only; descriptions, truth of allegations and exact missing-occurrence identities are not approved. No inference from bucket/order alone.'};
 reviews.push({row_number:row.row_number,status,...evidence});
 findings.push({row_number:row.row_number,check_kind:'full_set_package_row_review',assessment:status==='not_applicable'?'informational':status,evidence,method:'Citius package structural validation v1; parser SHA '+map.parser_sha256,reviewer:'Codex (automated evidence checks; not human approval)'});
}
for(const pkg of map.packages)findings.push({check_kind:'full_set_package_map',assessment:'informational',evidence:pkg,method:'Literal Citius manifest extraction v1; parser SHA '+map.parser_sha256,reviewer:'Codex'});
const summary={batch_id:inv.batch_id,occurrences:reviews.length,files:inv.files.length,canonical_binaries:map.binaries.length,packages:map.packages.length,
 combined_binaries:map.binaries.filter(b=>b.selected?.kind==='combined_package').length,
 rows_by_status:reviews.reduce((a,r)=>(a[r.status]=(a[r.status]??0)+1,a),{}),fields_by_status:reviews.flatMap(r=>r.checks).reduce((a,c)=>(a[c.assessment]=(a[c.assessment]??0)+1,a),{}),
 exceptions:reviews.filter(r=>r.status==='contradicted').map(r=>({row:r.row_number,checks:r.checks.filter(c=>c.assessment==='contradicted')}))};
for(const [name,data] of Object.entries({'row-review.json':reviews,'package-findings.json':findings,'summary.json':summary}))await fs.writeFile(path.join(dir,name),JSON.stringify(data,null,2));
console.log(JSON.stringify(summary));
