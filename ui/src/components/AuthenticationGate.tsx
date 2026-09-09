import { useEffect, useState, type ReactNode } from "react";
import { Alert, Box, Button, CircularProgress, Stack, Typography } from "@mui/material";

interface AuthenticationGateProps {
  children: ReactNode;
}

type GateState = "checking" | "authenticated" | "redirecting" | "error";

function currentLoginUrl() {
  const returnTo = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  return `/api/v1/auth/login?return_to=${encodeURIComponent(returnTo)}`;
}

export function AuthenticationGate({ children }: AuthenticationGateProps) {
  const [state, setState] = useState<GateState>("checking");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setState("checking");
    void fetch("/api/v1/auth/session", {
      cache: "no-store",
      headers: { Accept: "application/json" },
    }).then((response) => {
      if (!active) return;
      if (response.status === 401) {
        setState("redirecting");
        window.location.replace(currentLoginUrl());
        return;
      }
      if (!response.ok) throw new Error(`Session check failed with ${response.status}`);
      setState("authenticated");
    }).catch(() => {
      if (active) setState("error");
    });
    return () => { active = false; };
  }, [attempt]);

  useEffect(() => {
    const onAuthenticationRequired = () => setState("redirecting");
    window.addEventListener("consultation-auth-required", onAuthenticationRequired);
    return () => window.removeEventListener("consultation-auth-required", onAuthenticationRequired);
  }, []);

  if (state === "authenticated") return children;

  return (
    <Box sx={{ minHeight: "100vh", display: "grid", placeItems: "center", p: 3, bgcolor: "background.default" }}>
      {state === "error" ? (
        <Stack spacing={2} alignItems="center" sx={{ maxWidth: 520 }}>
          <Alert severity="error">We could not verify your session. No consultation information has been displayed.</Alert>
          <Button variant="contained" onClick={() => setAttempt((value) => value + 1)}>Try again</Button>
        </Stack>
      ) : (
        <Stack spacing={2} alignItems="center">
          <CircularProgress />
          <Typography color="text.secondary">
            {state === "redirecting" ? "Opening secure sign-in…" : "Checking secure session…"}
          </Typography>
        </Stack>
      )}
    </Box>
  );
}
