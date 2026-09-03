import { Fragment, FormEvent, useMemo, useRef, useState } from "react";
import {
  Accordion, AccordionDetails, AccordionSummary, Alert, Box, Button, Chip,
  CircularProgress, FormControl, InputLabel, MenuItem, Paper, Select, Stack,
  TextField, ToggleButton, ToggleButtonGroup, Typography,
} from "@mui/material";
import { Link as RouterLink } from "react-router-dom";

import { lookupRecordedReferences, searchText } from "../api/consultation";
import type {
  RecordedReferenceLifecycle, RecordedReferenceLookupResponse,
  RecordedReferenceObservation, RecordedReferenceScope,
  ReferenceObservationView, ReferenceTextSearchResponse,
} from "../types/consultation";
import { getReferenceLocationLabel, getShortSha, groupReferenceTextHits } from "../utils/consultation";
import { mergeTextSearchHits } from "../utils/textSearchPagination";
import { getTextHitReferenceRows } from "../utils/textHitReferences";
import {
  beginTextOrderReplacement, completeTextOrderReplacement,
  failTextOrderReplacement, isCurrentSectionRequest, participatingSections,
} from "../utils/multiMethodSearchState";

type Method = "document_text" | "recorded_references" | "both";
type Sort = "relevance" | "earliest_occurrence_asc" | "latest_occurrence_desc";
type Status = "idle" | "loading" | "success" | "failure";
interface Submitted { generation: number; query: string; method: Method; scope: RecordedReferenceScope; lifecycle: RecordedReferenceLifecycle }
interface TextState { status: Status; data: ReferenceTextSearchResponse | null; error: string | null; more: boolean; moreError: string | null; next: number; hasMore: boolean; displayedSort: Sort; requestedSort: Sort; sorting: boolean; sortError: string | null }
interface RefState { status: Status; data: RecordedReferenceLookupResponse | null; error: string | null; more: boolean; moreError: string | null; next: number; hasMore: boolean }

const emptyText = (): TextState => ({ status: "idle", data: null, error: null, more: false, moreError: null, next: 0, hasMore: false, displayedSort: "relevance", requestedSort: "relevance", sorting: false, sortError: null });
const emptyRefs = (): RefState => ({ status: "idle", data: null, error: null, more: false, moreError: null, next: 0, hasMore: false });
const hasText = (method: Method) => participatingSections(method).text;
const hasRefs = (method: Method) => participatingSections(method).references;
const message = (error: unknown) => error instanceof Error ? error.message : String(error);
const sortLabel = (sort: Sort) => ({ relevance: "Relevance", earliest_occurrence_asc: "Earliest occurrence", latest_occurrence_desc: "Latest occurrence" })[sort];
function formatDate(value: string | null) {
  if (!value) return "Date unavailable";
  const match = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(value);
  return (match ? new Date(+match[1], +match[2] - 1, +match[3]) : new Date(value)).toLocaleDateString();
}

function Coverage() {
  return <Accordion disableGutters elevation={0} sx={{ border: "1px solid", borderColor: "divider" }}>
    <AccordionSummary expandIcon={<span>›</span>}><Typography fontWeight={700}>About search coverage</Typography></AccordionSummary>
    <AccordionDetails><Typography variant="body2">Court-system metadata is searchable corpus-wide. External-register observations and references extracted from documents remain pilot-limited. Text and recorded-reference coverage are independent.</Typography></AccordionDetails>
  </Accordion>;
}

function HighlightedText({ value }: { value: string }) {
  const parts = value.split(/(\[\[|\]\])/u);
  let selected = false;
  return <Typography variant="body2" sx={{ whiteSpace: "pre-wrap", lineHeight: 1.65 }}>{parts.map((part, index) => {
    if (part === "[[") { selected = true; return null; }
    if (part === "]]" ) { selected = false; return null; }
    return selected ? <Box component="mark" key={index} sx={{ bgcolor: "warning.light" }}>{part}</Box> : <Fragment key={index}>{part}</Fragment>;
  })}</Typography>;
}

