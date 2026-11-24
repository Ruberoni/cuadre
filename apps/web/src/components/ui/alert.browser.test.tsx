import { flushSync } from "react-dom";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import "@/styles/globals.css";
import { Alert, AlertDescription, AlertTitle } from "./alert.tsx";

let mounted: { root: Root; host: HTMLElement } | undefined;

function renderAlert(element: React.ReactElement): HTMLElement {
  const host = document.createElement("div");
  host.style.width = "600px";
  document.body.append(host);
  const root = createRoot(host);
  mounted = { root, host };
  flushSync(() => root.render(element));
  const alert = host.querySelector<HTMLElement>('[data-slot="alert"]');
  if (!alert) throw new Error("The alert did not render");
  return alert;
}

afterEach(() => {
  mounted?.root.unmount();
  mounted?.host.remove();
  mounted = undefined;
});

describe("Alert layout", () => {
  it("renders plain text horizontally without needing className='block'", () => {
    const alert = renderAlert(
      <Alert variant="destructive">
        Solo un administrador o compras puede gestionar proveedores.
      </Alert>,
    );

    const rect = alert.getBoundingClientRect();
    expect(rect.width).toBeGreaterThan(500);
    // Single-line text inside px-4 py-3 stays compact instead of wrapping one word per line.
    expect(rect.height).toBeLessThan(64);
  });

  it("renders AlertTitle and AlertDescription full-width when there is no icon", () => {
    const alert = renderAlert(
      <Alert>
        <AlertTitle>Error de conexión</AlertTitle>
        <AlertDescription>Revisar la conexión e intentar de nuevo.</AlertDescription>
      </Alert>,
    );

    const title = alert.querySelector<HTMLElement>('[data-slot="alert-title"]');
    const description = alert.querySelector<HTMLElement>('[data-slot="alert-description"]');
    if (!title || !description) throw new Error("Missing AlertTitle or AlertDescription");

    const alertRect = alert.getBoundingClientRect();
    const titleRect = title.getBoundingClientRect();
    const descRect = description.getBoundingClientRect();

    // Both start right after the 16px horizontal padding (no phantom 0px icon gutter).
    expect(titleRect.left - alertRect.left).toBeLessThanOrEqual(20);
    expect(descRect.left - alertRect.left).toBeLessThanOrEqual(20);
    expect(titleRect.width).toBeGreaterThan(500);
    expect(descRect.width).toBeGreaterThan(500);
  });

  it("places AlertTitle and AlertDescription in column 2 when an svg icon is present", () => {
    const alert = renderAlert(
      <Alert>
        <svg aria-hidden="true" viewBox="0 0 16 16" />
        <AlertTitle>Atención</AlertTitle>
        <AlertDescription>Mensaje con ícono.</AlertDescription>
      </Alert>,
    );

    const icon = alert.querySelector("svg");
    const title = alert.querySelector<HTMLElement>('[data-slot="alert-title"]');
    const description = alert.querySelector<HTMLElement>('[data-slot="alert-description"]');
    if (!icon || !title || !description) throw new Error("Missing icon, title, or description");

    const iconRect = icon.getBoundingClientRect();
    const titleRect = title.getBoundingClientRect();
    const descRect = description.getBoundingClientRect();

    expect(titleRect.left).toBeGreaterThan(iconRect.right);
    expect(descRect.left).toBe(titleRect.left);
  });
});
