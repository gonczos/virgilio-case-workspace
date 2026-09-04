import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {parsePackageText} from './ptdocs-package-parser.mjs';
const [dirArg]=process.argv.slice(2);if(!dirArg)throw new Error('Usage: node app/ptdocs-package-map.mjs <snapshot-directory>');
const dir=path.resolve(dirArg),read=async p=>JSON.parse(await fs.readFile(path.join(dir,p),'utf8'));
const inv=await read('inventory.json'),binaries=[],observations=[];
for(const b of inv.binaries){
 const reps=[];
 for(const rep of b.representations){
  const data=await read(rep.artifact),parsed=parsePackageText(data.segments);
  const observation={binary_id:b.binary_id,binary_sha256:b.sha256,representation_id:rep.id,processor:rep.processor_key,version:rep.processor_version,
    representation_artifact_sha256:rep.artifact_sha256,selected:rep.id===b.selected_representation_id,...parsed};
  reps.push(observation);
  if(parsed.entries.length||parsed.issues.length||parsed.own_reference)observations.push(observation);
 }
 const selected=reps.find(r=>r.selected);
 binaries.push({...b,observations:undefined,selected:selected??null,secondary_package_candidates:reps.filter(r=>!r.selected&&(r.entries.length||r.own_reference)).map(r=>({representation_id:r.representation_id,processor:r.processor,entries:r.entries.length,own_reference:r.own_reference}))});
}
const groups=new Map();
for(const o of observations.filter(o=>o.selected))for(const entry of o.entries){
 if(!groups.has(entry.reference))groups.set(entry.reference,[]);
 const target=inv.files.find(f=>f.sha256===entry.sha256);
 groups.get(entry.reference).push({...entry,source_binary_id:o.binary_id,source_sha256:o.binary_sha256,representation_id:o.representation_id,processor:o.processor,
   processor_version:o.version,representation_artifact_sha256:o.representation_artifact_sha256,target:target?{sha256:target.sha256,filename:target.filename,canonical_binary_id:target.canonical_binary_id}:null});
}
const packages=[...groups].map(([reference,entries])=>({reference,entries,unique_members:[...new Set(entries.map(e=>e.sha256))],source_binaries:[...new Set(entries.map(e=>e.source_binary_id))]}));
const result={batch_id:inv.batch_id,parser_sha256:crypto.createHash('sha256').update(await fs.readFile(new URL('./ptdocs-package-parser.mjs',import.meta.url))).digest('hex'),binaries,packages,observations};
await fs.writeFile(path.join(dir,'package-map.json'),JSON.stringify(result,null,2));
console.log(JSON.stringify({kinds:binaries.reduce((a,b)=>(a[b.selected?.kind??'no_text']=(a[b.selected?.kind??'no_text']??0)+1,a),{}),packages:packages.length,entry_observations:packages.reduce((n,p)=>n+p.entries.length,0),unique_members:new Set(packages.flatMap(p=>p.unique_members)).size,missing:packages.flatMap(p=>p.entries).filter(e=>!e.target).length,unparsed_hash_pages:observations.filter(o=>o.selected).flatMap(o=>o.issues).length}));
