import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode, RefObject } from "react";
import ReactMarkdown from "react-markdown";
import {
  Alert,
  Autocomplete,
  Box,
  CircularProgress,
  IconButton,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
  createFilterOptions,
} from "@mui/material";

import { getRepresentationContent } from "../api/consultation";
import type { RepresentationListItem } from "../types/consultation";
import { getRepresentationLabel, sameStableId } from "../utils/consultation";

const PdfViewer = lazy(() => import("./PdfViewer").then((module) => ({ default: module.PdfViewer })));

export type InspectionCategory = "original" | "interpretation" | "evidence";

export interface InspectionOption {
  id: string;
  category: InspectionCategory;
  representation: RepresentationListItem | null;
  format: string;
  renderMode: "rendered" | "raw";
  label: string;
  searchText: string;
}

interface InspectionViewerProps {
  interpretations: RepresentationListItem[];
  evidence: RepresentationListItem[];
  effectiveRepresentationId: string | null;
  initialCategory?: InspectionCategory;
  height: string | Record<string, string>;
  onViewedRepresentationChange: (representation: RepresentationListItem | null) => void;
  originalPdf?: { url: string; preferNativeViewer?: boolean };
  initialSearchTerm?: string;
  onCloseInspection?: () => void;
}

const filterOptions = createFilterOptions<InspectionOption>({
  stringify: (option) => option.searchText,
});

function formatLabel(format: string, renderMode: "rendered" | "raw") {
  if (format === "markdown") return renderMode === "rendered" ? "Rendered markdown" : "Raw markdown";
  if (format === "native-json") return "Native JSON";
  if (format === "complete-text") return "Complete text";
  return format.charAt(0).toUpperCase() + format.slice(1);
}

export function buildInspectionOptions(category: InspectionCategory, representations: RepresentationListItem[]) {
  return representations.flatMap((representation) => representation.available_formats.flatMap((format) => {
    const modes: Array<"rendered" | "raw"> = format === "markdown" ? ["rendered", "raw"] : ["raw"];
    return modes.map((renderMode) => {
      const representationLabel = getRepresentationLabel(representation);
      const viewLabel = formatLabel(format, renderMode);
      return {
        id: `${category}:${representation.representation_id}:${format}:${renderMode}`,
        category,
        representation,
        format,
        renderMode,
        label: `${representationLabel} — ${viewLabel}`,
        searchText: `${category} ${representationLabel} ${representation.processor_key} ${representation.processor_version} ${format} ${viewLabel}`,
      };
    });
  }));
}

export function chooseInitialInspectionOption(
  options: InspectionOption[],
  initialCategory: InspectionCategory,
  effectiveRepresentationId: string | null,
) {
  const categoryOptions = options.filter((option) => option.category === initialCategory);
  return (
    initialCategory === "original"
      ? categoryOptions[0]
      : initialCategory === "evidence"
      ? categoryOptions.find((option) => (
          option.representation?.processor_key === "pdf_literal_text"
          && option.format === "text"
        ))
      : categoryOptions.find((option) => (
          sameStableId(option.representation?.representation_id, effectiveRepresentationId)
          && option.format === "markdown"
          && option.renderMode === "rendered"
        ))
  ) ?? categoryOptions[0] ?? options[0] ?? null;
}

function JsonView({ value }: { value: unknown }) {
  return <Box component="pre" sx={{ m: 0, whiteSpace: "pre-wrap", wordBreak: "break-word", fontSize: 13, lineHeight: 1.5 }}>
    {JSON.stringify(value, null, 2)}
  </Box>;
}

export interface InspectionMatch { start: number; end: number }
interface CrossViewMatch extends InspectionMatch { optionId: string; matchIndex: number }

export function findInspectionMatches(value: string, query: string): InspectionMatch[] {
  const needle = query.trim();
  if (!needle) return [];
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  return [...value.matchAll(new RegExp(escaped, "giu"))].map((match) => ({
    start: match.index,
    end: match.index + match[0].length,
  }));
}

