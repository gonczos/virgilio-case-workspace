import {
  Chip,
  List,
  ListItem,
  ListItemText,
  Paper,
  Stack,
  Typography,
} from "@mui/material";

import type { BinaryDetailResponse } from "../types/consultation";
import { getRepresentationLabel } from "../utils/consultation";

interface QualitySummaryProps {
  detail: BinaryDetailResponse;
}

export function QualitySummary({ detail }: QualitySummaryProps) {
  return (
    <Paper elevation={0} sx={{ p: 2.25, border: "1px solid rgba(31,79,95,0.12)" }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1.5}>
        <Typography variant="h6">Comparison & review</Typography>
        <Chip
          size="small"
          color={detail.attention.review_needed ? "warning" : "success"}
          label={detail.attention.review_needed ? "Needs review" : "No significant review signal"}
        />
      </Stack>
      <Stack spacing={1.5}>
        {detail.comparisons.length === 0 ? (
          <Typography color="text.secondary">No persisted comparison is currently available.</Typography>
        ) : (
          <List dense disablePadding>
            {detail.comparisons.map((comparison) => (
              <ListItem key={comparison.comparison_id} disableGutters>
                <ListItemText
                  primary={`${getRepresentationLabel(detail.representations.items.find((item) => item.representation_id === comparison.left_representation_id) ?? null)} vs ${getRepresentationLabel(detail.representations.items.find((item) => item.representation_id === comparison.right_representation_id) ?? null)}`}
                  secondary={`Disagreement: ${comparison.disagreement_level ?? "unknown"}`}
                />
              </ListItem>
            ))}
          </List>
        )}
        {detail.attention.reason_codes.length > 0 ? (
          <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
            {detail.attention.reason_codes.map((reason) => (
              <Chip key={reason} size="small" variant="outlined" label={reason} />
            ))}
          </Stack>
        ) : null}
      </Stack>
    </Paper>
  );
}
