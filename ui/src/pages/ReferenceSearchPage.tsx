import { Fragment, FormEvent, useMemo, useRef, useState } from "react";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import { Link as RouterLink } from "react-router-dom";

import { lookupPilotReference, searchText } from "../api/consultation";
import type {
  ReferenceLookupResponse,
  ReferenceObservationView,
  ReferencePilotFixtureSummary,
  ReferenceSourceContext,
  ReferenceTextSearchResponse,
} from "../types/consultation";
import {
  getReferenceLocationLabel,
  getObservationTechnicalAnchors,
  getObservationKindLabel,
  getReferenceResultHeading,
  getShortSha,
  groupReferenceTextHits,
} from "../utils/consultation";
import { createLatestRequestTracker } from "../utils/latestRequest";
import { mergeTextSearchHits } from "../utils/textSearchPagination";
import { shouldRestartTextSearchForSort } from "../utils/textSearchSort";

type SearchMode = "reference" | "text";
type TextSearchScope = "pilot" | "full";
type TextSearchSort = "relevance" | "earliest_occurrence_asc" | "latest_occurrence_desc";
const BINARY_PAGE_LIMIT = 20;

interface TextPaginationState {
  query: string;
  scope: TextSearchScope;
  sort: TextSearchSort;
  nextOffset: number;
  hasMore: boolean;
}

function formatDate(value: string | null): string {
  if (!value) return "Date unavailable";
  return new Date(value).toLocaleDateString();
}

function ContextList({ contexts, compact = false }: { contexts: ReferenceSourceContext[]; compact?: boolean }) {
  if (contexts.length === 0) {
    return <Typography variant="body2" color="text.secondary">No procedural occurrence recorded.</Typography>;
  }
  const details = (
    <Stack spacing={0.75}>
      {contexts.map((context) => (
        <Box key={`${context.bucket_document_id}-${context.document_id}`}>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            {context.document_name ?? context.designation ?? "Source document"}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {context.process_number} · occurrence {context.occurrence_reference} · {formatDate(context.occurrence_date)}
          </Typography>
          {context.document_reference ? (
            <Typography variant="caption" color="text.secondary">
              Source document reference: {context.document_reference}
            </Typography>
          ) : null}
        </Box>
      ))}
    </Stack>
  );
  if (!compact) return details;
  const dates = [...new Set(contexts.map((context) => formatDate(context.occurrence_date)))];
  return (
    <Accordion disableGutters elevation={0} sx={{ bgcolor: "transparent" }}>
      <AccordionSummary expandIcon={<span aria-hidden>›</span>} sx={{ px: 0 }}>
        <Typography variant="body2">
          {contexts.length} recorded occurrence{contexts.length === 1 ? "" : "s"}: {dates.join(", ")}
        </Typography>
      </AccordionSummary>
      <AccordionDetails sx={{ px: 0 }}>{details}</AccordionDetails>
    </Accordion>
  );
}

function HighlightedExcerpt({ text }: { text: string }) {
  const parts = text.split(/(\[\[|\]\])/);
  let highlighted = false;
  return (
    <Typography variant="body2" sx={{ whiteSpace: "pre-wrap", lineHeight: 1.65 }}>
      {parts.map((part, index) => {
        if (part === "[[") { highlighted = true; return null; }
        if (part === "]]" ) { highlighted = false; return null; }
        return highlighted
          ? <Box component="mark" key={index} sx={{ bgcolor: "warning.light", px: 0.25 }}>{part}</Box>
          : <Fragment key={index}>{part}</Fragment>;
      })}
    </Typography>
  );
}