function TextReferenceRow({ item, contextual, scope }: {
  item: ReferenceObservationView;
  contextual?: boolean;
  scope: RecordedReferenceScope;
}) {
  const request = useRef(0);
  const [lookup, setLookup] = useState<RefState>(emptyRefs);
  const [expanded, setExpanded] = useState(false);

  async function load(initial: boolean) {
    const requestId = ++request.current;
    const offset = initial ? 0 : lookup.next;
    setExpanded(true);
    setLookup((old) => initial
      ? { ...emptyRefs(), status: "loading" }
      : { ...old, more: true, moreError: null });
    try {
      const page = await lookupRecordedReferences(item.observation.raw_value, {
        scope, lifecycle: "current", limit: 50, offset,
      });
      if (request.current !== requestId) return;
      setLookup((old) => {
        const prior = initial ? [] : old.data?.observations ?? [];
        const seen = new Set(prior.map((entry) => entry.observation_key));
        return {
          status: "success",
          data: initial ? page : { ...page, observations: [...prior, ...page.observations.filter((entry) => !seen.has(entry.observation_key))] },
          error: null, more: false, moreError: null,
          next: page.pagination.next_offset ?? offset,
          hasMore: page.pagination.has_more,
        };
      });
    } catch (error) {
      if (request.current !== requestId) return;
      if (initial) setLookup({ ...emptyRefs(), status: "failure", error: message(error) });
      else setLookup((old) => ({ ...old, more: false, moreError: message(error) }));
    }
  }

  function close() {
    ++request.current;
    setExpanded(false);
    setLookup(emptyRefs());
  }

  return <Paper variant="outlined" sx={{ p: 1.5 }}><Stack spacing={0.75}>
    <Typography fontWeight={700}>{item.observation.raw_label ? `${item.observation.raw_label}: ` : ""}{item.observation.raw_value}</Typography>
    <Typography variant="caption" color="text.secondary">
      {contextual ? "Contextual observation" : "Observed in matching passage"} · {getReferenceLocationLabel(item.observation.location.kind, item.observation.location.pdf_page, "reference")}
    </Typography>
    <Typography variant="caption">Processor: {String(item.observation.provenance.processor_key ?? "unavailable")} {String(item.observation.provenance.processor_version ?? "")}</Typography>
    {!expanded ? <Button variant="outlined" size="small" onClick={() => void load(true)} sx={{ alignSelf: "flex-start" }}>Find recorded references</Button> : null}
    {expanded ? <Paper variant="outlined" sx={{ p: 1.5, bgcolor: "background.default" }}><Stack spacing={1.25}>
      <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" spacing={1}>
        <Typography fontWeight={700}>Recorded references for {item.observation.raw_value}</Typography>
        <Button size="small" onClick={close} sx={{ alignSelf: "flex-start" }}>Close lookup</Button>
      </Stack>
      {lookup.status === "loading" ? <CircularProgress size={24} /> : null}
      {lookup.status === "failure" ? <Alert severity="error" action={<Button color="inherit" onClick={() => void load(true)}>Retry</Button>}>Recorded-reference lookup failed: {lookup.error}</Alert> : null}
      {lookup.data && lookup.data.result_state !== "matches" ? <Alert severity="info">No recorded-reference matches within the declared {scope} coverage. This does not mean the document is absent.</Alert> : null}
      {lookup.data?.observations.map((observation) => <ReferenceCard key={observation.observation_key} item={observation} />)}
      {lookup.moreError ? <Alert severity="error">Loading more recorded references failed: {lookup.moreError}. Existing results were preserved.</Alert> : null}
      {lookup.data && lookup.hasMore ? <Button variant="outlined" disabled={lookup.more} onClick={() => void load(false)} sx={{ alignSelf: "center" }}>{lookup.more ? <CircularProgress size={22} /> : "Load more recorded references"}</Button> : null}
    </Stack></Paper> : null}
  </Stack></Paper>;
}

