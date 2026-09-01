import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Breadcrumbs,
  Button,
  Chip,
  CircularProgress,
  Grid,
  Link as MuiLink,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import { Link as RouterLink, useParams } from "react-router-dom";

import { getBinaryDetail } from "../api/consultation";
import { ContextSummary } from "../components/ContextSummary";
import { EvidenceViewer } from "../components/EvidenceViewer";
import { PdfViewer } from "../components/PdfViewer";
import { ProcessingSummary } from "../components/ProcessingSummary";
import { ProvenanceSummary } from "../components/ProvenanceSummary";
import { QualitySummary } from "../components/QualitySummary";
import { RepresentationViewer } from "../components/RepresentationViewer";
import { TechnicalDetails } from "../components/TechnicalDetails";
import type { BinaryDetailResponse } from "../types/consultation";
import {
  chooseInitialFormat,
  chooseInitialRepresentation,
  formatBytes,
  formatFileType,
  getRepresentationLabel,
  getShortSha,
  isPdfBinary,
  prefersNativePdfViewer,
  normalizeStableId,
  sameStableId,
} from "../utils/consultation";

export function BinaryDetailPage() {
  const { sha256 = "" } = useParams();
  const [detail, setDetail] = useState<BinaryDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewRepresentationId, setViewRepresentationId] = useState<string | "">("");
  const [viewFormat, setViewFormat] = useState<string | "">("");
  const [viewEvidenceId, setViewEvidenceId] = useState<string | "">("");
  const [viewEvidenceFormat, setViewEvidenceFormat] = useState<string | "">("");

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const nextDetail = await getBinaryDetail(sha256);
      setDetail(nextDetail);
      const initialRepresentation = chooseInitialRepresentation(nextDetail);
      setViewRepresentationId(normalizeStableId(initialRepresentation?.representation_id) ?? "");
      setViewFormat(chooseInitialFormat(initialRepresentation) ?? "");
      const initialEvidence = nextDetail.evidence?.items?.[0] ?? null;
      setViewEvidenceId(normalizeStableId(initialEvidence?.representation_id) ?? "");
      setViewEvidenceFormat(chooseInitialFormat(initialEvidence) ?? "");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : String(loadError));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [sha256]);

  const viewedRepresentation = useMemo(() => {
    if (!detail) {
      return null;
    }
    return detail.representations.items.find(
      (item) => sameStableId(item.representation_id, viewRepresentationId),
    ) ?? null;
  }, [detail, viewRepresentationId]);

  if (loading) {
    return (
      <Stack alignItems="center" justifyContent="center" spacing={2} sx={{ minHeight: "70vh" }}>
        <CircularProgress />
        <Typography color="text.secondary">Loading binary detail...</Typography>
      </Stack>
    );
  }

  if (error || !detail) {
    return (
      <Stack spacing={2}>
        <Alert
          severity="error"
          action={(
            <Button color="inherit" size="small" onClick={() => void load()}>
              Retry
            </Button>
          )}
        >
          Failed to load binary detail{error ? `: ${error}` : "."}
        </Alert>
        <MuiLink component={RouterLink} to="/binaries" underline="hover">
          Back to binaries
        </MuiLink>
      </Stack>
    );
  }

  return (
    <Stack spacing={2.5}>
      <Breadcrumbs>
        <MuiLink component={RouterLink} underline="hover" color="inherit" to="/binaries">
          Binaries
        </MuiLink>
        <Typography color="text.primary">{detail.binary.display_name}</Typography>
      </Breadcrumbs>

      <Paper elevation={0} sx={{ p: 2.5, border: "1px solid rgba(31,79,95,0.12)" }}>
        <Stack direction={{ xs: "column", md: "row" }} spacing={2} justifyContent="space-between">
          <Stack spacing={1}>
            <Typography variant="h4">{detail.binary.display_name}</Typography>
            <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
              <Chip label={formatFileType(detail.binary.mime_type, detail.binary.file_extension)} />
              <Chip variant="outlined" label={formatBytes(detail.binary.size_bytes)} />
              <Chip variant="outlined" label={getShortSha(detail.binary.sha256)} />
              <Chip
                color={detail.attention.review_needed ? "warning" : "success"}
                label={detail.attention.review_needed ? "Needs review" : "OK"}
              />
            </Stack>
            <Typography color="text.secondary">
              {detail.context.documents.length} document(s) · {detail.context.cases.length} case(s) · {detail.context.buckets.length} bucket link(s)
            </Typography>
          </Stack>
          <Stack spacing={1} alignItems={{ xs: "flex-start", md: "flex-end" }}>
            <Chip
              color={detail.representations.effective_selection_reason === "explicit_human_selection" ? "secondary" : "primary"}
              label={`Effective: ${getRepresentationLabel(detail.representations.effective)}`}
            />
            <Button
              component="a"
              href={detail.binary.original_binary_url}
              target="_blank"
              rel="noreferrer"
              variant="outlined"
            >
              Open original
            </Button>
          </Stack>
        </Stack>
      </Paper>

      <Grid container spacing={2.5}>
        <Grid size={{ xs: 12, xl: 6 }}>
          {isPdfBinary(detail) ? (
            <PdfViewer
              url={detail.binary.original_binary_url}
              preferNativeViewer={prefersNativePdfViewer(detail)}
            />
          ) : (
            <Paper elevation={0} sx={{ p: 3, border: "1px solid rgba(31,79,95,0.12)", minHeight: 520 }}>
              <Stack spacing={2}>
                <Typography variant="h6">Original file</Typography>
                <Alert severity="info">Preview not available for this file type.</Alert>
                <Button
                  component="a"
                  href={detail.binary.original_binary_url}
                  target="_blank"
                  rel="noreferrer"
                  variant="outlined"
                  sx={{ alignSelf: "flex-start" }}
                >
                  Open original
                </Button>
              </Stack>
            </Paper>
          )}
        </Grid>
        <Grid size={{ xs: 12, xl: 6 }}>
          <Stack spacing={2.5}>
            <RepresentationViewer
              representations={detail.representations.items}
              effectiveRepresentationId={normalizeStableId(detail.representations.effective?.representation_id) ?? null}
              viewRepresentationId={viewRepresentationId}
              onViewRepresentationChange={(representationId) => {
                setViewRepresentationId(representationId);
                const representation = detail.representations.items.find(
                  (item) => sameStableId(item.representation_id, representationId),
                ) ?? null;
                setViewFormat(chooseInitialFormat(representation) ?? "");
              }}
              viewFormat={viewFormat}
              onViewFormatChange={setViewFormat}
            />
            <EvidenceViewer
              evidence={detail.evidence?.items ?? []}
              viewRepresentationId={viewEvidenceId}
              onViewRepresentationChange={(representationId) => {
                setViewEvidenceId(representationId);
                const representation = (detail.evidence?.items ?? []).find(
                  (item) => sameStableId(item.representation_id, representationId),
                ) ?? null;
                setViewEvidenceFormat(chooseInitialFormat(representation) ?? "");
              }}
              viewFormat={viewEvidenceFormat}
              onViewFormatChange={setViewEvidenceFormat}
            />
          </Stack>
        </Grid>
      </Grid>

      <Grid container spacing={2.5}>
        <Grid size={{ xs: 12, lg: 12 }}>
          <ContextSummary detail={detail} />
        </Grid>
        <Grid size={{ xs: 12, lg: 6 }}>
          <ProcessingSummary detail={detail} />
        </Grid>
        <Grid size={{ xs: 12, lg: 6 }}>
          <QualitySummary detail={detail} />
        </Grid>
        <Grid size={{ xs: 12, lg: 6 }}>
          <ProvenanceSummary
            representation={viewedRepresentation}
            selectionReason={detail.representations.effective_selection_reason}
          />
        </Grid>
        <Grid size={{ xs: 12, lg: 6 }}>
          <TechnicalDetails detail={detail} viewedRepresentation={viewedRepresentation} />
        </Grid>
      </Grid>
    </Stack>
  );
}
