import { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Link as MuiLink,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  Typography,
} from "@mui/material";
import { Link as RouterLink } from "react-router-dom";

import { listBinaries } from "../api/consultation";
import type { BinaryCatalogueItem } from "../types/consultation";
import {
  formatBytes,
  formatFileType,
  getProcessingLabel,
  getRepresentationLabel,
  getShortSha,
} from "../utils/consultation";

const PAGE_SIZE = 25;

function ReviewChip({ item }: { item: BinaryCatalogueItem }) {
  if (item.review_needed) {
    return <Chip size="small" color="warning" label="Needs review" />;
  }
  return <Chip size="small" variant="outlined" label="OK" />;
}

function RepresentationChip({ item }: { item: BinaryCatalogueItem }) {
  return (
    <Chip
      size="small"
      color={item.effective_selection_reason === "explicit_human_selection" ? "secondary" : "primary"}
      variant={item.effective_representation ? "filled" : "outlined"}
      label={getRepresentationLabel(item.effective_representation)}
    />
  );
}

export function BinariesPage() {
  const [items, setItems] = useState<BinaryCatalogueItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load(targetPage: number) {
    setLoading(true);
    setError(null);
    try {
      const payload = await listBinaries(PAGE_SIZE, targetPage * PAGE_SIZE);
      setItems(payload.items);
      setTotalCount(payload.total_count);
      setPage(Math.floor(payload.offset / PAGE_SIZE));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : String(loadError));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load(0);
  }, []);

  return (
    <Stack spacing={2.5}>
      <Box>
        <Typography variant="h4" gutterBottom>
          Binaries
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Browse the imported corpus by settled binary, current processing state, and available representations.
        </Typography>
      </Box>

      {error ? (
        <Alert
          severity="error"
          action={(
            <Button color="inherit" size="small" onClick={() => void load(page)}>
              Retry
            </Button>
          )}
        >
          Failed to load the consultation catalogue: {error}
        </Alert>
      ) : null}

      <Paper elevation={0} sx={{ border: "1px solid rgba(31,79,95,0.12)", overflow: "hidden" }}>
        {loading ? (
          <Stack alignItems="center" justifyContent="center" spacing={2} sx={{ py: 12 }}>
            <CircularProgress />
            <Typography color="text.secondary">Loading binaries...</Typography>
          </Stack>
        ) : items.length === 0 ? (
          <Stack alignItems="center" justifyContent="center" spacing={2} sx={{ py: 12 }}>
            <Typography variant="h6">No binaries found</Typography>
            <Typography color="text.secondary">The consultation API returned an empty result.</Typography>
          </Stack>
        ) : (
          <>
            <TableContainer sx={{ maxHeight: "calc(100vh - 240px)" }}>
              <Table stickyHeader size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Document / file</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell>Size</TableCell>
                    <TableCell>Documents</TableCell>
                    <TableCell>Cases</TableCell>
                    <TableCell>Processing</TableCell>
                    <TableCell>Effective representation</TableCell>
                    <TableCell>Review</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {items.map((item) => (
                    <TableRow
                      key={item.sha256}
                      hover
                      sx={{
                        "& td": {
                          verticalAlign: "top",
                        },
                      }}
                    >
                      <TableCell sx={{ minWidth: 320 }}>
                        <Stack spacing={0.5}>
                          <MuiLink
                            component={RouterLink}
                            to={`/binaries/${item.sha256}`}
                            underline="hover"
                            color="primary.main"
                            sx={{ fontWeight: 600 }}
                          >
                            {item.display_name}
                          </MuiLink>
                          <Typography variant="body2" color="text.secondary">
                            {getShortSha(item.sha256)}
                          </Typography>
                          {item.document_count > 1 ? (
                            <Typography variant="body2" color="text.secondary">
                              {item.document_count} linked documents
                            </Typography>
                          ) : null}
                          {item.linked_document_names.length > 1 ? (
                            <Typography variant="body2" color="text.secondary">
                              {item.linked_document_names.slice(0, 3).join(" · ")}
                            </Typography>
                          ) : null}
                        </Stack>
                      </TableCell>
                      <TableCell>{formatFileType(item.mime_type, item.file_extension)}</TableCell>
                      <TableCell>{formatBytes(item.size_bytes)}</TableCell>
                      <TableCell>{item.document_count}</TableCell>
                      <TableCell sx={{ minWidth: 200 }}>
                        <Stack spacing={0.5}>
                          <Typography variant="body2">{item.case_count}</Typography>
                          {item.linked_case_refs.slice(0, 2).map((ref) => (
                            <Typography key={ref} variant="body2" color="text.secondary">
                              {ref}
                            </Typography>
                          ))}
                        </Stack>
                      </TableCell>
                      <TableCell sx={{ minWidth: 180 }}>
                        <Stack spacing={0.5}>
                          <Chip size="small" label={getProcessingLabel(item)} variant="outlined" />
                          {item.last_processed_at ? (
                            <Typography variant="body2" color="text.secondary">
                              Last: {new Date(item.last_processed_at).toLocaleString()}
                            </Typography>
                          ) : null}
                        </Stack>
                      </TableCell>
                      <TableCell sx={{ minWidth: 180 }}>
                        <Stack spacing={0.75}>
                          <RepresentationChip item={item} />
                          <Typography variant="body2" color="text.secondary">
                            {item.available_representations.length} available
                          </Typography>
                        </Stack>
                      </TableCell>
                      <TableCell sx={{ minWidth: 180 }}>
                        <Stack spacing={0.75}>
                          <ReviewChip item={item} />
                          {item.review_reason_codes.slice(0, 2).map((reason) => (
                            <Typography key={reason} variant="body2" color="text.secondary">
                              {reason}
                            </Typography>
                          ))}
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            <TablePagination
              component="div"
              count={totalCount}
              page={page}
              onPageChange={(_event, nextPage) => {
                void load(nextPage);
              }}
              rowsPerPage={PAGE_SIZE}
              rowsPerPageOptions={[PAGE_SIZE]}
            />
          </>
        )}
      </Paper>
    </Stack>
  );
}
