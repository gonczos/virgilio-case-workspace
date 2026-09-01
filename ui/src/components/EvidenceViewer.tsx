import { useEffect, useState } from "react";
import {
  Alert,
  Box,
  CircularProgress,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Typography,
} from "@mui/material";

import { getRepresentationContent } from "../api/consultation";
import type { RepresentationListItem } from "../types/consultation";
import { chooseInitialFormat, getRepresentationLabel, sameStableId } from "../utils/consultation";

interface EvidenceViewerProps {
  evidence: RepresentationListItem[];
  viewRepresentationId: string | "";
  onViewRepresentationChange: (representationId: string) => void;
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

export function EvidenceViewer({
  evidence,
  viewRepresentationId,
  onViewRepresentationChange,
  viewFormat,
  onViewFormatChange,
}: EvidenceViewerProps) {
  const selectedRepresentation = evidence.find((item) => sameStableId(item.representation_id, viewRepresentationId)) ?? null;
  const [loading, setLoading] = useState(false);
  const [content, setContent] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedRepresentation) {
      setContent(null);
      setError(null);
      setLoading(false);
      return;
    }
    if (!selectedRepresentation.available_formats.includes(String(viewFormat))) {
      onViewFormatChange(chooseInitialFormat(selectedRepresentation) ?? "");
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
        minHeight: 320,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <Stack spacing={1.5} sx={{ p: 2, borderBottom: "1px solid rgba(31,79,95,0.12)" }}>
        <Typography variant="h6">PDF evidence</Typography>
        {evidence.length === 0 ? (
          <Alert severity="info">
            No persisted PDF evidence representation is currently available for this binary.
          </Alert>
        ) : (
          <>
            <Alert severity="info">
              Evidence artifacts are shown separately from the consultation interpretation. Missing artifacts here do not prove the source PDF lacks that evidence channel.
            </Alert>
            <Stack direction={{ xs: "column", md: "row" }} spacing={1.5}>
              <FormControl fullWidth size="small">
                <InputLabel id="evidence-select-label">View evidence</InputLabel>
                <Select
                  labelId="evidence-select-label"
                  value={viewRepresentationId}
                  label="View evidence"
                  onChange={(event) => {
                    onViewRepresentationChange(String(event.target.value));
                  }}
                >
                  {evidence.map((representation) => (
                    <MenuItem key={representation.representation_id} value={String(representation.representation_id)}>
                      {getRepresentationLabel(representation)} · {representation.processor_version}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl fullWidth size="small" disabled={!selectedRepresentation}>
                <InputLabel id="evidence-format-select-label">Format</InputLabel>
                <Select
                  labelId="evidence-format-select-label"
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
          </>
        )}
      </Stack>

      <Box sx={{ flex: 1, overflow: "auto", p: 2, bgcolor: "#fffaf2" }}>
        {evidence.length === 0 ? null : loading ? (
          <Stack alignItems="center" justifyContent="center" spacing={2} sx={{ minHeight: 200 }}>
            <CircularProgress />
            <Typography color="text.secondary">Loading evidence...</Typography>
          </Stack>
        ) : error ? (
          <Alert severity="warning">Evidence content unavailable.</Alert>
        ) : viewFormat === "native-json" ? (
          <JsonView value={content} />
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
