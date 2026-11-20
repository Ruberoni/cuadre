import "./styles/globals.css";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { setUnauthorizedHandler } from "./api/client.ts";
import { endSession, type SessionState, sessionQueryKey } from "./features/auth/session.ts";
import { router } from "./router.ts";

// No automatic retries: a failed request shows its error state (and "Reintentar") right away.
const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

// A 401 from the API means the session ended: forget it, and the shell sends the user to Login
// with `redirect` = where they were. Nothing to do if the app already knows (signed out, on Login).
setUnauthorizedHandler(() => {
  if (queryClient.getQueryData<SessionState>(sessionQueryKey)?.user === null) return;
  void endSession(queryClient, { signedOut: false });
});

const root = document.getElementById("root");
if (!root) throw new Error("Missing #root element");

createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);
