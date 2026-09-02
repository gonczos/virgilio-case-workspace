import { useEffect, useMemo, useState } from "react";
import {
  Alert, Box, Button, Chip, CircularProgress, FormControl, InputLabel,
  Link as MuiLink, MenuItem, Paper, Select, Stack, TextField, Typography,
} from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import type { GridColDef } from "@mui/x-data-grid";
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

function CoverageChip({ successful }: { successful: boolean }) {
  return <Chip size="small" color={successful ? "success" : "error"} variant={successful ? "outlined" : "filled"} label={successful ? "✓" : "Missing"} />;
}

export function ExtractionCoveragePage() {
  const [report, setReport] = useState<ExtractionCoverageReport | null>(null);
  const [coverageFilter, setCoverageFilter] = useState<CoverageFilter>("failed");
  const [processorFilter, setProcessorFilter] = useState<ExtractionProcessorKey | "all">("all");
  const [readabilityFilter, setReadabilityFilter] = useState("all");
  const [shaFilter, setShaFilter] = useState("");
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

  const columns = useMemo<GridColDef<ExtractionCoverageItem>[]>(() => [
    {
      field: "sha256", headerName: "Binary", flex: 2, minWidth: 280, maxWidth: 650,
      renderCell: ({ row }) => <Stack spacing={0.1} sx={{ minWidth: 0, py: 0.5 }}>
        <MuiLink component={RouterLink} to={`/binaries/${row.sha256}`} title={row.sha256} sx={{ fontFamily: "monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {row.sha256}
        </MuiLink>
        <Typography variant="caption" color="text.secondary">Binary #{row.file_binary_id}</Typography>
      </Stack>,
    },
    {
      field: "machine_readability_status", headerName: "Readability", flex: 1, minWidth: 150,
      valueGetter: (value) => value ?? "unknown",
    },
    { field: "page_count", headerName: "Pages", type: "number", width: 85 },
    ...Object.entries(PROCESSOR_LABELS).map(([processorKey, label]) => ({
      field: processorKey, headerName: label, width: 115, sortable: true,
      valueGetter: (_value: unknown, row: ExtractionCoverageItem) => row.coverage[processorKey as ExtractionProcessorKey],
      renderCell: ({ value }: { value: boolean }) => <CoverageChip successful={value} />,
      align: "center" as const, headerAlign: "center" as const,
    })),
    {
      field: "warning_processor_keys", headerName: "Warnings", flex: 1, minWidth: 130,
      valueGetter: (_value, row) => row.warning_processor_keys.map((key) => PROCESSOR_LABELS[key]).join(", "),
      renderCell: ({ value }) => value || "—",
    },
  ], []);

  return <Stack spacing={2.5}>
    <Box>
      <Typography variant="h4" gutterBottom>Extraction coverage</Typography>
      <Typography color="text.secondary">
        Coverage is based on usable persisted representations. Failed means at least one expected extraction
        type has never produced usable data; historical job attempts are not counted.
      </Typography>
    </Box>
    {error ? <Alert severity="error" action={<Button color="inherit" onClick={() => void load()}>Retry</Button>}>{error}</Alert> : null}
    {report ? <Stack direction={{ xs: "column", md: "row" }} spacing={1} useFlexGap flexWrap="wrap">
      <Chip label={`${report.summary.total_binaries} total`} />
      <Chip color="success" label={`${report.summary.successful_binaries} successful`} />
      <Chip color="error" label={`${report.summary.binaries_with_missing_extractions} with missing extraction`} />
      <Chip color="warning" label={`${report.summary.binaries_with_warnings} with warnings`} />
    </Stack> : null}
    <Paper elevation={0} sx={{ border: "1px solid rgba(31,79,95,0.12)", p: 2 }}>
      <Stack direction={{ xs: "column", lg: "row" }} spacing={2}>
        <FormControl size="small" sx={{ minWidth: 210 }}>
          <InputLabel>Coverage</InputLabel>
          <Select value={coverageFilter} label="Coverage" onChange={(event) => setCoverageFilter(event.target.value as CoverageFilter)}>
            <MenuItem value="all">All</MenuItem><MenuItem value="successful">Successful</MenuItem>
            <MenuItem value="failed">At least one failed</MenuItem><MenuItem value="warnings">At least one with warnings</MenuItem>
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
    <Paper elevation={0} sx={{ border: "1px solid rgba(31,79,95,0.12)", overflow: "hidden", height: "calc(100vh - 330px)", minHeight: 420 }}>
      {loading && !report ? <Stack alignItems="center" spacing={2} sx={{ py: 12 }}><CircularProgress /><Typography>Loading report...</Typography></Stack> : <DataGrid
        rows={filteredItems}
        columns={columns}
        getRowId={(row) => row.file_binary_id}
        loading={loading}
        disableRowSelectionOnClick
        pageSizeOptions={[PAGE_SIZE, 50, 100]}
        initialState={{ pagination: { paginationModel: { pageSize: PAGE_SIZE, page: 0 } } }}
        sx={{ border: 0, "& .MuiDataGrid-cell": { alignItems: "center" } }}
      />}
    </Paper>
  </Stack>;
}
