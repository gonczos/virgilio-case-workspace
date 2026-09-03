import { FormEvent, useMemo, useRef, useState } from "react";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  Paper,
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
  getReferenceResultHeading,
  getShortSha,
  groupReferenceTextHits,
} from "../utils/consultation";
import { createLatestRequestTracker } from "../utils/latestRequest";
import { mergeTextSearchHits } from "../utils/textSearchPagination";

type SearchMode = "reference" | "text";
type TextSearchScope = "pilot" | "full";
const TEXT_PAGE_LIMIT = 50;

interface TextPaginationState {
  query: string;
  scope: TextSearchScope;
  nextOffset: number;
  hasMore: boolean;
}

function formatDate(value: string | null): string {
  if (!value) return "Date unavailable";
  return new Date(value).toLocaleDateString();
}

function ContextList({ contexts }: { contexts: ReferenceSourceContext[] }) {
  if (contexts.length === 0) {
    return <Typography variant="body2" color="text.secondary">No procedural occurrence recorded.</Typography>;
  }
  return (
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
        </Stack>
        <Typography variant="body2" color="text.secondary">
          {getReferenceLocationLabel(location.kind, location.pdf_page, "reference")}
        </Typography>
        {item.observation.context_text ? (
          <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
            {item.observation.context_text}
          </Typography>
        ) : null}
        <ContextList contexts={item.source_contexts} />
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
            Open original binary
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
    <Alert severity="info">
      <Stack spacing={0.75}>
        <Typography variant="body2" sx={{ fontWeight: 700 }}>Search coverage</Typography>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
          <Chip size="small" label={`Text search: pilot (${fixture?.distinct_binary_count ?? 15} binaries) or full indexed corpus`} />
          <Chip size="small" label={`Reference lookup: fixture observations · ${fixture?.missing_binary_record_count ?? 2} missing-binary records`} />
        </Stack>
        <Typography variant="caption">
          Reference-lookup coverage and text-search coverage are separate. No reference result does not mean the document is absent.
        </Typography>
      </Stack>
    </Alert>
  );
}

export function ReferenceSearchPage() {
  const requestTracker = useRef(createLatestRequestTracker());
  const [mode, setMode] = useState<SearchMode>("reference");
  const [textScope, setTextScope] = useState<TextSearchScope>("pilot");
  const [query, setQuery] = useState("105398957");
  const [lookup, setLookup] = useState<ReferenceLookupResponse | null>(null);
  const [search, setSearch] = useState<ReferenceTextSearchResponse | null>(null);
  const [submittedResult, setSubmittedResult] = useState<{
    mode: SearchMode;
    query: string;
    textScope?: TextSearchScope;
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
  ) {
    const request = requestTracker.current.begin();
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
          limit: TEXT_PAGE_LIMIT,
          offset: 0,
          scope: submittedTextScope,
        });
        if (!request.isCurrent()) return;
        setSearch(result);
        setTextPagination({
          query: value,
          scope: submittedTextScope,
          nextOffset: result.result_summary.next_offset,
          hasMore: result.result_summary.has_more,
        });
      }
      setSubmittedResult({
        mode: searchMode,
        query: value,
        ...(searchMode === "text" ? { textScope: submittedTextScope } : {}),
      });
    } catch (requestError) {
      if (!request.isCurrent()) return;
      setError(requestError instanceof Error ? requestError.message : String(requestError));
    } finally {
      if (request.isCurrent()) setLoading(false);
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

  async function loadMore() {
    if (!search || !textPagination || !textPagination.hasMore || loadingMore) return;
    const submittedSearch = textPagination;
    const request = requestTracker.current.begin();
    setLoadingMore(true);
    setLoadMoreError(null);
    try {
      const nextPage = await searchText(submittedSearch.query, {
        limit: TEXT_PAGE_LIMIT,
        offset: submittedSearch.nextOffset,
        scope: submittedSearch.scope,
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
          >
            <ToggleButton value="reference">Exact reference</ToggleButton>
            <ToggleButton value="text">Text</ToggleButton>
          </ToggleButtonGroup>
          {mode === "reference" ? (
            <Typography variant="caption" color="text.secondary">
              Exact-reference lookup remains limited to the pilot reference observations.
            </Typography>
          ) : (
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ sm: "center" }}>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>Text-search scope</Typography>
              <ToggleButtonGroup
                exclusive
                value={textScope}
                onChange={(_event, next: TextSearchScope | null) => { if (next) setTextScope(next); }}
                size="small"
              >
                <ToggleButton value="pilot">Pilot</ToggleButton>
                <ToggleButton value="full">Full corpus</ToggleButton>
              </ToggleButtonGroup>
            </Stack>
          )}
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
            <TextField
              fullWidth
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              label={mode === "reference" ? "Exact reference value" : "Search terms"}
              helperText={mode === "reference"
                ? "Exact normalized lookup; the value is not assumed to identify a resolved target."
                : "Returns processor-specific passages grouped under their original binary."}
            />
            <Button type="submit" variant="contained" disabled={loading || !query.trim()} sx={{ minWidth: 120 }}>
              {loading ? <CircularProgress size={22} color="inherit" /> : "Search"}
            </Button>
          </Stack>
        </Stack>
      </Paper>
      {error ? <Alert severity="error">Search failed: {error}</Alert> : null}
      {submittedResult ? (
        <Typography variant="h5">
          {getReferenceResultHeading(submittedResult.mode, submittedResult.query)}
          {submittedResult.mode === "text"
            ? ` · ${submittedResult.textScope === "full" ? "Full corpus" : "Pilot"}`
            : ""}
        </Typography>
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
        <Alert severity={textPagination?.hasMore ? "warning" : "info"}>
          {search.items.length} passage{search.items.length === 1 ? "" : "s"} loaded across {textGroups.length} distinct PDF{textGroups.length === 1 ? "" : "s"}.
          {textPagination?.hasMore
            ? ` More matches are available; each page loads up to ${TEXT_PAGE_LIMIT} passages.`
            : " No further matches remain."}
        </Alert>
      ) : null}
      {loadMoreError ? (
        <Alert severity="error">
          Loading the next page failed: {loadMoreError}. Existing results were preserved; you can retry.
        </Alert>
      ) : null}
      {textGroups.map((group) => (
        <Paper key={group.sha256} elevation={0} sx={{ p: 2.5, border: "1px solid rgba(31,79,95,0.14)" }}>
          <Stack spacing={2}>
            <Box>
              <Typography variant="h6">
                {group.source_contexts[0]?.document_name ?? group.source_contexts[0]?.designation ?? `Binary ${getShortSha(group.sha256)}`}
              </Typography>
              <ContextList contexts={group.source_contexts} />
            </Box>
            <Button component={RouterLink} to={`/binaries/${group.sha256}`} variant="outlined" sx={{ alignSelf: "flex-start" }}>
              Open original binary
            </Button>
            <Divider />
            <Typography variant="subtitle2">{group.hits.length} processor-specific result{group.hits.length === 1 ? "" : "s"}</Typography>
            {group.hits.map((hit) => (
              <Accordion key={`${hit.document_representation_id}-${hit.segment_id}`} variant="outlined">
                <AccordionSummary>
                  <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ sm: "center" }}>
                    <Chip size="small" label={hit.processor_key} color="primary" />
                    <Typography variant="body2">
                      {getReferenceLocationLabel(hit.location.kind, hit.location.pdf_page)}
                    </Typography>
                  </Stack>
                </AccordionSummary>
                <AccordionDetails>
                  <Stack spacing={2}>
                    <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>{hit.headline}</Typography>
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
