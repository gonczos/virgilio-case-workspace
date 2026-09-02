import { useEffect, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import {
  Alert,
  Autocomplete,
  Box,
  CircularProgress,
  Paper,
  Stack,
  TextField,
  Typography,
  createFilterOptions,
} from "@mui/material";

import { getRepresentationContent } from "../api/consultation";
import type { RepresentationListItem } from "../types/consultation";
import { getRepresentationLabel, sameStableId } from "../utils/consultation";

export type InspectionCategory = "interpretation" | "evidence";

export interface InspectionOption {
  id: string;
  category: InspectionCategory;
  representation: RepresentationListItem;
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

function JsonView({ value }: { value: unknown }) {
  return <Box component="pre" sx={{ m: 0, whiteSpace: "pre-wrap", wordBreak: "break-word", fontSize: 13, lineHeight: 1.5 }}>
    {JSON.stringify(value, null, 2)}
  </Box>;
}

export function InspectionViewer({
  interpretations,
  evidence,
  effectiveRepresentationId,
  initialCategory = "interpretation",
  height,
  onViewedRepresentationChange,
}: InspectionViewerProps) {
  const options = useMemo(() => [
    ...buildInspectionOptions("interpretation", interpretations),
    ...buildInspectionOptions("evidence", evidence),
  ], [evidence, interpretations]);
  const [selectedId, setSelectedId] = useState("");
  const [content, setContent] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const selectedOption = options.find((option) => option.id === selectedId) ?? null;

  useEffect(() => {
    if (selectedOption) return;
    const categoryOptions = options.filter((option) => option.category === initialCategory);
    const preferred = categoryOptions.find((option) => (
      sameStableId(option.representation.representation_id, effectiveRepresentationId)
      && option.format === "markdown"
      && option.renderMode === "rendered"
    )) ?? categoryOptions[0] ?? options[0] ?? null;
    setSelectedId(preferred?.id ?? "");
  }, [effectiveRepresentationId, initialCategory, options, selectedOption]);

  useEffect(() => {
    onViewedRepresentationChange(selectedOption?.representation ?? null);
  }, [onViewedRepresentationChange, selectedOption]);

  useEffect(() => {
    if (!selectedOption) {
      setContent(null);
      setError(null);
      return;
    }
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
    setSelectedId(option.id);
  }

  return <Paper elevation={0} sx={{ border: "1px solid rgba(31,79,95,0.12)", height, minHeight: 520, display: "flex", flexDirection: "column", overflow: "hidden" }}>
    <Box sx={{ px: 2, pt: 1.5, borderBottom: "1px solid rgba(31,79,95,0.12)" }}>
      <Autocomplete
        fullWidth
        size="small"
        openOnFocus
        disableClearable
        options={options}
        value={selectedOption ?? undefined}
        onChange={(_event, option) => selectOption(option)}
        filterOptions={filterOptions}
        groupBy={(option) => option.category === "interpretation" ? "Interpretation" : "PDF evidence"}
        getOptionLabel={(option) => option.label}
        isOptionEqualToValue={(option, value) => option.id === value.id}
        renderInput={(params) => <TextField {...params} label="Inspect extracted data" placeholder="Type to filter" />}
        renderOption={(props, option) => <li {...props} key={option.id}>
          <Stack spacing={0.25} sx={{ py: 0.5 }}>
            <Typography variant="body2">{option.label}</Typography>
            <Typography variant="caption" color="text.secondary">{option.representation.processor_version}</Typography>
          </Stack>
        </li>}
        sx={{ my: 1.5 }}
      />
      {selectedOption ? <Stack direction="row" spacing={1} alignItems="center" sx={{ pb: 1.5 }}>
        <Typography variant="caption" color="text.secondary">
          Created {new Date(selectedOption.representation.created_at).toLocaleString()}
        </Typography>
      </Stack> : null}
    </Box>
    <Box sx={{ flex: 1, minHeight: 0, overflow: "auto", p: 2, bgcolor: "#fffaf2" }}>
      {options.length === 0 ? <Alert severity="info">No extracted data is available for this binary.</Alert>
        : loading ? <Stack alignItems="center" justifyContent="center" spacing={2} sx={{ minHeight: 260 }}><CircularProgress /><Typography color="text.secondary">Loading extracted data...</Typography></Stack>
          : error ? <Alert severity="warning">Extracted data unavailable.</Alert>
            : selectedOption?.format === "native-json" ? <JsonView value={content} />
              : selectedOption?.format === "markdown" && selectedOption.renderMode === "rendered" ? <Box sx={{ "& h1, & h2, & h3": { color: "primary.main" }, "& p, & li": { lineHeight: 1.7 } }}><ReactMarkdown>{typeof content === "string" ? content : ""}</ReactMarkdown></Box>
                : <Box component="pre" sx={{ m: 0, whiteSpace: "pre-wrap", wordBreak: "break-word", fontFamily: "\"Cascadia Code\", Consolas, monospace", fontSize: 13, lineHeight: 1.55 }}>{typeof content === "string" ? content : ""}</Box>}
    </Box>
  </Paper>;
}
