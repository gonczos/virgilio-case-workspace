import { useEffect, useState } from "react";
import { Alert, CircularProgress, Stack, Typography } from "@mui/material";
import { useParams } from "react-router-dom";

import { getBinaryDetail, requireAuthenticatedResponse } from "../api/consultation";

export function OpenOriginalPage() {
  const { sha256 = "" } = useParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const detail = await getBinaryDetail(sha256);
        const response = await fetch(detail.binary.original_binary_url, { method: "HEAD" });
        requireAuthenticatedResponse(response);
        if (!response.ok) throw new Error(`Original-file request failed with ${response.status}`);
        if (active) window.location.replace(detail.binary.original_binary_url);
      } catch (openError) {
        if (active) setError(openError instanceof Error ? openError.message : String(openError));
      }
    })();
    return () => { active = false; };
  }, [sha256]);

  return error ? <Alert severity="warning">Unable to open original file: {error}</Alert> : (
    <Stack spacing={2} alignItems="center" sx={{ py: 8 }}>
      <CircularProgress />
      <Typography color="text.secondary">Checking access and opening the original file…</Typography>
    </Stack>
  );
}
