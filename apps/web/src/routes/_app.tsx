import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Outlet, useRouter } from "@tanstack/react-router";
import { useEffect } from "react";
import { signOut } from "@/api/auth";
import { AppLayout } from "@/components/app-layout";
import { type SessionState, sessionQueryKey, sessionQueryOptions } from "@/features/auth/session";

export const Route = createFileRoute("/_app")({ component: SignedInApp });

/** Every app page needs a session; without one, Login (and back here after signing in). */
function SignedInApp() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const session = useQuery(sessionQueryOptions);
  const user = session.data?.user ?? null;
  const signedOut = session.data?.signedOut ?? false;
  const leaving = !session.isPending && user === null;

  // Once, when the session turns out missing or ends. The URL is read here, before navigating:
  // read during render it would already be Login's while this page is still mounted.
  useEffect(() => {
    if (!leaving) return;
    const here = router.state.location.href;
    void router.navigate({
      to: "/login",
      // After Cerrar sesión, Login opens clean; otherwise it brings the user back here.
      search: signedOut ? {} : { redirect: here },
      replace: true,
    });
  }, [leaving, signedOut, router]);

  // While the session loads (or on the way to Login): the empty frame, never a nav for the wrong role.
  if (user === null) return <AppLayout />;

  async function handleSignOut() {
    await signOut();
    // Remember why the session ended (this re-renders into Login), then drop every other cached
    // app data so Back cannot show it. Not `clear()`: the session query must keep its observers.
    queryClient.setQueryData<SessionState>(sessionQueryKey, { user: null, signedOut: true });
    queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== sessionQueryKey[0] });
  }

  return (
    <AppLayout user={user} onSignOut={() => void handleSignOut()}>
      <Outlet />
    </AppLayout>
  );
}
