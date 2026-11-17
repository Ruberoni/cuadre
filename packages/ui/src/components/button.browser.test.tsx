import { flushSync } from "react-dom";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import snapshot from "../../design-system/tokens.json";
import "../styles/globals.css";
import { Button } from "./button.tsx";

// Expected values come from the synced Design System snapshot, never from literals here.
const token = (family: "color" | "radius", name: string): string => {
  const found = snapshot[family].tokens.find((entry) => entry.name === name);
  if (!found) throw new Error(`Token ${name} is not in the snapshot`);
  return found.value;
};

const hexToRgb = (hex: string): string => {
  const [r, g, b] = [1, 3, 5].map((start) => Number.parseInt(hex.slice(start, start + 2), 16));
  return `rgb(${r}, ${g}, ${b})`;
};

let mounted: { root: Root; host: HTMLElement } | undefined;

function renderButton(): CSSStyleDeclaration {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  mounted = { root, host };
  flushSync(() => root.render(<Button>Guardar producto</Button>));
  const button = host.querySelector("button");
  if (!button) throw new Error("The button did not render");
  return getComputedStyle(button);
}

afterEach(() => {
  mounted?.root.unmount();
  mounted?.host.remove();
  mounted = undefined;
});

describe("shadcn Button with the synced tokens", () => {
  it("takes its fill, text color and radius from the Design System tokens", () => {
    const style = renderButton();

    expect(style.backgroundColor).toBe(hexToRgb(token("color", "primary")));
    expect(style.color).toBe(hexToRgb(token("color", "primary-foreground")));
    expect(style.borderTopLeftRadius).toBe(token("radius", "radius-md"));
  });

  it("uses Inter, the Design System's single sans-serif", () => {
    expect(renderButton().fontFamily).toContain("Inter");
  });
});
