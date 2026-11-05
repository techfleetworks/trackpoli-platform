#!/usr/bin/env node
// Bundle-size gate (TP1-02). The client JavaScript Next ships must stay under budget, so a heavy
// dependency or an accidental client import that bloats the admin app is caught in CI rather than in
// users' browsers. This is a coarse Phase-1 backstop — the total gzipped client JS — which P1-12 can
// refine to per-route First Load JS once the app shell and more routes exist. Run after `npm run build`.

import { readdirSync, readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { join } from "node:path";

const CHUNKS_DIR = ".next/static/chunks";
// Gzipped total client JS budget. Baseline ~178 KB (React 19 + Next runtime + the sign-in screen);
// headroom left for Phase-1 growth. Lower it (and split per-route) when the app shell lands in P1-12.
const BUDGET_KB = 260;

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(p));
    else if (entry.name.endsWith(".js")) out.push(p);
  }
  return out;
}

let files;
try {
  files = walk(CHUNKS_DIR);
} catch {
  console.error(`[check-bundle-size] FAIL - ${CHUNKS_DIR} not found. Run 'npm run build' first.`);
  process.exit(1);
}

let total = 0;
for (const file of files) total += gzipSync(readFileSync(file)).length;
const kb = total / 1024;
console.log(
  `[check-bundle-size] client JS (gzip): ${kb.toFixed(1)} KB across ${files.length} chunk(s); budget ${BUDGET_KB} KB.`,
);
if (kb > BUDGET_KB) {
  console.error(`[check-bundle-size] FAIL - over budget by ${(kb - BUDGET_KB).toFixed(1)} KB.`);
  process.exit(1);
}
console.log("[check-bundle-size] OK");