function ObservationSummary({ item, contextual = false, onLookupReference }: {
  item: ReferenceObservationView;
  contextual?: boolean;
  onLookupReference?: (value: string) => void;
}) {
  const location = item.observation.location;
  const unresolved = item.target_resolution.state === "unresolved";
  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Stack spacing={1.25}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ sm: "center" }}>
          <Typography sx={{ fontWeight: 700 }}>
            {item.observation.raw_label ? `${item.observation.raw_label}: ` : ""}
            {item.observation.raw_value}
          </Typography>
          <Chip
            size="small"
            variant="outlined"
            color={unresolved ? "warning" : "success"}
            label={unresolved ? "Observed reference · target unresolved" : `Target ${item.target_resolution.state}`}
          />
          {contextual ? <Chip size="small" label="Contextual reference" /> : null}
          <Chip size="small" variant="outlined" label={getObservationKindLabel(item.observation.observed_in_kind)} />
        </Stack>
        <Typography variant="body2" color="text.secondary">
          {getReferenceLocationLabel(location.kind, location.pdf_page, "reference")}
        </Typography>
        {item.observation.observed_in_kind === "segment" && item.observation.context_text ? (
          <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
            {item.observation.context_text}
          </Typography>
        ) : null}
        <ContextList contexts={item.source_contexts} compact />
        {onLookupReference ? (
          <Button
            variant="contained"
            size="small"
            onClick={() => onLookupReference(item.observation.raw_value)}
            sx={{ alignSelf: "flex-start" }}
          >
            Find observations of this reference
          </Button>
        ) : null}
        {item.binary_identity ? (
          <Button
            component={RouterLink}
            to={`/binaries/${item.binary_identity.sha256}`}
            variant="outlined"
            size="small"
            sx={{ alignSelf: "flex-start" }}
          >
            Open original file
          </Button>
        ) : (
          <Alert severity="info">Source record retained; the original binary was unavailable.</Alert>
        )}
        <Accordion disableGutters elevation={0}>
          <AccordionSummary>Technical provenance</AccordionSummary>
          <AccordionDetails>
            <Stack spacing={0.5}>
              {getObservationTechnicalAnchors(item).map((anchor) => (
                <Typography key={anchor.label} variant="caption" sx={{ overflowWrap: "anywhere" }}>
                  {anchor.label}: {anchor.value}
                </Typography>
              ))}
            </Stack>
          </AccordionDetails>
        </Accordion>
      </Stack>
    </Paper>
  );
}

function FixtureBoundary({ fixture }: { fixture: ReferencePilotFixtureSummary | null }) {
  return (
    <Accordion disableGutters elevation={0} sx={{ border: "1px solid", borderColor: "divider", borderRadius: 1 }}>
      <AccordionSummary expandIcon={<span aria-hidden>›</span>}>
        <Typography variant="body2" sx={{ fontWeight: 700 }}>About search coverage</Typography>
      </AccordionSummary>
      <AccordionDetails>
        <Stack spacing={0.75}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
          <Chip size="small" label={`Text search: pilot (${fixture?.distinct_binary_count ?? 15} binaries) or full indexed corpus`} />
          <Chip size="small" label={`Reference lookup: fixture observations · ${fixture?.missing_binary_record_count ?? 2} missing-binary records`} />
        </Stack>
        <Typography variant="caption">
          Reference-lookup coverage and text-search coverage are separate. No reference result does not mean the document is absent.
        </Typography>
        </Stack>
      </AccordionDetails>
    </Accordion>
  );
}