function ReferenceCard({ item }: { item: RecordedReferenceObservation }) {
  const anchor = item.direct_anchor;
  const anchorText = anchor.kind === "occurrence" ? `Occurrence ${anchor.occurrence_reference ?? "unavailable"} · ${anchor.process_number ?? "process unavailable"}`
    : anchor.kind === "case_file" ? `Case ${anchor.process_number ?? "unavailable"}`
      : anchor.kind === "document" ? `Source document ${anchor.document_reference ?? anchor.document_id ?? "unavailable"}`
        : anchor.kind === "document_text" ? `Document text · ${anchor.processor_key ?? "processor unavailable"}${anchor.page_no ? ` · page ${anchor.page_no}` : " · page unavailable"}`
          : `External source · ${anchor.external_source_name ?? "unavailable"}`;
  return <Paper variant="outlined" sx={{ p: 2 }}><Stack spacing={1.25}>
    <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ sm: "center" }}>
      <Typography variant="h6" sx={{ overflowWrap: "anywhere" }}>{item.reference.raw_value}</Typography>
      <Chip size="small" label={item.reference.identifier_type ?? "unclassified reference"} />
      <Chip size="small" variant="outlined" label={item.origin.replaceAll("_", " ")} />
      <Chip size="small" variant="outlined" label={item.lifecycle.state} />
    </Stack>
    <Typography variant="body2" fontWeight={600}>{anchorText}</Typography>
    <Typography variant="caption" color="text.secondary">Direct anchor · {item.provenance.source_field ?? item.provenance.observed_in_kind}</Typography>
    {item.associated_contexts.length ? <Accordion disableGutters elevation={0}>
      <AccordionSummary expandIcon={<span>›</span>} sx={{ px: 0 }}><Typography variant="body2">{item.associated_contexts.length} associated context{item.associated_contexts.length === 1 ? "" : "s"}</Typography></AccordionSummary>
      <AccordionDetails sx={{ px: 0 }}><Stack spacing={1}>{item.associated_contexts.map((context, index) => <Box key={`${context.bucket_document_id}-${index}`}>
        <Typography variant="body2" fontWeight={600}>{context.process_number ?? "Process unavailable"} · {context.occurrence_reference ?? "occurrence unavailable"}</Typography>
        <Typography variant="caption" display="block">{formatDate(context.occurrence_date)} · file {context.file_availability}</Typography>
        {context.document_reference ? <Typography variant="caption" sx={{ overflowWrap: "anywhere" }}>Source document reference: {context.document_reference}</Typography> : null}
      </Box>)}</Stack></AccordionDetails>
    </Accordion> : <Typography variant="body2" color="text.secondary">No associated procedural occurrence.</Typography>}
    {item.associated_binaries.length ? <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>{item.associated_binaries.map((binary) =>
      <Button key={binary.sha256} component={RouterLink} to={`/binaries/${binary.sha256}`} target="_blank" rel="noopener noreferrer" variant="outlined" size="small">Open original PDF · {getShortSha(binary.sha256)}</Button>)}</Stack>
      : item.binary_association_state === "all_associated_files_missing" ? <Alert severity="info">Source record retained; the original file was unavailable.</Alert> : null}
    <Accordion disableGutters elevation={0}><AccordionSummary expandIcon={<span>›</span>} sx={{ px: 0 }}><Typography variant="subtitle2">Provenance and review</Typography></AccordionSummary>
      <AccordionDetails sx={{ px: 0 }}><Stack spacing={0.5}>
        <Typography variant="body2">Review: {item.human_review?.review_state ?? item.ingestion_assessment.review_state}</Typography>
        <Typography variant="body2">Resolution: {item.human_review?.resolution_state ?? "unresolved"}</Typography>
        <Typography variant="caption">Observer: {item.provenance.observer_key} {item.provenance.observer_version}</Typography>
        <Typography variant="caption" sx={{ overflowWrap: "anywhere" }}>Observation: {item.observation_key}</Typography>
        {item.lifecycle.current_observation_key && item.lifecycle.current_observation_key !== item.observation_key ? <Typography variant="caption" sx={{ overflowWrap: "anywhere" }}>Current replacement: {item.lifecycle.current_observation_key}</Typography> : null}
        <Typography variant="caption">Ingestion candidates: {item.ingestion_assessment.target_candidates.length} · reviewed candidates: {item.human_review?.target_candidates.length ?? 0}</Typography>
      </Stack></AccordionDetails></Accordion>
  </Stack></Paper>;
}

