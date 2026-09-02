import { useEffect, useMemo, useState } from "react";
import {
  Alert, Box, Button, Chip, CircularProgress, FormControl, InputLabel,
  Link as MuiLink, MenuItem, Paper, Select, Stack, Table, TableBody,
  TableCell, TableContainer, TableHead, TablePagination, TableRow, TextField, Typography,
} from "@mui/material";
import { Link as RouterLink } from "react-router-dom";

import { getExtractionCoverageReport } from "../api/consultation";
import type { ExtractionCoverageItem, ExtractionCoverageReport, ExtractionProcessorKey } from "../types/consultation";

const PAGE_SIZE = 25;
const PROCESSOR_LABELS: Record<ExtractionProcessorKey, string> = {
  pdf_literal_text: "Literal",
  pdf_signature_metadata: "Signature",
  pdf_structure_inventory: "Structure",
  xberg: "Xberg",
  docling: "Docling",
};
type CoverageFilter = "all" | "successful" | "failed" | "warnings";

function matchesCoverage(item: ExtractionCoverageItem, filter: CoverageFilter) {
  if (filter === "successful") return item.all_successful;
  if (filter === "failed") return item.has_missing_extraction;
  if (filter === "warnings") return item.has_warnings;
  return true;
}

export function ExtractionCoveragePage() {
  const [report, setReport] = useState<ExtractionCoverageReport | null>(null);
  const [coverageFilter, setCoverageFilter] = useState<CoverageFilter>("failed");
  const [processorFilter, setProcessorFilter] = useState<ExtractionProcessorKey | "all">("all");
  const [readabilityFilter, setReadabilityFilter] = useState("all");
  const [shaFilter, setShaFilter] = useState("");
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setReport(await getExtractionCoverageReport());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : String(loadError));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);
  const readabilityOptions = useMemo(() => (
    [...new Set((report?.items ?? []).map((item) => item.machine_readability_status ?? "unknown"))].sort()
  ), [report]);
  const filteredItems = useMemo(() => {
    const normalizedSha = shaFilter.trim().toLowerCase();
    return (report?.items ?? []).filter((item) => (
      matchesCoverage(item, coverageFilter)
      && (processorFilter === "all" || !item.coverage[processorFilter])
      && (readabilityFilter === "all" || (item.machine_readability_status ?? "unknown") === readabilityFilter)
      && (!normalizedSha || item.sha256.includes(normalizedSha))
    ));
  }, [coverageFilter, processorFilter, readabilityFilter, report, shaFilter]);
  useEffect(() => { setPage(0); }, [coverageFilter, processorFilter, readabilityFilter, shaFilter]);
  const pageItems = filteredItems.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <Stack spacing={2.5}>
      <Box>
        <Typography variant="h4" gutterBottom>Extraction coverage</Typography>
        <Typography color="text.secondary">
          Coverage is based on usable persisted representations. Failed means at least one expected extraction
          type has never produced usable data; historical job attempts are not counted.
        </Typography>
      </Box>
      {error ? <Alert severity="error" action={<Button color="inherit" onClick={() => void load()}>Retry</Button>}>{error}</Alert> : null}
      {report ? (
        <Stack direction={{ xs: "column", md: "row" }} spacing={1} useFlexGap flexWrap="wrap">
          <Chip label={`${report.summary.total_binaries} total`} />
          <Chip color="success" label={`${report.summary.successful_binaries} successful`} />
          <Chip color="error" label={`${report.summary.binaries_with_missing_extractions} with missing extraction`} />
          <Chip color="warning" label={`${report.summary.binaries_with_warnings} with warnings`} />
        </Stack>
      ) : null}
      <Paper elevation={0} sx={{ border: "1px solid rgba(31,79,95,0.12)", p: 2 }}>
        <Stack direction={{ xs: "column", lg: "row" }} spacing={2}>
          <FormControl size="small" sx={{ minWidth: 210 }}>
            <InputLabel>Coverage</InputLabel>
            <Select value={coverageFilter} label="Coverage" onChange={(event) => setCoverageFilter(event.target.value as CoverageFilter)}>
              <MenuItem value="all">All</MenuItem>
              <MenuItem value="successful">Successful</MenuItem>
              <MenuItem value="failed">At least one failed</MenuItem>
              <MenuItem value="warnings">At least one with warnings</MenuItem>
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 210 }}>
            <InputLabel>Missing extraction</InputLabel>
            <Select value={processorFilter} label="Missing extraction" onChange={(event) => setProcessorFilter(event.target.value as ExtractionProcessorKey | "all")}>
              <MenuItem value="all">Any extractor</MenuItem>
              {(report?.processor_keys ?? []).map((key) => <MenuItem key={key} value={key}>{PROCESSOR_LABELS[key]}</MenuItem>)}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 210 }}>
            <InputLabel>Readability</InputLabel>
            <Select value={readabilityFilter} label="Readability" onChange={(event) => setReadabilityFilter(event.target.value)}>
              <MenuItem value="all">All</MenuItem>
              {readabilityOptions.map((value) => <MenuItem key={value} value={value}>{value}</MenuItem>)}
            </Select>
          </FormControl>
          <TextField size="small" label="SHA-256" value={shaFilter} onChange={(event) => setShaFilter(event.target.value)} sx={{ minWidth: 300 }} />
        </Stack>
      </Paper>
      <Paper elevation={0} sx={{ border: "1px solid rgba(31,79,95,0.12)", overflow: "hidden" }}>
        {loading ? (
          <Stack alignItems="center" spacing={2} sx={{ py: 12 }}><CircularProgress /><Typography>Loading report...</Typography></Stack>
        ) : (
          <>
            <TableContainer sx={{ maxHeight: "calc(100vh - 330px)" }}><Table stickyHeader size="small">
              <TableHead><TableRow>
                <TableCell>Binary</TableCell><TableCell>Readability</TableCell><TableCell>Pages</TableCell>
                {(report?.processor_keys ?? []).map((key) => <TableCell key={key} align="center">{PROCESSOR_LABELS[key]}</TableCell>)}
                <TableCell>Warnings</TableCell>
              </TableRow></TableHead>
              <TableBody>
                {pageItems.map((item) => <TableRow key={item.sha256} hover>
                  <TableCell sx={{ minWidth: 570 }}><Stack spacing={0.25}>
                    <MuiLink component={RouterLink} to={`/binaries/${item.sha256}`} sx={{ fontFamily: "monospace" }}>{item.sha256}</MuiLink>
                    <Typography variant="caption" color="text.secondary">Binary #{item.file_binary_id}</Typography>
                  </Stack></TableCell>
                  <TableCell>{item.machine_readability_status ?? "unknown"}</TableCell>
                  <TableCell>{item.page_count ?? "—"}</TableCell>
                  {(report?.processor_keys ?? []).map((key) => <TableCell key={key} align="center">
                    <Chip size="small" color={item.coverage[key] ? "success" : "error"} variant={item.coverage[key] ? "outlined" : "filled"} label={item.coverage[key] ? "✓" : "Missing"} />
                  </TableCell>)}
                  <TableCell>{item.has_warnings ? item.warning_processor_keys.map((key) => PROCESSOR_LABELS[key]).join(", ") : "—"}</TableCell>
                </TableRow>)}
                {pageItems.length === 0 ? <TableRow><TableCell colSpan={9} align="center" sx={{ py: 8 }}>No binaries match these filters.</TableCell></TableRow> : null}
              </TableBody>
            </Table></TableContainer>
            <TablePagination component="div" count={filteredItems.length} page={page} onPageChange={(_event, value) => setPage(value)} rowsPerPage={PAGE_SIZE} rowsPerPageOptions={[PAGE_SIZE]} />
          </>
        )}
      </Paper>
    </Stack>
  );
}
