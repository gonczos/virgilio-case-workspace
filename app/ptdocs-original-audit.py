"""Read-only comparison of the original handoff/scrape against staged PTDocs.

ZIP/7z files are excluded, including from the source-hash manifest. No source file
is modified. HTML is parsed as data and no scripts or links are executed.
"""
import argparse
import csv
import hashlib
import json
from collections import Counter, defaultdict
from datetime import datetime, timedelta
from decimal import Decimal, InvalidOperation
from html.parser import HTMLParser
from pathlib import Path

class RowParser(HTMLParser):
    def __init__(self, text):
        super().__init__(); self.attrs = {}; self.title = ''; self.cells = []; self.cell = None
        self.feed(text)
    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == 'tr': self.attrs = attrs
        elif tag == 'td': self.cell = []
        elif tag == 'a' and 'downloadDocument' in attrs.get('class', ''): self.title = attrs.get('title', '')
    def handle_data(self, data):
        if self.cell is not None: self.cell.append(data)
    def handle_endtag(self, tag):
        if tag == 'td' and self.cell is not None:
            self.cells.append(''.join(self.cell).strip()); self.cell = None

def digest(p):
    with p.open('rb') as f: return hashlib.file_digest(f, 'sha256').hexdigest()

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('originals', type=Path)
    parser.add_argument('package_snapshot', type=Path)
    parser.add_argument('output', type=Path)
    args = parser.parse_args(); args.output.mkdir(parents=True, exist_ok=True)
    root = args.originals.resolve()
    def one(pattern):
        found = [p for p in root.glob(pattern) if p.is_dir()]
        if len(found) != 1: raise ValueError(f'Expected one extracted directory: {pattern}')
        return found[0]
    upload = one('*google-drive-package*'); audit = one('*multicase-audit*')
    def table(name):
        with (upload/name).open(encoding='utf-8-sig', newline='') as f: return list(csv.DictReader(f))
    def load(name): return json.loads((args.package_snapshot/name).read_text(encoding='utf-8'))
    inventory = load('inventory.json'); review = load('row-review.json')
    register = table('sheets/Lawyer_Document_Register.csv')
    files = table('metadata/file_binary.csv'); docs = table('metadata/document.csv')
    def key(r): return r['Case Reference'], r['Bucket ID'], r['Court Document Reference']
    original = defaultdict(list)
    for line,r in enumerate(register, 2): original[key(r)].append(dict(r, csv_line=line))
    assert all(len(v)==1 for v in original.values()), 'Ambiguous original occurrence key'
    byfile = {f['export_filename']: f for f in files}
    actual_files = []
    for f in files:
        p = (upload/f['export_rel_path']).resolve()
        if not p.is_relative_to(upload): raise ValueError('Path outside original upload')
        h = digest(p); assert h == f['sha256'], p
        actual_files.append(dict(filename=f['export_filename'], sha256=h, path=str(p.relative_to(root))))
    current_hashes = {f['sha256'] for f in inventory['files']}
    original_hashes = {f['sha256'] for f in actual_files}
    changes=[]; matches=[]; unmatched=[]
    columns={'A':'Case Reference','B':'Main Case Reference','C':'Proceeding Type','D':'Date','E':'Bucket Reference','F':'Bucket ID',
             'G':'File','H':'Bucket Designation','I':'Presenter','J':'Document Name','K':'Document Type','L':'Court Document Reference',
             'M':'Court Listed Count','N':'File Size Bytes','O':'File Format','P':'PDF/Text Status','Q':'File Status','R':'Occurrence Notes','U':'Export Filename'}
    def value(r,col): return r['cells'].get(col,{}).get('value') or ''
    def number(value):
        if not value: return ''
        try:
            parsed = Decimal(value)
            return str(int(parsed)) if parsed.is_finite() and parsed == parsed.to_integral_value() else value
        except InvalidOperation: return value
    for r in inventory['rows']:
        k=(value(r,'A'),number(value(r,'F')),value(r,'L'))
        if k not in original: unmatched.append(r['row_number']); continue
        old=original[k][0]; before=byfile.get(old['Export Filename']); current=r['evidence'].get('sha256')
        matches.append(dict(row=r['row_number'],original_csv_line=old['csv_line'],key=k,
            original_filename=old['Export Filename'],original_sha256=before['sha256'] if before else None,current_sha256=current,
            binary_outcome='same_bytes' if before and before['sha256']==current else 'new_recovered_file' if not before and current else 'both_fileless' if not before and not current else 'different_bytes'))
        for col,name in columns.items():
            new=value(r,col); prior=old[name]
            if col=='D' and new:
                try: new=(datetime(1899,12,30)+timedelta(days=float(new))).date().isoformat()
                except ValueError: pass
            if col in ['E','F','M','N']:
                new=number(new)
            if new != prior: changes.append(dict(row=r['row_number'],column=col,field=name,original=prior,current=new,csv_line=old['csv_line']))
    raw=[]
    for case_dir in sorted(p for p in audit.iterdir() if p.is_dir()):
        case=RowParser((case_dir/'case-row.html').read_text(encoding='utf-8')).attrs['data-processo']
        for entry in sorted(case_dir.glob('entry-*')):
            bucket=RowParser((entry/'bucket-row.html').read_text(encoding='utf-8')).attrs['data-proc']
            for f in sorted(entry.glob('document-row-*.html')):
                row=RowParser(f.read_text(encoding='utf-8')); ref=row.attrs['data-procinfo']
                raw.append(dict(case=case,bucket=bucket,reference=ref,ui_position=int(f.stem.rsplit('-',1)[1]),
                    source_path=str(f.relative_to(root)),source_sha256=digest(f),type=row.attrs.get('data-tipoconteudo'),title=row.title,cells=row.cells))
    raw_bykey=defaultdict(list)
    for r in raw: raw_bykey[(r['case'],r['bucket'],r['reference'])].append(r)
    docs_byref={d['document_procinfo']:d for d in docs}
    title_gaps=[r for r in raw if r['title'] and not docs_byref.get(r['reference'],{}).get('document_anchor_title')]
    unmapped_original=[dict(key=k,csv_line=v[0]['csv_line']) for k,v in original.items() if k not in raw_bykey]
    extra_raw=[r for k,v in raw_bykey.items() if k not in original for r in v]
    match_byrow={r['row']:r for r in matches}
    disputed=[]
    for r in review:
        if any(c['column']=='AW' and c['assessment']=='contradicted' and 'actual linked binary' in c['reason'] for c in r['checks']):
            m=match_byrow.get(r['row_number']); disputed.append(dict(row=r['row_number'],original_comparison=m,
                workbook_hash=next(c['value'] for c in r['checks'] if c['column']=='AW'),raw_observations=raw_bykey.get(tuple(m['key']),[]) if m else []))
    manifest=[dict(path=str(p.relative_to(root)),size=p.stat().st_size,sha256=digest(p)) for p in sorted(root.rglob('*')) if p.is_file() and p.suffix.lower() not in ['.zip','.7z']]
    summary=dict(original_files=len(files),actual_pdf_files=len(list((upload/'binaries').glob('*.pdf'))),all_original_file_hashes_verified=True,
        original_hashes_missing_from_current=len(original_hashes-current_hashes),current_extra_hashes=len(current_hashes-original_hashes),
        original_register_rows=len(register),current_exact_occurrence_matches=len(matches),current_unmatched_rows=unmatched,
        matched_binary_outcomes=dict(Counter(m['binary_outcome'] for m in matches)),source_field_changes=dict(Counter(d['field'] for d in changes)),
        raw_document_rows=len(raw),raw_unique_occurrence_keys=len(raw_bykey),original_rows_without_raw_match=len(unmapped_original),raw_keys_not_in_original=len({(r['case'],r['bucket'],r['reference']) for r in extra_raw}),
        raw_titles_missing_in_export=len(title_gaps),unique_documents_with_missing_titles=len({r['reference'] for r in title_gaps}),
        hash_discrepancy_rows_checked=len(disputed),hash_discrepancy_rows_with_same_original_bytes=sum(bool(d['original_comparison']) and d['original_comparison']['binary_outcome']=='same_bytes' for d in disputed),
        row_order_policy='User reports unstable site rendering order; positions are observations only and cannot establish binary-to-occurrence mappings.',
        source_files_hashed=len(manifest),archives_ignored=sum(p.is_file() and p.suffix.lower() in ['.zip','.7z'] for p in root.rglob('*')),processor_sha256=digest(Path(__file__)))
    outputs={'summary.json':summary,'source-manifest.json':manifest,'original-file-hashes.json':actual_files,'occurrence-comparison.json':matches,'source-field-changes.json':changes,
             'raw-occurrences.json':raw,'raw-title-gaps.json':title_gaps,'original-without-raw-match.json':unmapped_original,'raw-not-in-original.json':extra_raw,'hash-discrepancy-origins.json':disputed}
    for name,data in outputs.items():(args.output/name).write_text(json.dumps(data,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps(summary,ensure_ascii=True))

if __name__=='__main__': main()
