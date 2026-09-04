import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import { extractLabelledReferences, REFERENCE_EXTRACTOR_KEY, REFERENCE_EXTRACTOR_VERSION } from "../app/reference-search-store-v6.mjs";

const extract = (text) => extractLabelledReferences(text).map(({ raw_value, raw_label, rule_key, char_start, char_end, label_provenance, parsed_attachment_number, parsed_folio, parsed_folio_side }) => ({ raw_value, raw_label, rule_key, char_start, char_end, label_provenance, parsed_attachment_number, parsed_folio, parsed_folio_side }));

test("v6 has an isolated identity and leaves the v5 source unchanged",()=>{assert.equal(REFERENCE_EXTRACTOR_KEY,"app/reference-search-store-v6.mjs");assert.equal(REFERENCE_EXTRACTOR_VERSION,"labelled-reference-v6");assert.equal(fs.readFileSync("app/reference-search-store.mjs","utf8").includes('REFERENCE_EXTRACTOR_VERSION = "labelled-reference-v5"'),true);});

test("generic references require a digit-bearing value",()=>{
  assert.deepEqual(extractLabelledReferences("Referência deste; Ref. sequer; Referência Requerente"),[]);
  const [item]=extract("Referência: AB-12_CD/3");
  assert.equal(item.raw_value,"AB-12_CD/3");assert.equal(item.rule_key,"reference-labelled-v4");
});

test("generic reference does not cross an empty field into a later label",()=>{
  assert.deepEqual(extractLabelledReferences("Referência:\nRequerente: 123456"),[]);
  assert.equal(extract("Referência:\n123456")[0].raw_value,"123456");
});

test("Citius qualifier belongs to the label and numeric value is emitted",()=>{
  for(const text of ["Refº Citius: 8656497","Refº Citius: 651161"]){const [item]=extract(text);assert.equal(item.raw_value,text.split(": ")[1]);assert.equal(item.raw_label,"Refº Citius");assert.equal(item.rule_key,"reference-citius-qualified-v1");assert.equal(item.label_provenance.source_label,"Refº Citius");}
  assert.deepEqual(extract("Refº Citius: 8656497; 123456").map(x=>x.raw_value),["8656497"]);
});

test("DOC v2 completes only reviewed separated uppercase A suffixes",()=>{
  const cases=[["DOC Nº12 A","12A"],["DOC Nº12-A","12A"],["DOC Nº12 - A","12A"],["DOC Nº12A","12A"]];
  for(const [text,parsed] of cases){const [item]=extract(text);assert.equal(item.raw_value,text);assert.equal(item.rule_key,"local-attachment-doc-v2");assert.equal(item.parsed_attachment_number,parsed);}
  assert.deepEqual(extract("Doc nº1 a 7").map(x=>[x.raw_value,x.rule_key]),[["Doc nº1","local-attachment-doc-v2"],["7","local-attachment-range-v1"]]);
  assert.equal(extract("DOC Nº12 e outro")[0].raw_value,"DOC Nº12");
});

test("folio coordinated continuations preserve inherited provenance and verso",()=>{
  const items=extract("fls.25 e 26v.");assert.deepEqual(items.map(x=>x.raw_value),["fls.25","26v."]);const second=items[1];assert.equal(second.rule_key,"physical-folio-coordination-v1");assert.equal(second.parsed_folio,"26");assert.equal(second.parsed_folio_side,"verso");assert.equal(second.label_provenance.preceding_value,"25");assert.equal(second.label_provenance.coordination_cue,"e");
  assert.deepEqual(extract("fls.837 e 838").map(x=>x.raw_value),["fls.837","838"]);
});

test("compact folio and attachment ranges emit separate second endpoints",()=>{
  const folios=extract("fls.1102/1103");assert.deepEqual(folios.map(x=>x.raw_value),["fls.1102","1103"]);assert.equal(folios[1].rule_key,"physical-folio-compact-range-v1");assert.equal(folios[1].label_provenance.range_cue,"/");
  const docs=extract("Doc nº1 a 7");assert.deepEqual(docs.map(x=>x.raw_value),["Doc nº1","7"]);assert.equal(docs[1].label_provenance.preceding_value,"1");
});

test("continuations require a directly preceding supported label",()=>{
  assert.deepEqual(extractLabelledReferences("25 e 26v.; 1102/1103; 1 a 7"),[]);
});

test("v5-only unrelated rules remain available",()=>{
  const items=extractLabelledReferences("sob a ref. 105398957; Registo: 702380056723040; fls.490");
  assert.deepEqual(items.map(x=>x.rule_key),["cited-reference-labelled-v3","external-register-colon-v1","physical-folio-fls-v1"]);
});

test("v6 emits Unicode code-point offsets after astral characters",()=>{
  const [item]=extract("😀 Referência: AB-12");
  assert.equal(item.char_start,14);assert.equal(item.char_end,19);
  assert.equal(item.label_provenance.label_char_start,2);assert.equal(item.label_provenance.label_char_end,12);
});