export function ReferenceSearchPage() {
  const generation = useRef(0), textRequest = useRef(0), refRequest = useRef(0);
  const [method, setMethod] = useState<Method>("document_text");
  const [scope, setScope] = useState<RecordedReferenceScope>("full");
  const [lifecycle, setLifecycle] = useState<RecordedReferenceLifecycle>("current");
  const [query, setQuery] = useState("105398957");
  const [submitted, setSubmitted] = useState<Submitted | null>(null);
  const [text, setText] = useState<TextState>(emptyText);
  const [refs, setRefs] = useState<RefState>(emptyRefs);
  const groups = useMemo(() => groupReferenceTextHits(text.data?.items ?? []), [text.data]);
  const currentText = (g: number, r: number) => isCurrentSectionRequest(generation.current, textRequest.current, g, r);
  const currentRef = (g: number, r: number) => isCurrentSectionRequest(generation.current, refRequest.current, g, r);

  async function initialText(search: Submitted, sort: Sort = "relevance") {
    const request = ++textRequest.current;
    setText({ ...emptyText(), status: "loading", displayedSort: sort, requestedSort: sort });
    try {
      const data = await searchText(search.query, { limit: 20, offset: 0, scope: search.scope, sort });
      if (!currentText(search.generation, request)) return;
      setText({ status: "success", data, error: null, more: false, moreError: null, next: data.result_summary.next_offset, hasMore: data.result_summary.has_more, displayedSort: sort, requestedSort: sort, sorting: false, sortError: null });
    } catch (error) { if (currentText(search.generation, request)) setText({ ...emptyText(), status: "failure", error: message(error) }); }
  }
  async function initialRefs(search: Submitted) {
    const request = ++refRequest.current;
    setRefs({ ...emptyRefs(), status: "loading" });
    try {
      const data = await lookupRecordedReferences(search.query, { scope: search.scope, lifecycle: search.lifecycle, limit: 50, offset: 0 });
      if (!currentRef(search.generation, request)) return;
      setRefs({ status: "success", data, error: null, more: false, moreError: null, next: data.pagination.next_offset ?? 0, hasMore: data.pagination.has_more });
    } catch (error) { if (currentRef(search.generation, request)) setRefs({ ...emptyRefs(), status: "failure", error: message(error) }); }
  }
  function start(nextMethod: Method, value: string) {
    const snapshot = { generation: ++generation.current, query: value, method: nextMethod, scope, lifecycle };
    ++textRequest.current; ++refRequest.current;
    setSubmitted(snapshot); setText(emptyText()); setRefs(emptyRefs());
    if (hasText(nextMethod)) void initialText(snapshot);
    if (hasRefs(nextMethod)) void initialRefs(snapshot);
  }
  function submit(event: FormEvent) { event.preventDefault(); const value = query.trim(); if (value) start(method, value); }

  async function sortText(nextSort: Sort) {
    if (!submitted || !text.data || text.sorting) return;
    const request = ++textRequest.current;
    setText((old) => ({ ...old, ...beginTextOrderReplacement(old, nextSort), more: false }));
    try {
      const data = await searchText(submitted.query, { limit: 20, offset: 0, scope: submitted.scope, sort: nextSort });
      if (!currentText(submitted.generation, request)) return;
      setText((old) => ({ ...old, ...completeTextOrderReplacement(old), data, next: data.result_summary.next_offset, hasMore: data.result_summary.has_more }));
    } catch (error) { if (currentText(submitted.generation, request)) setText((old) => ({ ...old, ...failTextOrderReplacement(old, message(error)) })); }
  }
  async function moreText() {
    if (!submitted || !text.data || !text.hasMore || text.more || text.sorting) return;
    const request = ++textRequest.current, offset = text.next, sort = text.displayedSort;
    setText((old) => ({ ...old, more: true, moreError: null }));
    try {
      const page = await searchText(submitted.query, { limit: 20, offset, scope: submitted.scope, sort });
      if (!currentText(submitted.generation, request)) return;
      setText((old) => ({ ...old, data: old.data ? { ...page, items: mergeTextSearchHits(old.data.items, page.items) } : page, more: false, next: page.result_summary.next_offset, hasMore: page.result_summary.has_more }));
    } catch (error) { if (currentText(submitted.generation, request)) setText((old) => ({ ...old, more: false, moreError: message(error) })); }
  }
  async function moreRefs() {
    if (!submitted || !refs.data || !refs.hasMore || refs.more) return;
    const request = ++refRequest.current, offset = refs.next;
    setRefs((old) => ({ ...old, more: true, moreError: null }));
    try {
      const page = await lookupRecordedReferences(submitted.query, { scope: submitted.scope, lifecycle: submitted.lifecycle, limit: 50, offset });
      if (!currentRef(submitted.generation, request)) return;
      setRefs((old) => { const seen = new Set(old.data?.observations.map((x) => x.observation_key) ?? []); return { ...old, data: old.data ? { ...page, observations: [...old.data.observations, ...page.observations.filter((x) => !seen.has(x.observation_key))] } : page, more: false, next: page.pagination.next_offset ?? offset, hasMore: page.pagination.has_more }; });
    } catch (error) { if (currentRef(submitted.generation, request)) setRefs((old) => ({ ...old, more: false, moreError: message(error) })); }
  }

  return <Stack spacing={2.5}>
    <Box><Typography variant="h4" gutterBottom>Reference and text search</Typography><Typography color="text.secondary">Search extracted text and source-recorded references without merging their meanings.</Typography></Box>
    <Coverage />
    <Paper component="form" onSubmit={submit} elevation={0} sx={{ p: 2.5 }}><Stack spacing={2}>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}><TextField fullWidth value={query} onChange={(e) => setQuery(e.target.value)} label="Search terms or reference" helperText="Changes take effect when you select Search." /><Button type="submit" variant="contained" disabled={!query.trim()} sx={{ minWidth: 120, height: 56 }}>Search</Button></Stack>
      <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems={{ md: "center" }}>
        <FormControl size="small" sx={{ minWidth: 210 }}><InputLabel id="method-label">Search in</InputLabel><Select labelId="method-label" label="Search in" value={method} onChange={(e) => setMethod(e.target.value as Method)}><MenuItem value="document_text">Document text</MenuItem><MenuItem value="recorded_references">Recorded references</MenuItem><MenuItem value="both">Both</MenuItem></Select></FormControl>
        <Stack direction="row" spacing={1} alignItems="center"><Typography variant="body2" fontWeight={600}>Collection</Typography><ToggleButtonGroup exclusive value={scope} onChange={(_e, next: RecordedReferenceScope | null) => { if (next) setScope(next); }} size="small"><ToggleButton value="full">Full corpus</ToggleButton><ToggleButton value="pilot">Pilot</ToggleButton></ToggleButtonGroup></Stack>
        {hasRefs(method) ? <FormControl size="small" sx={{ minWidth: 190 }}><InputLabel id="history-label">Reference history</InputLabel><Select labelId="history-label" label="Reference history" value={lifecycle} onChange={(e) => setLifecycle(e.target.value as RecordedReferenceLifecycle)}><MenuItem value="current">Current only</MenuItem><MenuItem value="include_history">Include history</MenuItem></Select></FormControl> : null}
      </Stack>
    </Stack></Paper>
    {submitted ? <Typography variant="h5">Results for “{submitted.query}” · {submitted.scope === "full" ? "Full corpus" : "Pilot"}</Typography> : null}

    {submitted && hasRefs(submitted.method) ? <Stack spacing={1.5}>
      <Typography variant="h6">Recorded references</Typography>
      {refs.status === "loading" ? <CircularProgress size={28} /> : null}
      {refs.status === "failure" ? <Alert severity="error" action={<Button color="inherit" onClick={() => void initialRefs(submitted)}>Retry</Button>}>Recorded-reference lookup failed: {refs.error}</Alert> : null}
      {refs.data ? <Typography variant="body2" color="text.secondary">{refs.data.observations.length} observations loaded · {refs.hasMore ? "More available" : "All loaded"}</Typography> : null}
      {refs.data && refs.data.result_state !== "matches" ? <Alert severity="info">{refs.data.result_state === "no_matches_within_coverage" ? "No recorded-reference matches within the declared coverage." : "No matches were returned, and coverage is incomplete."} This does not mean the document is absent.</Alert> : null}
      {refs.data?.coverage.limitations.map((x) => <Alert severity="info" key={x.code}>{x.message}</Alert>)}
      {refs.data?.observations.map((x) => <ReferenceCard key={x.observation_key} item={x} />)}
      {refs.moreError ? <Alert severity="error">Loading more recorded references failed: {refs.moreError}. Existing results were preserved.</Alert> : null}
      {refs.data && refs.hasMore ? <Button variant="outlined" disabled={refs.more} onClick={() => void moreRefs()} sx={{ alignSelf: "center" }}>{refs.more ? <CircularProgress size={22} /> : "Load more recorded references"}</Button> : null}
    </Stack> : null}

    {submitted && hasText(submitted.method) ? <Stack spacing={1.5}>
      <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" alignItems={{ md: "center" }}>
        <Box><Typography variant="h6">Document text</Typography>{text.data ? <Typography variant="body2" color="text.secondary">{groups.length} PDFs · {text.data.items.length} passages · displayed order: {sortLabel(text.displayedSort)}</Typography> : null}</Box>
        {text.data ? <FormControl size="small" sx={{ minWidth: 220 }}><InputLabel id="sort-label">Text result order</InputLabel><Select labelId="sort-label" label="Text result order" value={text.requestedSort} disabled={text.sorting || text.more} onChange={(e) => void sortText(e.target.value as Sort)}><MenuItem value="relevance">Relevance</MenuItem><MenuItem value="earliest_occurrence_asc">Earliest occurrence</MenuItem><MenuItem value="latest_occurrence_desc">Latest occurrence</MenuItem></Select></FormControl> : null}
      </Stack>
      {text.status === "loading" ? <CircularProgress size={28} /> : null}
      {text.status === "failure" ? <Alert severity="error" action={<Button color="inherit" onClick={() => void initialText(submitted)}>Retry</Button>}>Document-text search failed: {text.error}</Alert> : null}
      {text.sorting ? <Alert severity="info">Loading {sortLabel(text.requestedSort)}. Current results remain displayed as {sortLabel(text.displayedSort)}.</Alert> : null}
      {text.sortError ? <Alert severity="error" action={<Button color="inherit" onClick={() => void sortText(text.requestedSort)}>Retry</Button>}>Could not load {sortLabel(text.requestedSort)}. Existing results remain in {sortLabel(text.displayedSort)} order.</Alert> : null}
      {text.data && groups.length === 0 ? <Alert severity="info">No document-text matches within this {submitted.scope === "full" ? "full corpus" : "pilot"} search. This does not mean the document is absent.</Alert> : null}
      {groups.map((group) => <Paper key={group.sha256} elevation={0} sx={{ p: 2.5, border: "1px solid rgba(31,79,95,0.14)" }}><Stack spacing={2}>
        <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between"><Box><Typography variant="h6">{group.source_contexts[0]?.document_name ?? group.source_contexts[0]?.designation ?? `PDF ${getShortSha(group.sha256)}`}</Typography>{text.displayedSort === "earliest_occurrence_asc" ? <Typography fontWeight={600}>{formatDate(group.hits[0].earliest_occurrence_date)} · Earliest recorded occurrence</Typography> : text.displayedSort === "latest_occurrence_desc" ? <Typography fontWeight={600}>{formatDate(group.hits[0].latest_occurrence_date)} · Latest recorded occurrence</Typography> : null}</Box><Button component={RouterLink} to={`/binaries/${group.sha256}`} target="_blank" rel="noopener noreferrer" variant="outlined" sx={{ alignSelf: "flex-start" }}>Open original PDF</Button></Stack>
        <HighlightedText value={group.hits[0].headline} /><Typography variant="caption">Extracted by {group.hits[0].processor_key} {group.hits[0].processor_version} · {getReferenceLocationLabel(group.hits[0].location.kind, group.hits[0].location.pdf_page)}</Typography>
        {group.hits.length > 1 ? <Accordion disableGutters><AccordionSummary expandIcon={<span>›</span>}>More matching passages ({group.hits.length - 1})</AccordionSummary><AccordionDetails><Stack spacing={1}>{group.hits.slice(1).map((hit) => <Paper variant="outlined" sx={{ p: 1.5 }} key={`${hit.document_representation_id}-${hit.segment_id}`}><Stack spacing={1}><Chip size="small" sx={{ alignSelf: "flex-start" }} label={`${hit.processor_key} ${hit.processor_version}`} /><HighlightedText value={hit.headline} /><Typography variant="caption">{getReferenceLocationLabel(hit.location.kind, hit.location.pdf_page)}</Typography>{getTextHitReferenceRows(hit).map(({ kind, item }) => <TextReferenceRow key={`${kind}-${item.observation.observation_key}`} item={item} contextual={kind === "contextual"} scope={submitted.scope} />)}</Stack></Paper>)}</Stack></AccordionDetails></Accordion> : null}
        <Accordion disableGutters><AccordionSummary expandIcon={<span>›</span>}>Source details</AccordionSummary><AccordionDetails><Stack spacing={1}>
          <Typography variant="caption" display="block">Full SHA-256: {group.sha256}</Typography>
          {group.source_contexts.map((context) => <Box key={`${context.bucket_document_id}-${context.document_id}`}><Typography variant="body2" fontWeight={600}>{context.process_number} · occurrence {context.occurrence_reference} · {formatDate(context.occurrence_date)}</Typography>{context.document_reference ? <Typography variant="caption" sx={{ overflowWrap: "anywhere" }}>Source document reference: {context.document_reference}</Typography> : null}</Box>)}
          {getTextHitReferenceRows(group.hits[0]).map(({ kind, item }) => <TextReferenceRow key={`${kind}-${item.observation.observation_key}`} item={item} contextual={kind === "contextual"} scope={submitted.scope} />)}
        </Stack></AccordionDetails></Accordion>
      </Stack></Paper>)}
      {text.moreError ? <Alert severity="error">Loading more text results failed: {text.moreError}. Existing results were preserved.</Alert> : null}
      {text.data && text.hasMore ? <Button variant="outlined" disabled={text.more || text.sorting} onClick={() => void moreText()} sx={{ alignSelf: "center" }}>{text.more ? <CircularProgress size={22} /> : "Load more document text"}</Button> : null}
    </Stack> : null}
  </Stack>;
}
