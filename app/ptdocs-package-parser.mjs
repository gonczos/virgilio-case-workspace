// Conservative Citius literal-text parser. Offsets are UTF-16 indices in one segment.
export function parsePackageText(segments) {
  const pages=[];
  for(const segment of segments){
    const text=segment.text_content??'';let offset=0,index=0;
    for(const page of text.split('\f')){
      if(page.trim())pages.push({segment_id:segment.id,page:segment.page_no??index+1,start:offset,text:page});
      offset+=page.length+1;index++;
    }
  }
  const entries=[],issues=[];
  for(const p of pages){
    const hashes=[...p.text.matchAll(/\b[a-f0-9]{64}\b/ig)];
    if(!hashes.length)continue;
    const refs=[...new Set([...p.text.matchAll(/REF[ªAº]?\s*[.:]?\s*(\d{6,})/ig)].map(x=>x[1]))];
    const manifest= /Peça Processual entregue/i.test(p.text)&&/SHA-256/i.test(p.text) || /DOCUMENTOS/.test(p.text)&&hashes.length>0;
    if(refs.length!==1||!manifest){issues.push({page:p.page,segment_id:p.segment_id,reason:'Hash page lacks unambiguous Citius manifest context',hashes:hashes.map(m=>m[0])});continue;}
    let prior=0;
    for(const h of hashes){
      let context=p.text.slice(prior,h.index);
      const docs=context.lastIndexOf('DOCUMENTOS');if(docs>=0)context=context.slice(docs+10);
      const annex=[...context.matchAll(/^\s*Doc\.\s*(\d+)\s*-\s*([^\r\n]+)/gim)].at(-1);
      const measurement=[...context.matchAll(/Documento\s+[^\r\n]*?\((\d+)\s*p[áa]g\.?\)/ig)].at(-1);
      const main=docs>=0&&!annex;
      const descriptionStart=annex?annex.index+annex[0].length:0;
      const descriptionEnd=measurement?.index??context.length;
      const declaredDescription=context.slice(descriptionStart,descriptionEnd).trim();
      entries.push({reference:refs[0],sha256:h[0].toLowerCase(),annex_number:annex?Number(annex[1]):main?0:null,
        declared_type:annex?.[2]?.trim()??(main?context.trim().split(/\r?\n/)[0].trim():null),declared_description:declaredDescription,declared_pages:measurement?Number(measurement[1]):null,
        segment_id:p.segment_id,page:p.page,char_start:p.start+h.index,char_end:p.start+h.index+64,
        context:p.text.slice(Math.max(prior,h.index-700),h.index+64)});
      prior=h.index+64;
    }
  }
  const first=pages[0]?.text??'';
  const institutionalCover=/Data de Entrega:/.test(first)&&/Finalidade:/.test(first)&&/Caracterização/.test(first);
  const cover=/Peça Processual entregue/i.test(first);
  const ownRefs=cover?[...new Set([...first.matchAll(/REF[ªAº]?\s*[.:]?\s*(\d{6,})/ig)].map(m=>m[1]))]:institutionalCover?[...new Set([...first.matchAll(/Referência:\s*(\d{4,})/ig)].map(m=>m[1]))]:[];
  const ownReference=ownRefs.length===1?ownRefs[0]:null;
  const hasIndex=pages.some(p=>/Índice da Peça Processual/i.test(p.text));
  const internalIndex=pages.filter(p=>/Índice da Peça Processual/i.test(p.text)).map(p=>{
    const start=p.text.search(/Índice da Peça Processual/i),tail=p.text.slice(start);
    return {segment_id:p.segment_id,page:p.page,char_start:p.start+start,text:tail,
      items:[...tail.matchAll(/^\s*(Doc\.|Anexo\s+n[º°o])\s*(\d+)\s*-\s*([^\r\n]+)/gim)].map(m=>({index_label:m[1],index_number:Number(m[2]),description:m[3].trim()}))};
  });
  const ownManifest=ownReference&&entries.some(e=>e.reference===ownReference)
    &&pages.every(p=>/Peça Processual entregue/i.test(p.text));
  return {own_reference:ownReference,kind:ownManifest?'electronic_manifest':ownReference&&(hasIndex||institutionalCover&&pages.length>1)?'combined_package':ownReference?'electronic_cover_unresolved':'other',
    first_page:{segment_id:pages[0]?.segment_id,page:pages[0]?.page,text:first.slice(0,2500)},internal_index:internalIndex,entries,issues};
}
