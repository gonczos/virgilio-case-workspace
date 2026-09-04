"""Preserve saved HTML bytes and extract observations without executing HTML."""
import argparse
import base64
import hashlib
import json
from collections import Counter
from html.parser import HTMLParser
from pathlib import Path

class Parser(HTMLParser):
    def __init__(self, text):
        super().__init__(); self.elements=[]; self.rows=[]; self.row=None; self.cell=None
        self.feed(text)
    def handle_starttag(self, tag, attrs):
        self.elements.append({'tag':tag,'attributes':attrs})
        if tag=='tr':
            self.row={'attributes':dict(attrs),'cells':[],'links':[]}; self.rows.append(self.row)
        if tag=='td' and self.row is not None: self.cell=[]
        if tag=='a' and self.row is not None: self.row['links'].append(dict(attrs))
    def handle_data(self, data):
        if self.cell is not None: self.cell.append(data)
    def handle_endtag(self, tag):
        if tag=='td' and self.cell is not None:
            self.row['cells'].append(''.join(self.cell).strip()); self.cell=None
        if tag=='tr': self.row=None

def sha(data): return hashlib.sha256(data).hexdigest()

def main():
    p=argparse.ArgumentParser(); p.add_argument('source',type=Path); p.add_argument('output',type=Path)
    a=p.parse_args(); root=a.source.resolve(); output=a.output.resolve()
    if output.is_relative_to(root): raise ValueError('Output must be outside the read-only source')
    if output.exists(): raise ValueError('Use a new output snapshot path')
    items=[]
    for file in sorted(root.rglob('*.html')):
        raw=file.read_bytes(); parsed=Parser(raw.decode('utf-8-sig'))
        rel=file.relative_to(root); parts=rel.parts
        kind='case_row' if file.name=='case-row.html' else 'bucket_row' if file.name=='bucket-row.html' else 'document_row' if file.name.startswith('document-row-') else 'artifact'
        context={}
        if parts:
            casefile=root/parts[0]/'case-row.html'
            if casefile.exists(): context['case']=Parser(casefile.read_text(encoding='utf-8-sig')).rows[0]['attributes']
        if len(parts)>2:
            bucketfile=file.parent/'bucket-row.html'
            if bucketfile.exists(): context['bucket']=Parser(bucketfile.read_text(encoding='utf-8-sig')).rows[0]['attributes']
        items.append(dict(path=rel.as_posix(),sha256=sha(raw),size=len(raw),raw_base64=base64.b64encode(raw).decode(),
                          kind=kind,context=context,rows=parsed.rows,elements=parsed.elements))
    manifest=[{k:r[k] for k in ('path','sha256','size')} for r in items]
    result=dict(source_label=root.name,manifest_sha256=sha(json.dumps(manifest,sort_keys=True).encode()),
                extractor_sha256=sha(Path(__file__).read_bytes()),items=items,
                counts=dict(Counter(r['kind'] for r in items)),order_policy='Capture position is not stable identity evidence')
    output.parent.mkdir(parents=True,exist_ok=True); output.write_text(json.dumps(result,ensure_ascii=False),encoding='utf-8')
    print(json.dumps({'files':len(items),'counts':result['counts'],'manifest_sha256':result['manifest_sha256']}))

if __name__=='__main__': main()
