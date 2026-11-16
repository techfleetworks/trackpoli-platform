// Guard for ADR-0030. Tailwind v4's AUTOMATIC content detection scans the whole project (Markdown, JSON,
// the arch-review log), where prose contains the literal `text-[length:var(--md-*)]`. Auto-detection turned
// that shorthand into invalid `font-size: var(--md-*)`, lightningcss rejected it at request time, and the
// production server failed to serve CSS (e2e webServer timeout, lighthouse budget miss) — red on main for
// days while `next build` only warned.
//
// The fix: `src/app/globals.css` loads Tailwind utilities with `source(none)` (auto-detection OFF) and scans
// ONLY an explicit `@source`. These tests FAIL if that fix is reverted, so the regression cannot return
// silently (verifiable-quality-gates: the guard discriminates — remove source(none) and it goes red).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const GLOBALS = resolve(REPO, "src/app/globals.css");
const css = readFileSync(GLOBALS, "utf8");

// Strip CSS block comments so prose in comments can never satisfy (or break) these assertions.
const code = css.replace(/\/\*[\s\S]*?\*\//g, "");

test("globals.css disables Tailwind automatic content detection (source(none))", () => {
  assert.match(
    code,
    /@import\s+["']tailwindcss\/utilities(?:\.css)?["'][^;]*\bsource\(\s*none\s*\)/,
    "the Tailwind utilities import must carry source(none); without it Tailwind v4 scans the whole project (docs, logs) and re-leaks invalid utilities like var(--md-*). See ADR-0030.",
  );
});

test("globals.css scans an explicit app-source glob, not the whole project", () => {
  assert.match(
    code,
    /@source\s+["'][^"']*\.\{ts,tsx\}["']/,
    "with auto-detection off, an explicit @source for the app ts/tsx must remain, or no utilities are generated. See ADR-0030.",
  );
});

test("no Tailwind import re-enables the project-wide sweep", () => {
  // A bare `@import "tailwindcss"` (or utilities) WITHOUT source(none) turns auto-detection back on.
  const bareFullImport = /@import\s+["']tailwindcss["']\s*;/.test(code);
  const utilitiesWithoutSourceNone =
    /@import\s+["']tailwindcss\/utilities(?:\.css)?["'][^;]*;/.test(code) &&
    !/@import\s+["']tailwindcss\/utilities(?:\.css)?["'][^;]*\bsource\(\s*none\s*\)/.test(code);
  assert.ok(
    !bareFullImport && !utilitiesWithoutSourceNone,
    "a Tailwind import without source(none) re-enables project-wide scanning and re-leaks prose candidates. See ADR-0030.",
  );
});
