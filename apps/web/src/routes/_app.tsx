import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Outlet, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { signOut } from "@/api/auth";
import { AppLayout } from "@/components/app-layout";
import { endSession, sessionQueryOptions } from "@/features/auth/session";
import { shellMessages } from "@/messages";

export const Route = createFileRoute("/_app")({ component: SignedInApp });

/** Every app page needs a session; without one, Login (and back here after signing in). */
function SignedInApp() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const [signOutFailed, setSignOutFailed] = useState(false);
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
    setSignOutFailed(false);
    // If the server may still hold the session, stay: Login would only let the user back in.
    if (!(await signOut())) {
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
