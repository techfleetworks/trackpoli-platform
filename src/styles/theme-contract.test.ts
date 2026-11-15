import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { describe, it, expect } from "vitest";

// Executable proof of the ADR-0026 design-system port. Reads the token layer and asserts the Bold Pines
// contract (palette primitives, the Light/Dark semantic mapping, flat radius, brand fonts) AND computes
// WCAG contrast for the semantic colour pairs so a brand-colour regression fails the build. This is the
// verifiable half of the gate: a token swap that broke contrast or dropped a role would fail here.

const here = dirname(fileURLToPath(import.meta.url));
const tokens = readFileSync(join(here, "tokens.css"), "utf8");
const globals = readFileSync(join(here, "..", "app", "globals.css"), "utf8");

/** Resolve a `--name` to its hex, following one var() alias into the --tp-* primitives. */
function hexOf(name: string, scope: string): string {
  // Primitives are defined once in :root; resolve them from the whole file, then look the role up in the
  // given mode scope (the :root block for light, the .dark block for dark).
  const prim: Record<string, string> = {};
  for (const m of tokens.matchAll(/(--tp-[a-z-]+):\s*(#[0-9a-fA-F]{6})\b/g)) prim[m[1]] = m[2].toLowerCase();
  const direct = new RegExp(`${name}:\\s*(#[0-9a-fA-F]{6})\\b`).exec(scope);
  if (direct) return direct[1].toLowerCase();
  const alias = new RegExp(`${name}:\\s*var\\((--tp-[a-z-]+)\\)`).exec(scope);
  if (alias && prim[alias[1]]) return prim[alias[1]];
  throw new Error(`cannot resolve ${name}`);
}

function lin(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}
function lum(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}
function contrast(a: string, b: string): number {
  const la = lum(a), lb = lum(b), hi = Math.max(la, lb), lo = Math.min(la, lb);
  return (hi + 0.05) / (lo + 0.05);
}

// Light :root block and the .dark block, split so each mode resolves against its own role values.
const lightScope = tokens.slice(0, tokens.indexOf(".dark"));
const darkScope = tokens.slice(tokens.indexOf(".dark"));

describe("Bold Pines palette primitives (ADR-0026)", () => {
  const expected: Record<string, string> = {
    "--tp-pine": "#135734",
    "--tp-dark-pine": "#1c352a",
    "--tp-slate": "#33403a",
    "--tp-sage": "#b9cdbd",
    "--tp-mist": "#eef2ee",
    "--tp-coral": "#ff6246",
    "--tp-destructive-orange": "#7c2d12",
  };
  for (const [name, hex] of Object.entries(expected)) {
    it(`${name} = ${hex}`, () => {
      expect(new RegExp(`${name}:\\s*${hex}\\b`, "i").test(tokens)).toBe(true);
    });
  }
});

describe("semantic roles map to the Figma Light/Dark values", () => {
  it("light: background Mist, foreground Dark Pine, primary Pine", () => {
    expect(hexOf("--background", lightScope)).toBe("#eef2ee");
    expect(hexOf("--foreground", lightScope)).toBe("#1c352a");
    expect(hexOf("--primary", lightScope)).toBe("#135734");
  });
  it("dark: background Dark Pine, foreground Mist, primary still Pine", () => {
    expect(hexOf("--background", darkScope)).toBe("#1c352a");
    expect(hexOf("--foreground", darkScope)).toBe("#eef2ee");
    expect(hexOf("--primary", darkScope)).toBe("#135734");
  });
});

describe("WCAG contrast of semantic pairs (target AAA 7:1 for text)", () => {
  const cases: Array<[string, string, string, number]> = [
    ["light foreground/background", "--foreground", "--background", 7],
    ["light primary/primary-foreground", "--primary-foreground", "--primary", 7],
    ["light destructive/destructive-foreground", "--destructive-foreground", "--destructive", 7],
    ["light secondary-foreground/secondary", "--secondary-foreground", "--secondary", 7],
    ["light muted-foreground/background", "--muted-foreground", "--background", 7],
  ];
  for (const [label, fg, bg, min] of cases) {
    it(`${label} >= ${min}:1`, () => {
      expect(contrast(hexOf(fg, lightScope), hexOf(bg, lightScope))).toBeGreaterThanOrEqual(min);
    });
  }
  const darkCases: Array<[string, string, string, number]> = [
    ["dark foreground/background", "--foreground", "--background", 7],
    ["dark primary-foreground/primary", "--primary-foreground", "--primary", 7],
    ["dark secondary-foreground/secondary", "--secondary-foreground", "--secondary", 7],
  ];
  for (const [label, fg, bg, min] of darkCases) {
    it(`${label} >= ${min}:1`, () => {
      expect(contrast(hexOf(fg, darkScope), hexOf(bg, darkScope))).toBeGreaterThanOrEqual(min);
    });
  }
});

describe("radius, fonts, responsive root (ADR-0026)", () => {
  it("radius is the flat 4/8/12/16 scale", () => {
    expect(/--radius-sm:\s*4px/.test(globals)).toBe(true);
    expect(/--radius-md:\s*8px/.test(globals)).toBe(true);
    expect(/--radius-lg:\s*12px/.test(globals)).toBe(true);
    expect(/--radius-xl:\s*16px/.test(globals)).toBe(true);
  });
  it("brand fonts are wired (Mulish heading, Figtree body, Geist Mono)", () => {
    expect(/--tp-font-heading:\s*var\(--font-mulish\)/.test(tokens)).toBe(true);
    expect(/--tp-font-body:\s*var\(--font-figtree\)/.test(tokens)).toBe(true);
    expect(/--tp-font-mono:\s*var\(--font-geist-mono\)/.test(tokens)).toBe(true);
  });
  it("responsive root makes 1rem = 20px (clamp to 24px)", () => {
    expect(/font-size:\s*clamp\(20px,\s*18px \+ 0\.6vw,\s*24px\)/.test(globals)).toBe(true);
  });
});