export function ReferenceSearchPage() {
  const requestTracker = useRef(createLatestRequestTracker());
  const initialSearchPending = useRef(false);
  const [mode, setMode] = useState<SearchMode>("reference");
  const [textScope, setTextScope] = useState<TextSearchScope>("pilot");
  const [textSort, setTextSort] = useState<TextSearchSort>("relevance");
  const [query, setQuery] = useState("105398957");
  const [lookup, setLookup] = useState<ReferenceLookupResponse | null>(null);
  const [search, setSearch] = useState<ReferenceTextSearchResponse | null>(null);
  const [submittedResult, setSubmittedResult] = useState<{
    mode: SearchMode;
    query: string;
    textScope?: TextSearchScope;
    textSort?: TextSearchSort;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null);
  const [textPagination, setTextPagination] = useState<TextPaginationState | null>(null);
  const textGroups = useMemo(() => groupReferenceTextHits(search?.items ?? []), [search]);
  const fixture = lookup?.fixture ?? search?.fixture ?? null;

  async function runSearch(
    searchMode: SearchMode,
    value: string,
    submittedTextScope: TextSearchScope = textScope,
    submittedTextSort: TextSearchSort = textSort,
  ) {
    const request = requestTracker.current.begin();
    initialSearchPending.current = true;
    setLoading(true);
    setLoadingMore(false);
    setError(null);
    setLoadMoreError(null);
    setTextPagination(null);
    setSearch(null);
    setLookup(null);
    try {
      if (searchMode === "reference") {
        const result = await lookupPilotReference(value);
        if (!request.isCurrent()) return;
        setLookup(result);
      } else {
        const result = await searchText(value, {
          limit: BINARY_PAGE_LIMIT,
          offset: 0,
          scope: submittedTextScope,
          sort: submittedTextSort,
        });
        if (!request.isCurrent()) return;
        setSearch(result);
        setTextPagination({
          query: value,
          scope: submittedTextScope,
          sort: submittedTextSort,
          nextOffset: result.result_summary.next_offset,
          hasMore: result.result_summary.has_more,
        });
      }
      setSubmittedResult({
        mode: searchMode,
        query: value,
        ...(searchMode === "text" ? { textScope: submittedTextScope } : {}),
        ...(searchMode === "text" ? { textSort: submittedTextSort } : {}),
      });
    } catch (requestError) {
      if (!request.isCurrent()) return;
      setError(requestError instanceof Error ? requestError.message : String(requestError));
    } finally {
      if (request.isCurrent()) {
        initialSearchPending.current = false;
        setLoading(false);
      }
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const value = query.trim();
    if (!value) return;
    await runSearch(mode, value);
  }

  function findReferenceObservations(value: string) {
    setMode("reference");
    setQuery(value);
    void runSearch("reference", value);
  }

  function changeTextSort(nextSort: TextSearchSort) {
    setTextSort(nextSort);
    if (!submittedResult || !shouldRestartTextSearchForSort({
      initialSearchPending: initialSearchPending.current,
      submittedMode: submittedResult.mode,
    })) return;
    void runSearch(
      "text",
      submittedResult.query,
      submittedResult.textScope ?? "pilot",
      nextSort,
    );
  }

  async function loadMore() {
    if (!search || !textPagination || !textPagination.hasMore || loadingMore) return;
    const submittedSearch = textPagination;
    const request = requestTracker.current.begin();
    setLoadingMore(true);
    setLoadMoreError(null);
    try {
      const nextPage = await searchText(submittedSearch.query, {
        limit: BINARY_PAGE_LIMIT,
        offset: submittedSearch.nextOffset,
        scope: submittedSearch.scope,
        sort: submittedSearch.sort,
      });
      if (!request.isCurrent()) return;
      setSearch((current) => current ? {
        ...nextPage,
        items: mergeTextSearchHits(current.items, nextPage.items),
      } : nextPage);
      setTextPagination({
        ...submittedSearch,
        nextOffset: nextPage.result_summary.next_offset,
        hasMore: nextPage.result_summary.has_more,
      });
    } catch (requestError) {
      if (!request.isCurrent()) return;
      setLoadMoreError(requestError instanceof Error ? requestError.message : String(requestError));
    } finally {
      if (request.isCurrent()) setLoadingMore(false);
    }
  }

  return (
    <Stack spacing={2.5}>
      <Box>
        <Typography variant="h4" gutterBottom>Reference and text search</Typography>
        <Typography color="text.secondary">
          Find court-facing references or search independent extracted representations without merging them.
        </Typography>
      </Box>
      <FixtureBoundary fixture={fixture} />
      <Paper component="form" onSubmit={(event) => void submit(event)} elevation={0} sx={{ p: 2.5 }}>
        <Stack spacing={2}>
          <ToggleButtonGroup
            exclusive
            value={mode}
            onChange={(_event, next: SearchMode | null) => { if (next) setMode(next); }}
            size="small"
            sx={{ "& .Mui-selected": { bgcolor: "primary.main !important", color: "primary.contrastText !important" } }}
          >
            <ToggleButton value="reference">Exact reference</ToggleButton>
            <ToggleButton value="text">Text</ToggleButton>
          </ToggleButtonGroup>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} alignItems={{ sm: "flex-start" }}>
            <TextField
              fullWidth
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              label={mode === "reference" ? "Exact reference value" : "Search terms"}
              helperText={mode === "reference"
                ? "Exact normalized lookup; the value is not assumed to identify a resolved target."
                : "Returns processor-specific passages grouped under their original PDF."}
            />
            <Button type="submit" variant="contained" disabled={loading || !query.trim()} sx={{ minWidth: 120, height: 56 }}>
              {loading ? <CircularProgress size={22} color="inherit" /> : "Search"}
            </Button>
          </Stack>
          {mode === "reference" ? (
            <Typography variant="caption" color="text.secondary">
              Pilot reference observations only.
            </Typography>
          ) : (
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ sm: "center" }}>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>Text-search scope</Typography>
              <ToggleButtonGroup
                exclusive
                value={textScope}
                onChange={(_event, next: TextSearchScope | null) => { if (next) setTextScope(next); }}
                size="small"
                sx={{ "& .Mui-selected": { bgcolor: "primary.main !important", color: "primary.contrastText !important" } }}
              >
                <ToggleButton value="pilot">Pilot</ToggleButton>
                <ToggleButton value="full">Full corpus</ToggleButton>
              </ToggleButtonGroup>
            </Stack>
          )}
        </Stack>
      </Paper>
      {error ? <Alert severity="error">Search failed: {error}</Alert> : null}
      {submittedResult ? (
        <Stack direction={{ xs: "column", md: "row" }} spacing={2} justifyContent="space-between" alignItems={{ md: "center" }}>
          <Typography variant="h5">
            {getReferenceResultHeading(submittedResult.mode, submittedResult.query)}
            {submittedResult.mode === "text"
              ? ` · ${submittedResult.textScope === "full" ? "Full corpus" : "Pilot"}`
              : ""}
          </Typography>
          {submittedResult.mode === "text" ? (
            <FormControl size="small" sx={{ minWidth: 230 }}>
              <InputLabel id="text-search-order-label">Order submitted results</InputLabel>
              <Select
                labelId="text-search-order-label"
                label="Order submitted results"
                value={submittedResult.textSort ?? "relevance"}
                disabled={loading || loadingMore}
                onChange={(event) => changeTextSort(event.target.value as TextSearchSort)}
              >
                <MenuItem value="relevance">Relevance</MenuItem>
                <MenuItem value="earliest_occurrence_asc">Earliest occurrence</MenuItem>
                <MenuItem value="latest_occurrence_desc">Latest occurrence</MenuItem>
              </Select>
            </FormControl>
          ) : null}
        </Stack>
      ) : null}

      {lookup && lookup.items.length === 0 ? (
        <Alert severity="warning">
          No reference-observation matches within the pilot. This does not mean the document is absent; try Text search.
        </Alert>
      ) : null}
      {lookup?.items.map((item) => (
        <ObservationSummary key={item.observation.observation_key} item={item} />
      ))}

      {search && textGroups.length === 0 ? (
        <Alert severity="info">
          No text-search matches within the {search.query.scope === "full" ? "full corpus scope" : "pilot"}.
          This does not mean the document is absent.
        </Alert>
      ) : null}
      {search ? (
        <Typography variant="body2" color="text.secondary">
          {textGroups.length} PDF{textGroups.length === 1 ? "" : "s"} · {search.items.length} matching passage{search.items.length === 1 ? "" : "s"} · {textPagination?.hasMore ? "More available" : "All loaded"}
        </Typography>
      ) : null}
      {loadMoreError ? (
        <Alert severity="error">
          Loading the next page failed: {loadMoreError}. Existing results were preserved; you can retry.
        </Alert>
      ) : null}
      {textGroups.map((group) => (
        <Paper key={group.sha256} elevation={0} sx={{ p: 2.5, border: "1px solid rgba(31,79,95,0.14)" }}>
          <Stack spacing={2}>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2} justifyContent="space-between">
              <Box>
                <Typography variant="h6">
                  {group.source_contexts[0]?.document_name ?? group.source_contexts[0]?.designation ?? `PDF ${getShortSha(group.sha256)}`}
                </Typography>
              {submittedResult?.textSort === "earliest_occurrence_asc" ? (
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {formatDate(group.hits[0].earliest_occurrence_date)} · Earliest recorded occurrence
                </Typography>
              ) : null}
              {submittedResult?.textSort === "latest_occurrence_desc" ? (
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {formatDate(group.hits[0].latest_occurrence_date)} · Latest recorded occurrence
                </Typography>
              ) : null}
              {submittedResult?.textSort === "relevance" && group.source_contexts[0]?.occurrence_date ? (
                <Typography variant="body2" color="text.secondary">
                  Recorded occurrence: {formatDate(group.source_contexts[0].occurrence_date)}
                </Typography>
              ) : null}
              </Box>
              <Button component={RouterLink} to={`/binaries/${group.sha256}`} variant="outlined" sx={{ alignSelf: "flex-start" }}>
                Open original PDF
              </Button>
            </Stack>
            <Box>
              <HighlightedExcerpt text={group.hits[0].headline} />
              <Typography variant="caption" color="text.secondary">
                Extracted by {group.hits[0].processor_key} {group.hits[0].processor_version} · {getReferenceLocationLabel(group.hits[0].location.kind, group.hits[0].location.pdf_page)}
              </Typography>
            </Box>
            <ContextList contexts={group.source_contexts} compact />
            {group.hits.slice(1).length > 0 ? (
              <Accordion disableGutters elevation={0}>
                <AccordionSummary expandIcon={<span aria-hidden>›</span>} sx={{ px: 0 }}>
                  <Typography variant="subtitle2">More matching passages ({group.hits.length - 1})</Typography>
                </AccordionSummary>
                <AccordionDetails sx={{ px: 0 }}>
                  <Stack spacing={1}>
                  {group.hits.slice(1).map((hit) => (
              <Accordion key={`${hit.document_representation_id}-${hit.segment_id}`} variant="outlined">
                <AccordionSummary expandIcon={<span aria-hidden>›</span>}>
                  <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ sm: "center" }}>
                    <Chip size="small" label={`${hit.processor_key} ${hit.processor_version}`} color="primary" />
                    <Typography variant="body2">
                      {getReferenceLocationLabel(hit.location.kind, hit.location.pdf_page)}
                    </Typography>
                  </Stack>
                </AccordionSummary>
                <AccordionDetails>
                  <Stack spacing={2}>
                    <HighlightedExcerpt text={hit.headline} />
                    {hit.passage_reference_observations.length > 0 ? (
                      <Stack spacing={1}>
                        <Typography variant="subtitle2">References in this passage</Typography>
                        {hit.passage_reference_observations.map((item) => (
                          <ObservationSummary
                            key={item.observation.observation_key}
                            item={item}
                            onLookupReference={findReferenceObservations}
                          />
                        ))}
                      </Stack>
                    ) : null}
                    {hit.contextual_reference_observations.length > 0 ? (
                      <Accordion disableGutters elevation={0}>
                        <AccordionSummary>Contextual references elsewhere on this binary</AccordionSummary>
                        <AccordionDetails>
                          <Stack spacing={1}>
                            {hit.contextual_reference_observations.map((item) => (
                              <ObservationSummary
                                key={item.observation.observation_key}
                                item={item}
                                contextual
                                onLookupReference={findReferenceObservations}
                              />
                            ))}
                          </Stack>
                        </AccordionDetails>
                      </Accordion>
                    ) : null}
                    <Accordion disableGutters elevation={0}>
                      <AccordionSummary>Extraction provenance</AccordionSummary>
                      <AccordionDetails>
                        <Typography variant="caption" display="block">Full SHA-256: {group.sha256}</Typography>
                        <Typography variant="caption" display="block">
                          Representation {hit.document_representation_id} · {hit.processor_key} {hit.processor_version}
                        </Typography>
                      </AccordionDetails>
                    </Accordion>
                  </Stack>
                </AccordionDetails>
              </Accordion>
                  ))}
                  </Stack>
                </AccordionDetails>
              </Accordion>
            ) : null}
            <Accordion disableGutters elevation={0}>
              <AccordionSummary expandIcon={<span aria-hidden>›</span>} sx={{ px: 0 }}>
                <Typography variant="subtitle2">Source details</Typography>
              </AccordionSummary>
              <AccordionDetails sx={{ px: 0 }}>
                <Typography variant="caption" display="block">Full SHA-256: {group.sha256}</Typography>
                <Typography variant="caption" display="block">
                  Preview representation {group.hits[0].document_representation_id} · segment {group.hits[0].segment_id}
                </Typography>
                {group.hits[0].passage_reference_observations.length > 0 ? (
                  <Stack spacing={1} sx={{ mt: 2 }}>
                    <Typography variant="subtitle2">References in the preview passage</Typography>
                    {group.hits[0].passage_reference_observations.map((item) => (
                      <ObservationSummary
                        key={item.observation.observation_key}
                        item={item}
                        onLookupReference={findReferenceObservations}
                      />
                    ))}
                  </Stack>
                ) : null}
                {group.hits[0].contextual_reference_observations.length > 0 ? (
                  <Stack spacing={1} sx={{ mt: 2 }}>
                    <Typography variant="subtitle2">Contextual references elsewhere on this PDF</Typography>
                    {group.hits[0].contextual_reference_observations.map((item) => (
                      <ObservationSummary
                        key={item.observation.observation_key}
                        item={item}
                        contextual
                        onLookupReference={findReferenceObservations}
                      />
                    ))}
                  </Stack>
                ) : null}
              </AccordionDetails>
            </Accordion>
          </Stack>
        </Paper>
      ))}
      {search && textPagination?.hasMore ? (
        <Button
          variant="outlined"
          disabled={loadingMore || loading}
          onClick={() => void loadMore()}
          sx={{ alignSelf: "center", minWidth: 140 }}
        >
          {loadingMore ? <CircularProgress size={22} /> : "Load more"}
        </Button>
      ) : null}
    </Stack>
  );
}
