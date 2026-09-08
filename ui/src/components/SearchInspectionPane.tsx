import { useEffect, useRef, useState } from "react";
import {
  Alert, Box, Button, Chip, CircularProgress, Divider, Paper, Stack, Typography,
} from "@mui/material";
import { Link as RouterLink } from "react-router-dom";

import { getBinaryDetail, lookupRecordedReferences } from "../api/consultation";
import type {
  BinaryDetailResponse, RecordedReferenceContext, RecordedReferenceObservation,
  RecordedReferenceScope, ReferenceSourceContext,
} from "../types/consultation";
import { getShortSha, isPdfBinary, normalizeStableId } from "../utils/consultation";
import { InspectionViewer } from "./InspectionViewer";

export interface SearchInspectionContext {
  process_number: string | null;
  occurrence_reference: string | null;
  occurrence_date: string | null;
  document_reference: string | null;
  document_id: number | null;
  bucket_document_id: number | null;
  file_availability: "available" | "missing" | "unknown";
  binary_sha256s: string[];
}

export type SearchInspectionTarget =
  | { kind: "binary"; id: string; sha256: string; title?: string | null }
  | { kind: "context"; id: string; context: SearchInspectionContext }
  | { kind: "reference"; id: string; value: string; scope: RecordedReferenceScope };

export function inspectionContext(
  context: RecordedReferenceContext | ReferenceSourceContext,
  binarySha256s: string[] = [],
): SearchInspectionContext {
  return {
    process_number: context.process_number ?? null,
    occurrence_reference: context.occurrence_reference ?? null,
    occurrence_date: context.occurrence_date ?? null,
    document_reference: context.document_reference ?? null,
    document_id: context.document_id ?? null,
    bucket_document_id: context.bucket_document_id ?? null,
    file_availability: "file_availability" in context ? context.file_availability : binarySha256s.length ? "available" : "unknown",
    binary_sha256s: "binary_sha256s" in context ? context.binary_sha256s : binarySha256s,
  };
}

function formatDate(value: string | null) {
  if (!value) return "Date unavailable";
  const match = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(value);
  return (match ? new Date(+match[1], +match[2] - 1, +match[3]) : new Date(value)).toLocaleDateString();
}

const ignoreViewedRepresentation = () => undefined;

function BinaryInspection({ target, initialSearchTerm, onCollapse }: { target: Extract<SearchInspectionTarget, { kind: "binary" }>; initialSearchTerm: string; onCollapse: () => void }) {
  const [detail, setDetail] = useState<BinaryDetailResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setDetail(null);
    setError(null);
    void getBinaryDetail(target.sha256)
      .then((value) => { if (active) setDetail(value); })
      .catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : String(reason)); });
    return () => { active = false; };
  }, [target.sha256]);

  if (error) return <Alert severity="error">Could not load document inspection: {error}</Alert>;
  if (!detail) return <Stack alignItems="center" spacing={1.5} sx={{ py: 6 }}><CircularProgress /><Typography color="text.secondary">Loading document…</Typography></Stack>;

  return <Stack spacing={1.5} sx={{ height: "100%", minHeight: 0, overflow: "hidden" }}>
    <Box sx={{ flex: 1, minHeight: 0, overflow: "hidden" }}><InspectionViewer
      key={detail.binary.sha256}
      interpretations={detail.representations.items}
      evidence={detail.evidence?.items ?? []}
      effectiveRepresentationId={normalizeStableId(detail.representations.effective?.representation_id)}
      initialCategory={isPdfBinary(detail) ? "original" : "evidence"}
      originalPdf={isPdfBinary(detail) ? { url: detail.binary.original_binary_url, preferNativeViewer: true } : undefined}
      height="100%"
      onViewedRepresentationChange={ignoreViewedRepresentation}
      initialSearchTerm={initialSearchTerm}
      onCloseInspection={onCollapse}
    /></Box>
    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ flexShrink: 0 }}>
      <Button component={RouterLink} to={`/binaries/${detail.binary.sha256}`} target="_blank" rel="noopener noreferrer" size="small">Open full document detail</Button>
      <Button component={RouterLink} to={`/open-original/${detail.binary.sha256}`} target="_blank" rel="noopener noreferrer" size="small">Open file in new tab</Button>
    </Stack>
  </Stack>;
}

function ContextInspection({ target, onNavigate }: {
  target: Extract<SearchInspectionTarget, { kind: "context" }>;
  onNavigate: (target: SearchInspectionTarget) => void;
}) {
  const context = target.context;
  return <Stack spacing={2}>
    <Box><Typography variant="h6">Related procedural context</Typography><Typography color="text.secondary">Source-recorded context; not a resolved reference target.</Typography></Box>
    <Divider />
    <Stack spacing={0.75}>
      <Typography fontWeight={700}>{context.process_number ?? "Process unavailable"}</Typography>
      <Typography>Occurrence {context.occurrence_reference ?? "unavailable"}</Typography>
      <Typography>{formatDate(context.occurrence_date)}</Typography>
      <Typography variant="body2" sx={{ overflowWrap: "anywhere" }}>Source document: {context.document_reference ?? context.document_id ?? "unavailable"}</Typography>
      <Chip size="small" sx={{ alignSelf: "flex-start" }} label={`File ${context.file_availability}`} />
    </Stack>
    {context.binary_sha256s.length ? <Stack spacing={1}>
      <Typography fontWeight={700}>Available documents</Typography>
      {context.binary_sha256s.map((sha256) => <Stack key={sha256} direction="row" spacing={1} alignItems="center">
        <Button variant="outlined" size="small" onClick={() => onNavigate({ kind: "binary", id: `binary:${sha256}`, sha256 })}>Inspect {getShortSha(sha256)}</Button>
        <Button component={RouterLink} to={`/binaries/${sha256}`} target="_blank" rel="noopener noreferrer" size="small">New tab</Button>
      </Stack>)}
    </Stack> : <Alert severity="info">No available binary is associated with this context.</Alert>}
  </Stack>;
}

