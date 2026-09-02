import {
  Chip,
  Divider,
  List,
  ListItem,
  ListItemText,
  Paper,
  Stack,
  Typography,
} from "@mui/material";

import type { BinaryDetailResponse } from "../types/consultation";

interface ContextSummaryProps {
  detail: BinaryDetailResponse;
  hideHeading?: boolean;
}

export function ContextSummary({ detail, hideHeading = false }: ContextSummaryProps) {
  return (
    <Paper elevation={0} sx={{ p: 2.25, border: "1px solid rgba(31,79,95,0.12)" }}>
      {hideHeading ? null : <Typography variant="h6" gutterBottom>Context</Typography>}
      <Stack direction={{ xs: "column", lg: "row" }} spacing={3} divider={<Divider flexItem orientation="vertical" />}>
        <Stack flex={1}>
          <Typography variant="subtitle2" color="text.secondary">Documents</Typography>
          <List dense disablePadding>
            {detail.context.documents.map((document) => (
              <ListItem key={document.document_id} disableGutters>
                <ListItemText
                  primary={document.document_name ?? `Document ${document.document_id}`}
                  secondary={(
                    <>
                      {document.document_type ?? "Unknown type"}
                      {document.document_date ? ` · ${document.document_date}` : ""}
                    </>
                  )}
                />
                {document.is_primary_binary ? <Chip size="small" label="Primary" /> : null}
              </ListItem>
            ))}
          </List>
        </Stack>
        <Stack flex={1}>
          <Typography variant="subtitle2" color="text.secondary">Cases / proceedings</Typography>
          <List dense disablePadding>
            {detail.context.cases.map((item) => (
              <ListItem key={item.case_file_id} disableGutters>
                <ListItemText
                  primary={item.processo}
                  secondary={[item.especie, item.estado, item.data_autuacao].filter(Boolean).join(" · ")}
                />
              </ListItem>
            ))}
          </List>
        </Stack>
        <Stack flex={1}>
          <Typography variant="subtitle2" color="text.secondary">Buckets</Typography>
          <List dense disablePadding>
            {detail.context.buckets.map((bucket) => (
              <ListItem key={bucket.bucket_pk_id} disableGutters>
                <ListItemText
                  primary={bucket.bucket_id}
                  secondary={[bucket.bucket_date, bucket.designation, bucket.processo].filter(Boolean).join(" · ")}
                />
              </ListItem>
            ))}
          </List>
        </Stack>
      </Stack>
    </Paper>
  );
}
