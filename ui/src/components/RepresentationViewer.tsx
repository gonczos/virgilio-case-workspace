import { useEffect, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import {
  Alert,
  Box,
  Chip,
  CircularProgress,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";

import { getRepresentationContent } from "../api/consultation";
import type { RepresentationListItem } from "../types/consultation";
import { chooseInitialFormat, getRepresentationLabel } from "../utils/consultation";

interface RepresentationViewerProps {
  representations: RepresentationListItem[];
  effectiveRepresentationId: number | null;
  viewRepresentationId: number | "";
  onViewRepresentationChange: (representationId: number) => void;
  viewFormat: string | "";
  onViewFormatChange: (format: string) => void;
}

function JsonView({ value }: { value: unknown }) {
  return (
    <Box
      component="pre"
      sx={{
        m: 0,
        p: 2,
        overflow: "auto",
        fontSize: 13,
        lineHeight: 1.5,
        bgcolor: "#f4efe4",
        borderRadius: 2,
      }}
    >
      {JSON.stringify(value, null, 2)}
    </Box>
  );
}

export function RepresentationViewer({
  representations,
  effectiveRepresentationId,
  viewRepresentationId,
  onViewRepresentationChange,
  viewFormat,
  onViewFormatChange,
}: RepresentationViewerProps) {
  const initialRepresentation = useMemo(() => (
    representations.find((item) => item.representation_id === effectiveRepresentationId)
    ?? representations[0]
    ?? null
  ), [representations, effectiveRepresentationId]);
  const selectedRepresentation = representations.find((item) => item.representation_id === viewRepresentationId) ?? null;
  const [renderMode, setRenderMode] = useState<"rendered" | "raw">("rendered");
  const [loading, setLoading] = useState(false);
  const [content, setContent] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setRenderMode("rendered");
  }, [initialRepresentation]);

  useEffect(() => {
    if (!selectedRepresentation) {
      return;
    }
    if (!selectedRepresentation.available_formats.includes(String(viewFormat))) {
      onViewFormatChange(chooseInitialFormat(selectedRepresentation) ?? "");
      setRenderMode("rendered");
    }
  }, [onViewFormatChange, selectedRepresentation, viewFormat]);

  useEffect(() => {
    if (!selectedRepresentation || !viewFormat) {
      setContent(null);
      setError(null);
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    setError(null);
    setContent(null);
    void (async () => {
      try {
        const result = await getRepresentationContent(selectedRepresentation.representation_id, String(viewFormat));
        if (!active) {
          return;
        }
        setContent(result.body);
      } catch (loadError) {
        if (!active) {
          return;
        }
        setError(loadError instanceof Error ? loadError.message : String(loadError));
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [selectedRepresentation, viewFormat]);

  return (
    <Paper
      elevation={0}
      sx={{
        border: "1px solid rgba(31,79,95,0.12)",
        minHeight: 520,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <Stack spacing={1.5} sx={{ p: 2, borderBottom: "1px solid rgba(31,79,95,0.12)" }}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            Representation
          </Typography>
          {selectedRepresentation?.representation_id === effectiveRepresentationId ? (
            <Chip size="small" color="primary" label="Effective" />
          ) : null}
          {selectedRepresentation?.is_explicitly_selected ? (
            <Chip size="small" color="secondary" label="Explicit selection" />
          ) : null}
        </Stack>
        {representations.length === 0 ? (
          <Alert severity="info">No representation available for this binary yet.</Alert>
        ) : (
          <>
            <Stack direction={{ xs: "column", md: "row" }} spacing={1.5}>
              <FormControl fullWidth size="small">
                <InputLabel id="representation-select-label">View representation</InputLabel>
                <Select
                  labelId="representation-select-label"
                  value={viewRepresentationId}
                  label="View representation"
                  onChange={(event) => {
                    onViewRepresentationChange(Number(event.target.value));
                  }}
                >
                  {representations.map((representation) => (
                    <MenuItem key={representation.representation_id} value={representation.representation_id}>
                      {getRepresentationLabel(representation)} · {representation.processor_version}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl fullWidth size="small" disabled={!selectedRepresentation}>
                <InputLabel id="format-select-label">Format</InputLabel>
                <Select
                  labelId="format-select-label"
                  value={viewFormat}
                  label="Format"
                  onChange={(event) => onViewFormatChange(String(event.target.value))}
                >
                  {(selectedRepresentation?.available_formats ?? []).map((format) => (
                    <MenuItem key={format} value={format}>
                      {format}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Stack>
            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
              <Typography variant="body2" color="text.secondary">
                {selectedRepresentation ? `${getRepresentationLabel(selectedRepresentation)} ${selectedRepresentation.processor_version}` : ""}
              </Typography>
              {selectedRepresentation ? (
                <Typography variant="body2" color="text.secondary">
                  Created {new Date(selectedRepresentation.created_at).toLocaleString()}
                </Typography>
              ) : null}
            </Stack>
            {viewFormat === "markdown" ? (
              <ToggleButtonGroup
                size="small"
                exclusive
                value={renderMode}
                onChange={(_event, nextValue) => {
                  if (nextValue) {
                    setRenderMode(nextValue);
                  }
                }}
              >
                <ToggleButton value="rendered">Rendered</ToggleButton>
                <ToggleButton value="raw">Raw</ToggleButton>
              </ToggleButtonGroup>
            ) : null}
          </>
        )}
      </Stack>

      <Box sx={{ flex: 1, overflow: "auto", p: 2, bgcolor: "#fffaf2" }}>
        {representations.length === 0 ? null : loading ? (
          <Stack alignItems="center" justifyContent="center" spacing={2} sx={{ minHeight: 320 }}>
            <CircularProgress />
            <Typography color="text.secondary">Loading representation...</Typography>
          </Stack>
        ) : error ? (
          <Alert severity="warning">Representation content unavailable.</Alert>
        ) : viewFormat === "native-json" ? (
          <JsonView value={content} />
        ) : viewFormat === "markdown" && renderMode === "rendered" ? (
          <Box
            sx={{
              "& h1, & h2, & h3": { color: "primary.main" },
              "& p, & li": { lineHeight: 1.7 },
              "& code": {
                bgcolor: "rgba(31,79,95,0.08)",
                px: 0.75,
                py: 0.25,
                borderRadius: 1,
              },
            }}
          >
            <ReactMarkdown>{typeof content === "string" ? content : ""}</ReactMarkdown>
          </Box>
        ) : (
          <Box
            component="pre"
            sx={{
              m: 0,
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              fontFamily: "\"Cascadia Code\", Consolas, monospace",
              fontSize: 13,
              lineHeight: 1.55,
            }}
          >
            {typeof content === "string" ? content : ""}
          </Box>
        )}
      </Box>
    </Paper>
  );
}