export function orderInspectionSearchOptions(options: InspectionOption[], selectedOption: InspectionOption | null) {
  const searchable = options.filter((option) => option.category !== "original" && option.representation && !(option.format === "markdown" && option.renderMode === "rendered"));
  const selectedSearchId = selectedOption?.format === "markdown" && selectedOption.renderMode === "rendered"
    ? searchable.find((option) => option.representation?.representation_id === selectedOption.representation?.representation_id && option.format === "markdown")?.id
    : selectedOption?.id;
  const selectedIndex = searchable.findIndex((option) => option.id === selectedSearchId);
  const start = selectedIndex < 0 ? 0 : selectedIndex;
  return [...searchable.slice(start), ...searchable.slice(0, start)];
}

export function nextInspectionMatchCursor(current: number, step: number, count: number) {
  if (count <= 0) return -1;
  if (current < 0) return step < 0 ? count - 1 : 0;
  return ((current + step) % count + count) % count;
}

export function scrollInspectionMatch(container: HTMLElement, match: HTMLElement) {
  const target = match.getBoundingClientRect();
  const viewport = container.getBoundingClientRect();
  container.scrollTo({ top: container.scrollTop + target.top - viewport.top - container.clientTop - (container.clientHeight - target.height) / 2, behavior: "smooth" });
}

export function formatInspectionCreatedAt(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return "Creation date unavailable";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Creation date unavailable" : `Created ${date.toLocaleString()}`;
}

function SearchHighlightedText({ value, matches, current, containerRef }: { value: string; matches: InspectionMatch[]; current: number; containerRef: RefObject<HTMLDivElement | null> }) {
  const currentRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (currentRef.current && containerRef.current) scrollInspectionMatch(containerRef.current, currentRef.current);
  }, [current, value, matches, containerRef]);
  if (!matches.length) return <>{value}</>;
  const parts: ReactNode[] = [];
  let cursor = 0;
  matches.forEach((match, index) => {
    parts.push(value.slice(cursor, match.start));
    parts.push(<Box component="mark" key={`${match.start}:${match.end}`} ref={index === current ? currentRef : undefined} sx={{ bgcolor: index === current ? "#ffeb3b" : "#fff59d", color: "inherit", px: 0.15 }}>{value.slice(match.start, match.end)}</Box>);
    cursor = match.end;
  });
  parts.push(value.slice(cursor));
  return <>{parts}</>;
}

