import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Navigate, Outlet, useRouterState } from "@tanstack/react-router";
import { signOut } from "@/api/auth";
import { AppLayout } from "@/components/app-layout";
import { type SessionState, sessionQueryKey, sessionQueryOptions } from "@/features/auth/session";

export const Route = createFileRoute("/_app")({ component: SignedInApp });

/** Every app page needs a session; without one, Login (and back here after signing in). */
function SignedInApp() {
  const queryClient = useQueryClient();
  const session = useQuery(sessionQueryOptions);
  const href = useRouterState({ select: (state) => state.location.href });

  // While the session loads: the empty frame, never a nav for the wrong role.
  if (session.isPending) return <AppLayout />;

  const state = session.data;
  if (!state?.user) {
    // After Cerrar sesión, Login opens clean; otherwise it brings the user back here.
    return <Navigate to="/login" search={state?.signedOut ? {} : { redirect: href }} replace />;
  }

  async function handleSignOut() {
    await signOut();
    // Drop every cached app data, so Back cannot show it, and remember why the session ended.
    queryClient.clear();
    queryClient.setQueryData<SessionState>(sessionQueryKey, { user: null, signedOut: true });
  }

  return (
    <AppLayout user={state.user} onSignOut={() => void handleSignOut()}>
      <Outlet />
    </AppLayout>
  );
}
