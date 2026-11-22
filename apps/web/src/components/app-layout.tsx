import {
  EXCHANGE_RATE_ROLES,
  PRODUCT_ROLES,
  type Role,
  type SessionUser,
  SUPPLIER_ROLES,
} from "@cuadre/contracts";
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
import { useCurrentExchangeRate } from "@/api/exchange-rates";
import { type NavGroup, visibleNavGroups } from "@/components/nav-items";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { defaultExchangeRatesSearch } from "@/features/exchange-rates/search";
import { defaultProductsSearch } from "@/features/products/search";
import { defaultSuppliersSearch } from "@/features/suppliers/search";
import { formatBcvRate, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { roleLabels, shellMessages } from "@/messages";

type PageContext = {
  /** Undefined only while the session loads, when no page content renders. */
  user: SessionUser | undefined;
  setTitle: (title: string) => void;
  /** Shows a status line (role="status") above the page content. */
  announce: (text: string, options?: { persistAcrossNextNavigation?: boolean }) => void;
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

/**
 * The signed-in user, for pages that hide what their role cannot use (the API still enforces it).
 * Page content only renders once the session has loaded, so there always is one.
 */
export function useSignedInUser(): SessionUser {
  const context = useContext(AppPageContext);
  if (context?.user === undefined) throw new Error("useSignedInUser needs <AppLayout user>");
  return context.user;
}

/** Status lines: `announce("Producto X creado.")` persists across navigation; pass `false` on the same page. */
export function useStatusAnnouncer(): (
  text: string,
  options?: { persistAcrossNextNavigation?: boolean },
) => void {
  const context = useContext(AppPageContext);
  if (context === undefined) throw new Error("useStatusAnnouncer needs <AppLayout>");
  return context.announce;
}

type NavRoute = "/productos" | "/tasas-bcv" | "/proveedores";

// Grouped sidebar items for screens that exist, each with the roles that see it (PLAN → Roles).
const NAV_GROUPS: readonly NavGroup<NavRoute>[] = [
  {
    id: "general",
    label: shellMessages.navGroups.general,
    items: [
      { to: "/productos", label: shellMessages.products, roles: PRODUCT_ROLES.read },
      { to: "/tasas-bcv", label: shellMessages.exchangeRates, roles: EXCHANGE_RATE_ROLES.read },
    ],
  },
  {
    id: "purchasing",
    label: shellMessages.navGroups.purchasing,
    items: [{ to: "/proveedores", label: shellMessages.suppliers, roles: SUPPLIER_ROLES.read }],
  },
];

function defaultSearchFor(to: NavRoute) {
  switch (to) {
    case "/productos":
      return defaultProductsSearch;
    case "/tasas-bcv":
      return defaultExchangeRatesSearch;
    case "/proveedores":
      return defaultSuppliersSearch;
  }
}

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

  const announce = useCallback(
    (text: string, options?: { persistAcrossNextNavigation?: boolean }) => {
      keepStatusOnNextNavigation.current = options?.persistAcrossNextNavigation ?? true;
      setStatus(text);
    },
    [],
  );
  const context = useMemo(() => ({ user, setTitle, announce }), [user, announce]);

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
              className="flex flex-1 flex-col gap-4 px-2 py-2"
            >
              {visibleNavGroups(NAV_GROUPS, user.role).map((group) => (
                <section
                  key={group.id}
                  aria-labelledby={`nav-group-${group.id}`}
                  className="flex flex-col gap-1"
                >
                  <p
                    id={`nav-group-${group.id}`}
                    className="px-3 text-caption font-medium text-muted-foreground"
                  >
                    {group.label}
                  </p>
                  {group.items.map((item) => (
                    <Link
                      key={item.to}
                      to={item.to}
                      search={defaultSearchFor(item.to)}
                      // Active on every page of the section, whatever its search params or sub-page.
                      activeOptions={{ includeSearch: false }}
                      className={navLinkClass}
                    >
                      {item.label}
                    </Link>
                  ))}
                </section>
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
        <header className="sticky top-0 z-10 flex h-(--header-height) items-center justify-between gap-4 border-b border-border bg-background px-6">
          <h1 className="text-page-title">{title}</h1>
          {user === undefined ? null : <HeaderExchangeRate role={user.role} />}
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

function HeaderExchangeRate({ role }: { role: Role }) {
  const current = useCurrentExchangeRate();
  if (current.isPending || current.isError || current.data === undefined) return null;

  const { rate } = current.data;
  if (rate !== null) {
    return (
      <div className="flex items-center gap-1.5 text-body">
        <span className="text-muted-foreground">
          {shellMessages.headerRatePrefix(formatDate(rate.date))}
        </span>
        <span className="font-semibold tabular-nums">{formatBcvRate(rate.rate)}</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Badge variant="warning">{shellMessages.noRateBadge}</Badge>
      {EXCHANGE_RATE_ROLES.write.includes(role) ? (
        <Link
          to="/tasas-bcv"
          search={{ page: 1, registrar: true }}
          className="inline-flex min-h-(--target-min) items-center rounded-sm text-label text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          {shellMessages.registerRateLink}
        </Link>
      ) : (
        <span className="text-caption text-muted-foreground">{shellMessages.noRateOtherRoles}</span>
      )}
    </div>
  );
}
