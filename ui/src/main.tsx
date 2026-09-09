import React from "react";
import ReactDOM from "react-dom/client";
import {
  AppBar,
  Alert,
  Button,
  Box,
  Container,
  CssBaseline,
  Link as MuiLink,
  Stack,
  ThemeProvider,
  Toolbar,
  Typography,
  createTheme,
} from "@mui/material";
import { BrowserRouter, Link, Navigate, Route, Routes, useLocation } from "react-router-dom";

import { AuthenticationGate } from "./components/AuthenticationGate";
import { BinariesPage } from "./pages/BinariesPage";
import { BinaryDetailPage } from "./pages/BinaryDetailPage";
import { ExtractionCoveragePage } from "./pages/ExtractionCoveragePage";
import { ReferenceSearchPage } from "./pages/ReferenceSearchPage";
import { ReferenceGraphPage } from "./pages/ReferenceGraphPage";
import { ProceduralFlowPage } from "./pages/ProceduralFlowPage";
import { OpenOriginalPage } from "./pages/OpenOriginalPage";

const theme = createTheme({
  palette: {
    mode: "light",
    primary: { main: "#1f4f5f" },
    secondary: { main: "#9d5d2f" },
    background: { default: "#f5f1e8", paper: "#fffdf8" },
    warning: { main: "#a6512d" },
  },
  typography: {
    fontFamily: "\"Segoe UI\", \"Aptos\", sans-serif",
    h4: { fontWeight: 700, letterSpacing: "-0.02em" },
    h5: { fontWeight: 700 },
    h6: { fontWeight: 700 },
  },
  shape: { borderRadius: 14 },
  components: { MuiPaper: { styleOverrides: { root: { backgroundImage: "none" } } } },
});

const appTitle = import.meta.env.VITE_APP_TITLE?.trim() || "Virgilio Consultation - beta v1";
const releaseMode = import.meta.env.VITE_CONSULTATION_V1 === "true";
document.title = appTitle;

function LogoutControl() {
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState(false);
  React.useEffect(() => {
    const onLogout = (event: StorageEvent) => {
      if (event.key === "consultation-logout" && event.newValue) window.location.replace("/signed-out");
    };
    window.addEventListener("storage", onLogout);
    return () => window.removeEventListener("storage", onLogout);
  }, []);
  return <Box>
    <Button variant="outlined" disabled={busy} sx={{ whiteSpace: "nowrap" }} onClick={async () => {
      setBusy(true);
      setError(false);
      try {
        const response = await fetch("/api/v1/auth/logout", { method: "POST", headers: { Accept: "application/json" } });
        if (!response.ok) throw new Error("Logout failed");
        const result = await response.json();
        if (typeof result.logout_url !== "string") throw new Error("Missing logout URL");
        window.dispatchEvent(new Event("consultation-auth-required"));
        try { localStorage.setItem("consultation-logout", String(Date.now())); } catch { /* Logout also works with browser storage disabled. */ }
        window.location.replace(result.logout_url);
      } catch {
        setError(true);
        setBusy(false);
      }
    }}>{busy ? "Logging out…" : "Log out"}</Button>
    {error && <Alert severity="error">Logout could not finish. Please try again.</Alert>}
  </Box>;
}

function SignedOutPage() {
  const location = useLocation();
  const reason = new URLSearchParams(location.search).get("reason");
  const message = reason === "setup-expired"
    ? "Your setup session expired. Start sign-in again. Successfully completed setup steps remain saved. If an authenticator code was not confirmed, remove that unfinished account before scanning the new QR code."
    : reason === "login-failed"
      ? "Sign-in could not be completed. Please start again."
      : "To access documents again, sign in.";
  return <Box sx={{ minHeight: "100vh", display: "grid", placeItems: "center", p: 3, bgcolor: "background.default" }}>
    <Stack spacing={2} sx={{ width: "100%", maxWidth: 620 }}>
      <Typography variant="h4">{reason ? "Sign-in incomplete" : "Session ended"}</Typography>
      <Alert severity={reason ? "warning" : "info"}>{message}</Alert>
      <Button variant="contained" href="/api/v1/auth/login?return_to=%2Fbinaries" sx={{ alignSelf: "flex-start" }}>Sign in</Button>
    </Stack>
  </Box>;
}

function ApplicationLayout() {
  return <Box sx={{ minHeight: "100vh", background: "radial-gradient(circle at top left, rgba(31,79,95,0.12), transparent 32%), linear-gradient(180deg, #f5f1e8 0%, #f1ece0 100%)" }}>
    <AppBar position="sticky" color="transparent" elevation={0} sx={{ backdropFilter: "blur(18px)", borderBottom: "1px solid rgba(31,79,95,0.12)" }}>
      <Toolbar sx={{ gap: 2 }}>
        <Typography component={Link} to="/binaries" variant="h6" sx={{ color: "primary.main", textDecoration: "none" }}>{appTitle}</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ flexGrow: 1 }}>{releaseMode ? "" : "Corpus consultation MVP"}</Typography>
        {!releaseMode && <MuiLink component={Link} to="/reports/extraction-coverage" underline="hover" color="text.secondary">Extraction coverage</MuiLink>}
        <MuiLink component={Link} to="/reference-search" underline="hover" color="text.secondary">Reference search</MuiLink>
        {!releaseMode && <MuiLink component={Link} to="/reference-graph/105398957" underline="hover" color="text.secondary">Graph spike</MuiLink>}
        {!releaseMode && <MuiLink component={Link} to="/procedural-flow?reference=85759502" underline="hover" color="text.secondary">Procedural flow</MuiLink>}
        {!releaseMode && <MuiLink href="http://localhost:8055" target="_blank" rel="noreferrer" underline="hover" color="text.secondary">Directus</MuiLink>}
        {releaseMode && <LogoutControl />}
      </Toolbar>
    </AppBar>
    <Container maxWidth={false} sx={{ py: 3 }}>
      <Routes>
        <Route path="/" element={<Navigate to="/binaries" replace />} />
        <Route path="/binaries" element={<BinariesPage />} />
        <Route path="/binaries/:sha256" element={<BinaryDetailPage />} />
        <Route path="/open-original/:sha256" element={<OpenOriginalPage />} />
        {!releaseMode && <Route path="/reports/extraction-coverage" element={<ExtractionCoveragePage />} />}
        <Route path="/reference-search" element={<ReferenceSearchPage />} />
        {!releaseMode && <Route path="/reference-graph/:value" element={<ReferenceGraphPage />} />}
        {!releaseMode && <Route path="/procedural-flow" element={<ProceduralFlowPage />} />}
      </Routes>
    </Container>
  </Box>;
}

function RoutedApplication() {
  const location = useLocation();
  if (releaseMode && location.pathname === "/signed-out") return <SignedOutPage />;
  const application = <ApplicationLayout />;
  return releaseMode ? <AuthenticationGate>{application}</AuthenticationGate> : application;
}

function App() {
  return <ThemeProvider theme={theme}>
    <CssBaseline />
    <BrowserRouter>
      <RoutedApplication />
    </BrowserRouter>
  </ThemeProvider>;
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
