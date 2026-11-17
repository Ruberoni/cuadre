import { Link, useRouterState } from "@tanstack/react-router";
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
import { defaultProductsSearch } from "@/features/products/search";
import { cn } from "@/lib/utils";
import { shellMessages } from "@/messages";

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

/** The frame of every signed-in page (Design System → AppLayout). */
export function AppLayout({ children }: { children: ReactNode }) {
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
      <aside className="fixed inset-y-0 left-0 w-(--sidebar-width) border-r border-sidebar-border bg-sidebar">
        <div className="flex h-(--header-height) items-center px-4 text-section-title font-bold text-sidebar-primary">
          {shellMessages.wordmark}
        </div>
        <nav aria-label={shellMessages.navLabel} className="flex flex-col gap-1 px-2 py-2">
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
          {children}
        </main>
      </div>
    </AppPageContext>
  );
}
