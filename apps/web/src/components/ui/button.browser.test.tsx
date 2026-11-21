import { flushSync } from "react-dom";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import "@/styles/globals.css";
import tokensCss from "@/styles/tokens.css?raw";
import { Button } from "./button.tsx";

// Expected values come from tokens.css (the single source of truth), never from literals here.
const token = (name: string): string => {
  const match = tokensCss.match(new RegExp(`--${name}:\\s*([^;]+);`));
  if (!match?.[1]) throw new Error(`Token --${name} is not in tokens.css`);
  return match[1].trim();
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

describe("shadcn Button with Cuadre tokens", () => {
  it("takes its fill, text color and radius from tokens.css", () => {
    const style = renderButton();

    expect(style.backgroundColor).toBe(hexToRgb(token("primary")));
    expect(style.color).toBe(hexToRgb(token("primary-foreground")));
    expect(style.borderTopLeftRadius).toBe(token("radius-md"));
  });

  it("uses Inter, Cuadre's single sans-serif", () => {
    expect(renderButton().fontFamily).toContain("Inter");
  });
});
