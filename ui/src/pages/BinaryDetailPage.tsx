import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
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
import { Link as RouterLink, useLocation, useParams } from "react-router-dom";

import { getBinaryDetail } from "../api/consultation";
import { ContextSummary } from "../components/ContextSummary";
import { InspectionViewer } from "../components/InspectionViewer";
import type { InspectionCategory } from "../components/InspectionViewer";
import { PdfViewer } from "../components/PdfViewer";
import { ProcessingSummary } from "../components/ProcessingSummary";
import { ProvenanceSummary } from "../components/ProvenanceSummary";
import { QualitySummary } from "../components/QualitySummary";
import { TechnicalDetails } from "../components/TechnicalDetails";
import type { BinaryDetailResponse } from "../types/consultation";
import {
  formatBytes,
  formatFileType,
  getRepresentationLabel,
  getShortSha,
  isPdfBinary,
  prefersNativePdfViewer,
  normalizeStableId,
} from "../utils/consultation";

const INSPECTION_HEIGHT = { xs: "70vh", xl: "clamp(560px, calc(100vh - 260px), 860px)" };

function DetailAccordion({ title, children }: { title: string; children: ReactNode }) {
  return <Accordion disableGutters elevation={0} sx={{ border: "1px solid rgba(31,79,95,0.12)", "&:before": { display: "none" } }}>
    <AccordionSummary expandIcon={<Typography aria-hidden="true">⌄</Typography>}>
      <Typography variant="h6">{title}</Typography>
    </AccordionSummary>
    <AccordionDetails sx={{ p: 0, "& > .MuiPaper-root": { border: 0 } }}>{children}</AccordionDetails>
  </Accordion>;
}

export function BinaryDetailPage() {
  const { sha256 = "" } = useParams();
  const location = useLocation();
  const [detail, setDetail] = useState<BinaryDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewedRepresentationId, setViewedRepresentationId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const nextDetail = await getBinaryDetail(sha256);
      setDetail(nextDetail);
      setViewedRepresentationId(null);
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
    return [...detail.representations.items, ...(detail.evidence?.items ?? [])].find(
      (item) => normalizeStableId(item.representation_id) === viewedRepresentationId,
    ) ?? null;
  }, [detail, viewedRepresentationId]);

  const initialInspectionCategory: InspectionCategory = (
    (location.state as { inspectionCategory?: string } | null)?.inspectionCategory === "evidence"
      ? "evidence"
      : "interpretation"
  );

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
        <Grid size={{ xs: 12, xl: 6 }} sx={{ "& > .MuiPaper-root": { height: INSPECTION_HEIGHT } }}>
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
          <InspectionViewer
            interpretations={detail.representations.items}
            evidence={detail.evidence?.items ?? []}
            effectiveRepresentationId={normalizeStableId(detail.representations.effective?.representation_id) ?? null}
            initialCategory={initialInspectionCategory}
            height={INSPECTION_HEIGHT}
            onViewedRepresentationChange={(representation) => {
              setViewedRepresentationId(normalizeStableId(representation?.representation_id) ?? null);
            }}
          />
        </Grid>
      </Grid>

      <Stack spacing={1}>
        <DetailAccordion title="Context"><ContextSummary detail={detail} /></DetailAccordion>
        <DetailAccordion title="Processing"><ProcessingSummary detail={detail} /></DetailAccordion>
        <DetailAccordion title="Comparison & review"><QualitySummary detail={detail} /></DetailAccordion>
        <DetailAccordion title="Viewed representation provenance">
          <ProvenanceSummary representation={viewedRepresentation} selectionReason={detail.representations.effective_selection_reason} />
        </DetailAccordion>
        <TechnicalDetails detail={detail} viewedRepresentation={viewedRepresentation} />
      </Stack>
    </Stack>
  );
}