export function InspectionViewer({
  interpretations,
  evidence,
  effectiveRepresentationId,
  initialCategory = "evidence",
  height,
  onViewedRepresentationChange,
  originalPdf,
  initialSearchTerm = "",
  onCloseInspection,
}: InspectionViewerProps) {
  const options = useMemo(() => [
    ...(originalPdf ? [{
      id: "original:pdf",
      category: "original" as const,
      representation: null,
      format: "pdf",
      renderMode: "raw" as const,
      label: "Original PDF — canonical evidence",
      searchText: "original PDF canonical evidence",
    }] : []),
    ...buildInspectionOptions("evidence", evidence),
    ...buildInspectionOptions("interpretation", interpretations),
  ], [evidence, interpretations, originalPdf]);
  const [selectedId, setSelectedId] = useState("");
  const [content, setContent] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchDraft, setSearchDraft] = useState(initialSearchTerm);
  const [activeSearch, setActiveSearch] = useState("");
  const [currentMatch, setCurrentMatch] = useState(-1);
  const [searchingViews, setSearchingViews] = useState(false);
  const [searchMiss, setSearchMiss] = useState(false);
  const [crossViewMatches, setCrossViewMatches] = useState<CrossViewMatch[]>([]);
  const [crossViewCursor, setCrossViewCursor] = useState(-1);
  const searchRequest = useRef(0);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const selectedOption = options.find((option) => option.id === selectedId) ?? null;
  const searchableText = typeof content === "string" ? content : content === null ? "" : JSON.stringify(content, null, 2);
  const matches = useMemo(() => findInspectionMatches(searchableText, activeSearch), [activeSearch, searchableText]);
  const canSearch = options.some((option) => option.category !== "original" && option.representation);

  useEffect(() => {
    setSearchDraft(initialSearchTerm);
    setActiveSearch("");
    setCurrentMatch(-1);
    setSearchMiss(false);
    setCrossViewMatches([]);
    setCrossViewCursor(-1);
  }, [initialSearchTerm]);

  useEffect(() => {
    const selectedMatch = crossViewMatches[crossViewCursor];
    setCurrentMatch(selectedMatch?.optionId === selectedId ? selectedMatch.matchIndex : -1);
  }, [crossViewCursor, crossViewMatches, matches.length, selectedId]);

  useEffect(() => {
    if (selectedOption) return;
    const preferred = chooseInitialInspectionOption(options, initialCategory, effectiveRepresentationId);
    setSelectedId(preferred?.id ?? "");
  }, [effectiveRepresentationId, initialCategory, options, selectedOption]);

  useEffect(() => {
    onViewedRepresentationChange(selectedOption?.representation ?? null);
  }, [onViewedRepresentationChange, selectedOption]);

  useEffect(() => {
    if (!selectedOption || selectedOption.category === "original") {
      setContent(null);
      setError(null);
      return;
    }
    if (!selectedOption.representation) return;
    let active = true;
    setLoading(true);
    setError(null);
    setContent(null);
    void getRepresentationContent(selectedOption.representation.representation_id, selectedOption.format)
      .then((result) => { if (active) setContent(result.body); })
      .catch((loadError) => { if (active) setError(loadError instanceof Error ? loadError.message : String(loadError)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [selectedOption]);

  function selectOption(option: InspectionOption | null) {
    if (!option) return;
    let nextOption = option;
    if (activeSearch && option.format === "markdown" && option.renderMode === "rendered") {
      const rawOption = options.find((candidate) => candidate.representation?.representation_id === option.representation?.representation_id && candidate.format === "markdown" && candidate.renderMode === "raw");
      if (rawOption) {
        nextOption = rawOption;
      }
    }
    setSelectedId(nextOption.id);
    if (activeSearch) setCrossViewCursor(crossViewMatches.findIndex((match) => match.optionId === nextOption.id));
  }

  async function runSearch() {
    const value = searchDraft.trim();
    if (!value || !canSearch) return;
    const request = ++searchRequest.current;
    setSearchingViews(true);
    setSearchMiss(false);
    const ordered = orderInspectionSearchOptions(options, selectedOption);
    const found: CrossViewMatch[] = [];
    for (const option of ordered) {
      if (!option.representation) continue;
      try {
        const result = option.id === selectedOption?.id && searchableText
          ? searchableText
          : await getRepresentationContent(option.representation.representation_id, option.format).then((response) => typeof response.body === "string" ? response.body : JSON.stringify(response.body, null, 2));
        if (searchRequest.current !== request) return;
        findInspectionMatches(result, value).forEach((match, matchIndex) => found.push({ ...match, optionId: option.id, matchIndex }));
      } catch {
        // An unavailable view does not prevent searching the remaining attributed views.
      }
    }
    setActiveSearch(value);
    setCrossViewMatches(found);
    setCrossViewCursor(found.length ? 0 : -1);
    if (found.length) setSelectedId(found[0].optionId);
    setSearchMiss(found.length === 0);
    setSearchingViews(false);
  }

  function moveMatch(step: number) {
    if (!crossViewMatches.length) return;
    const next = nextInspectionMatchCursor(crossViewCursor, step, crossViewMatches.length);
    setCrossViewCursor(next);
    setSelectedId(crossViewMatches[next].optionId);
  }

  return <Paper elevation={0} sx={{ border: "1px solid rgba(31,79,95,0.12)", height, minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
    <Box sx={{ px: 2, py: 1, borderBottom: "1px solid rgba(31,79,95,0.12)", flexShrink: 0 }}>
      <Typography variant="overline" fontWeight={800}>Inspect</Typography>
      <Stack direction="row" spacing={0.25} alignItems="center">
        <TextField value={searchDraft} onChange={(event) => setSearchDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void runSearch(); } }} size="small" fullWidth placeholder="Find across available views" />
        <Tooltip title="Search available extracted views"><span><IconButton size="small" aria-label="Search available inspection views" disabled={!canSearch || !searchDraft.trim() || searchingViews} onClick={() => void runSearch()} sx={{ fontSize: "0.9rem" }}>{searchingViews ? <CircularProgress size={16} /> : "🔍"}</IconButton></span></Tooltip>
        <Tooltip title="Previous match across views"><span><IconButton size="small" aria-label="Previous inspection match across views" disabled={!crossViewMatches.length} onClick={() => moveMatch(-1)}>↑</IconButton></span></Tooltip>
        <Tooltip title="Next match across views"><span><IconButton size="small" aria-label="Next inspection match across views" disabled={!crossViewMatches.length} onClick={() => moveMatch(1)}>↓</IconButton></span></Tooltip>
        <Tooltip title="Clear and collapse inspection"><IconButton size="small" aria-label="Clear and collapse inspection" onClick={() => { ++searchRequest.current; setSearchDraft(""); setActiveSearch(""); setCurrentMatch(-1); setCrossViewMatches([]); setCrossViewCursor(-1); setSearchMiss(false); onCloseInspection?.(); }}>×</IconButton></Tooltip>
      </Stack>
      {searchMiss ? <Typography variant="caption" color="text.secondary">No match in the available readable views.</Typography> : null}
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1.5 }}>
      <Autocomplete
        fullWidth
        size="small"
        openOnFocus
        disableClearable
        options={options}
        value={selectedOption}
        onChange={(_event, option) => selectOption(option)}
        filterOptions={filterOptions}
        groupBy={(option) => option.category === "original" ? "Original" : option.category === "evidence" ? "Evidence" : "Interpretations"}
        getOptionLabel={(option) => option.label}
        isOptionEqualToValue={(option, value) => option.id === value.id}
        renderInput={(params) => <TextField {...params} label="Available views" placeholder="Type to filter" />}
        renderOption={(props, option) => <li {...props} key={option.id}>
          <Stack spacing={0.25} sx={{ py: 0.5 }}>
            <Typography variant="body2">{option.label}</Typography>
            {option.representation ? <Typography variant="caption" color="text.secondary">{option.representation.processor_version}</Typography> : null}
          </Stack>
        </li>}
        sx={{ flex: 1, minWidth: 0 }}
      />
      {activeSearch ? <Typography variant="caption" color="text.secondary" sx={{ minWidth: 76, textAlign: "right" }}>{matches.length ? `${currentMatch + 1}/${matches.length} in view` : "0/0 in view"}</Typography> : null}
      </Stack>
      {selectedOption?.representation ? <Stack direction="row" spacing={1} alignItems="center" sx={{ pt: 0.5 }}>
        <Typography variant="caption" color="text.secondary">
          {formatInspectionCreatedAt(selectedOption.representation.created_at)}
        </Typography>
      </Stack> : null}
    </Box>
    <Box ref={contentRef} sx={{ flex: 1, minHeight: 0, overflow: "auto", overscrollBehavior: "contain", p: 2, bgcolor: "#fffaf2" }}>
      {selectedOption?.category === "original" && originalPdf ? <Box sx={{ height: "100%", "& > .MuiPaper-root": { height: "100%", minHeight: 0, border: 0 } }}><Suspense fallback={<CircularProgress />}><PdfViewer url={originalPdf.url} preferNativeViewer={originalPdf.preferNativeViewer} /></Suspense></Box>
        : options.length === 0 ? <Alert severity="info">No extracted data is available for this binary.</Alert>
        : loading ? <Stack alignItems="center" justifyContent="center" spacing={2} sx={{ minHeight: 260 }}><CircularProgress /><Typography color="text.secondary">Loading extracted data...</Typography></Stack>
          : error ? <Alert severity="warning">Extracted data unavailable.</Alert>
            : activeSearch && searchableText ? <Box component="pre" sx={{ m: 0, whiteSpace: "pre-wrap", wordBreak: "break-word", fontFamily: "\"Cascadia Code\", Consolas, monospace", fontSize: 13, lineHeight: 1.55 }}><SearchHighlightedText value={searchableText} matches={matches} current={currentMatch} containerRef={contentRef} /></Box>
            : selectedOption?.format === "native-json" ? <JsonView value={content} />
              : selectedOption?.format === "markdown" && selectedOption.renderMode === "rendered" ? <Box sx={{ "& h1, & h2, & h3": { color: "primary.main" }, "& p, & li": { lineHeight: 1.7 } }}><ReactMarkdown>{typeof content === "string" ? content : ""}</ReactMarkdown></Box>
                : <Box component="pre" sx={{ m: 0, whiteSpace: "pre-wrap", wordBreak: "break-word", fontFamily: "\"Cascadia Code\", Consolas, monospace", fontSize: 13, lineHeight: 1.55 }}>{typeof content === "string" ? content : ""}</Box>}
    </Box>
  </Paper>;
}
