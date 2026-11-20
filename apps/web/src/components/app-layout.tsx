import type { SessionUser } from "@cuadre/contracts";
import { Link, useRouterState } from "@tanstack/react-router";
import { LogOutIcon } from "lucide-react";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { defaultProductsSearch } from "@/features/products/search";
import { cn } from "@/lib/utils";
import { roleLabels, shellMessages } from "@/messages";

type PageContext = {
  setTitle: (title: string) => void;
  /** Shows a status line (role="status") above the page content until the next navigation. */
  announce: (text: string) => void;
};

const AppPageContext = createContext<PageContext | undefined>(undefined);

/** Sets the page `<h1>` (in the header) and the document title ("Productos · Cuadre"). */
export function usePageTitle(title: string): void {
  const context = useContext(AppPageContext);
  if (context === undefined) throw new Error("usePageTitle needs <AppLayout>");
  const { setTitle } = context;
  useEffect(() => {
    setTitle(title);
    document.title = shellMessages.documentTitle(title);
  }, [setTitle, title]);
}

/** Status lines for the next page: `announce("Producto X creado.")`, then navigate. */
export function useStatusAnnouncer(): (text: string) => void {
  const context = useContext(AppPageContext);
  if (context === undefined) throw new Error("useStatusAnnouncer needs <AppLayout>");
  return context.announce;
}

// Items of screens that exist. The rest of the Design System's navigation arrives with its slice.
const NAV_ITEMS = [{ to: "/productos", label: shellMessages.products }] as const;

const navLinkClass = cn(
  "relative flex min-h-(--control-height) items-center rounded-md px-3 py-1.5 text-body text-sidebar-foreground",
  "hover:bg-sidebar-accent",
  "focus-visible:outline-sidebar-ring",
  "aria-[current=page]:bg-primary-subtle aria-[current=page]:font-semibold aria-[current=page]:text-primary-subtle-foreground",
  "aria-[current=page]:before:absolute aria-[current=page]:before:inset-y-0 aria-[current=page]:before:left-0 aria-[current=page]:before:w-[3px] aria-[current=page]:before:rounded-sm aria-[current=page]:before:bg-sidebar-primary",
);

/**
 * The frame of every signed-in page (Design System → AppLayout). Without a `user` (the session is
 * still loading) only the empty frame shows: no nav, no footer, nothing in `<main>`, so a nav for the
 * wrong role never appears (App shell handoff, #7).
 */
export function AppLayout({
  user,
  onSignOut,
  error,
  children,
}: {
  user?: SessionUser | undefined;
  onSignOut?: () => void;
  /** A shell-level failure (Cerrar sesión did not go through), above the page content. */
  error?: string | undefined;
  children?: ReactNode;
}) {
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState<string | undefined>(undefined);
  const keepStatusOnNextNavigation = useRef(false);
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  // The status line outlives the navigation that follows `announce`, and the one after it clears it.
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs on navigation only
  useEffect(() => {
    if (keepStatusOnNextNavigation.current) {
      keepStatusOnNextNavigation.current = false;
      return;
    }
    setStatus(undefined);
  }, [pathname]);

  const announce = useCallback((text: string) => {
    keepStatusOnNextNavigation.current = true;
    setStatus(text);
  }, []);
  const context = useMemo(() => ({ setTitle, announce }), [announce]);

  return (
    <AppPageContext value={context}>
      <a
        href="#contenido"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-20 focus:rounded-md focus:bg-background focus:px-3 focus:py-2 focus:text-label focus:text-primary"
      >
        {shellMessages.skipLink}
      </a>
      <aside className="fixed inset-y-0 left-0 flex w-(--sidebar-width) flex-col border-r border-sidebar-border bg-sidebar">
        <div className="flex h-(--header-height) items-center px-4 text-section-title font-bold text-sidebar-primary">
          {shellMessages.wordmark}
        </div>
        {user === undefined ? null : (
          <>
            <nav
              aria-label={shellMessages.navLabel}
              className="flex flex-1 flex-col gap-1 px-2 py-2"
            >
              {NAV_ITEMS.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  search={defaultProductsSearch}
                  // Active on every page of the section, whatever its search params or sub-page.
                  activeOptions={{ includeSearch: false }}
                  className={navLinkClass}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
            <div className="flex items-center justify-between gap-2 border-t border-sidebar-border px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-table font-medium text-sidebar-foreground">
                  {user.name}
                </p>
                <p className="text-caption text-muted-foreground">{roleLabels[user.role]}</p>
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={shellMessages.signOut}
                title={shellMessages.signOut}
                onClick={onSignOut}
              >
                <LogOutIcon aria-hidden="true" />
              </Button>
            </div>
          </>
        )}
      </aside>
      <div className="pl-(--sidebar-width)">
        <header className="sticky top-0 z-10 flex h-(--header-height) items-center border-b border-border bg-background px-6">
          <h1 className="text-page-title">{title}</h1>
        </header>
        <main id="contenido" tabIndex={-1} className="p-6 outline-none">
          {/* Always mounted: a live region that appears together with its text is often not read. */}
          <div role="status" className="empty:hidden">
            {status === undefined ? null : (
              <Alert variant="success" role="none" className="mb-4 block">
                {status}
              </Alert>
            )}
          </div>
          {error === undefined ? null : (
            <Alert variant="destructive" role="alert" className="mb-4 block">
              {error}
            </Alert>
          )}
          {user === undefined ? null : children}
        </main>
      </div>
    </AppPageContext>
  );
}