function observationAnchor(item: RecordedReferenceObservation) {
  const anchor = item.direct_anchor;
  if (anchor.kind === "occurrence") return `Occurrence ${anchor.occurrence_reference ?? "unavailable"}`;
  if (anchor.kind === "document_text") return `${anchor.processor_key ?? "Document text"} · ${anchor.page_no ? `page ${anchor.page_no}` : "page unavailable"}`;
  if (anchor.kind === "document") return `Source document ${anchor.document_reference ?? anchor.document_id ?? "unavailable"}`;
  if (anchor.kind === "case_file") return `Case ${anchor.process_number ?? "unavailable"}`;
  return `External source ${anchor.external_source_name ?? "unavailable"}`;
}

function ReferenceInspection({ target, onNavigate }: {
  target: Extract<SearchInspectionTarget, { kind: "reference" }>;
  onNavigate: (target: SearchInspectionTarget) => void;
}) {
  const request = useRef(0);
  const [items, setItems] = useState<RecordedReferenceObservation[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const current = ++request.current;
    setLoading(true); setError(null); setItems([]);
    void lookupRecordedReferences(target.value, { scope: target.scope, lifecycle: "current", limit: 50, offset: 0 })
      .then((response) => { if (request.current === current) setItems(response.observations); })
      .catch((reason) => { if (request.current === current) setError(reason instanceof Error ? reason.message : String(reason)); })
      .finally(() => { if (request.current === current) setLoading(false); });
  }, [target.scope, target.value]);

  return <Stack spacing={1.5}>
    <Box><Typography variant="h6">Recorded references for {target.value}</Typography><Typography color="text.secondary">Observations and contexts remain unresolved.</Typography></Box>
    {loading ? <CircularProgress size={26} /> : null}
    {error ? <Alert severity="error">Recorded-reference lookup failed: {error}</Alert> : null}
    {!loading && !error && items.length === 0 ? <Alert severity="info">No matches within the declared {target.scope} reference coverage.</Alert> : null}
    {items.map((item) => <Paper variant="outlined" sx={{ p: 1.5 }} key={item.observation_key}><Stack spacing={1}>
      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap><Chip size="small" label={item.origin.replaceAll("_", " ")} /><Chip size="small" variant="outlined" label={item.lifecycle.state} /></Stack>
      <Typography fontWeight={700}>{observationAnchor(item)}</Typography>
      <Typography variant="caption">{item.provenance.observer_key} {item.provenance.observer_version} · resolution {item.human_review?.resolution_state ?? "unresolved"}</Typography>
      {item.associated_contexts.map((context, index) => <Button key={`${context.document_id}:${context.bucket_id}:${index}`} variant="text" size="small" sx={{ justifyContent: "flex-start" }} onClick={() => onNavigate({ kind: "context", id: `context:${item.observation_key}:${index}`, context: inspectionContext(context) })}>Inspect context · {context.process_number ?? "process unavailable"} · {context.occurrence_reference ?? "occurrence unavailable"}</Button>)}
      {item.associated_binaries.map((binary) => <Button key={binary.sha256} variant="outlined" size="small" sx={{ alignSelf: "flex-start" }} onClick={() => onNavigate({ kind: "binary", id: `binary:${binary.sha256}`, sha256: binary.sha256 })}>Inspect document · {getShortSha(binary.sha256)}</Button>)}
    </Stack></Paper>)}
  </Stack>;
}

export function SearchInspectionPane({ target, initialSearchTerm, collapsed, onToggleCollapsed, onNavigate }: {
  target: SearchInspectionTarget | null;
  initialSearchTerm: string;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onNavigate: (target: SearchInspectionTarget) => void;
}) {
  if (collapsed) {
    return <Paper elevation={0} sx={{ border: "1px solid", borderColor: "divider", height: "100%", minHeight: 0, overflow: "hidden" }}>
      <Button fullWidth onClick={onToggleCollapsed} aria-label="Expand inspection" sx={{ height: "100%", minWidth: 0, px: 0.5, writingMode: "vertical-rl", transform: "rotate(180deg)", gap: 1 }}>Inspection ‹</Button>
    </Paper>;
  }

  return <Paper elevation={0} sx={{ border: "1px solid", borderColor: "divider", p: 2, height: "100%", minHeight: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}>
    {target?.kind !== "binary" ? <Stack direction="row" alignItems="center" sx={{ mb: 1 }}><Typography variant="overline" fontWeight={800} sx={{ flexGrow: 1 }}>Inspect</Typography><Button size="small" aria-label="Collapse inspection" onClick={onToggleCollapsed}>×</Button></Stack> : null}
    <Box sx={{ minHeight: 0, flex: 1, overflow: target?.kind === "binary" ? "hidden" : "auto" }}>
      {!target ? <Stack alignItems="center" justifyContent="center" spacing={1} sx={{ minHeight: 320, textAlign: "center", px: 3 }}><Typography variant="h6">Select a result to inspect</Typography><Typography color="text.secondary">Open a document, reference, or procedural context without leaving the search.</Typography></Stack> : null}
      {target?.kind === "binary" ? <BinaryInspection target={target} initialSearchTerm={initialSearchTerm} onCollapse={onToggleCollapsed} /> : null}
      {target?.kind === "context" ? <ContextInspection target={target} onNavigate={onNavigate} /> : null}
      {target?.kind === "reference" ? <ReferenceInspection target={target} onNavigate={onNavigate} /> : null}
    </Box>
  </Paper>;
}
