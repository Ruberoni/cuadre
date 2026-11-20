import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Outlet, useRouter, useRouterState } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { signOut } from "@/api/auth";
import { AppLayout } from "@/components/app-layout";
import { dropAppData, endSession, sessionQueryOptions } from "@/features/auth/session";
import { shellMessages } from "@/messages";

export const Route = createFileRoute("/_app")({ component: SignedInApp });

/** Every app page needs a session; without one, Login (and back here after signing in). */
function SignedInApp() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const [signOutFailed, setSignOutFailed] = useState(false);
  // Set while Cerrar sesión is on its way: an end of session noticed meanwhile (a 401, a refetch)
  // must still open a clean Login, without `redirect`.
  const signingOut = useRef(false);
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const session = useQuery(sessionQueryOptions);
  const user = session.data?.user ?? null;
  const signedOut = session.data?.signedOut ?? false;
  const leaving = !session.isPending && user === null;

  // Once, when the session turns out missing or ends. The URL is read here, before navigating:
  // read during render it would already be Login's while this page is still mounted.
  useEffect(() => {
    if (!leaving) return;
    const here = router.state.location.href;
    // However the session ended (sign-out, a 401, a refetch), the next user sees none of its data.
    dropAppData(queryClient);
    void router.navigate({
      to: "/login",
      // After Cerrar sesión, Login opens clean; otherwise it brings the user back here.
      search: signedOut || signingOut.current ? {} : { redirect: here },
      replace: true,
    });
  }, [leaving, signedOut, router, queryClient]);

  // The sign-out failure belongs to the page where it happened.
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs on navigation only
  useEffect(() => setSignOutFailed(false), [pathname]);

  // While the session loads (or on the way to Login): the empty frame, never a nav for the wrong role.
  if (user === null) return <AppLayout />;

  async function handleSignOut() {
    setSignOutFailed(false);
    signingOut.current = true;
    const done = await signOut();
    // If the server may still hold the session, stay: Login would only let the user back in.
    if (!done) {
      signingOut.current = false;
      setSignOutFailed(true);
      return;
    }
    await endSession(queryClient, { signedOut: true });
  }

  return (
    <AppLayout
      user={user}
      onSignOut={() => void handleSignOut()}
      error={signOutFailed ? shellMessages.signOutFailed : undefined}
    >
      <Outlet />
    </AppLayout>
  );
}
