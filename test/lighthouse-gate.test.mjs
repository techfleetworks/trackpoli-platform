// Discriminating tests for scripts/check-lighthouse.mjs (the NFR-P1 performance gate for the admin shell).
//
// verifiable-quality-gates requires every automated check ship a test that runs the REAL check end to end
// and FAILS when the check is neutralised. The check launches Chrome against a running app, which the
// dependency-free `node --test` suite has no way to do, so these feed the per-run samples the live browser
// would have produced through the check's test-only seam (CHECK_LIGHTHOUSE_SAMPLES_FIXTURE). The seam
// supplies INPUTS only — the real median + budget-comparison + exit-code logic still runs and is what is
// asserted here. A no-op "always pass" gate would turn every red-on-regression test below green, so they
// are the mutation guard: neutralise the budget comparison and these go red.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CHECK = resolve(REPO, "scripts/check-lighthouse.mjs");
const URL = "http://localhost:3000/admin/gallery/shell";

// Healthy samples: ~770ms LCP, low TBT, strong score — the real build, as observed in CI artifacts.
const HEALTHY = [
  { lcpMs: 770, tbtMs: 60, perfScore: 0.98 },
  { lcpMs: 800, tbtMs: 70, perfScore: 0.97 },
  { lcpMs: 780, tbtMs: 65, perfScore: 0.98 },
  { lcpMs: 820, tbtMs: 80, perfScore: 0.96 },
  { lcpMs: 760, tbtMs: 55, perfScore: 0.99 },
];

// Write a temp config + a samples fixture, run the REAL check with the seam set, return {status,out}.
function run({ samples, config = {}, pages = ["/admin/gallery/shell"], fixtureRaw } = {}) {
  const dir = mkdtempSync(join(tmpdir(), "lh-gate-"));
  const cfgPath = join(dir, "lighthouse.config.json");
  const fxPath = join(dir, "samples.json");
  const outPath = join(dir, "out.json");
  writeFileSync(
    cfgPath,
    JSON.stringify({
      baseUrl: "http://localhost:3000",
      pages,
      formFactor: "desktop",
      samples: 5,
      budgets: { lcpMs: 2500, tbtMs: 600, perfScore: 0.8 },
      ...config,
    }),
  );
  writeFileSync(fxPath, fixtureRaw !== undefined ? fixtureRaw : JSON.stringify({ [URL]: samples }));
  const r = spawnSync(process.execPath, [CHECK, "--config", cfgPath, "--out", outPath], {
    encoding: "utf8",
    env: { ...process.env, CHECK_LIGHTHOUSE_SAMPLES_FIXTURE: fxPath },
  });
  return { status: r.status, out: (r.stdout || "") + (r.stderr || ""), dir };
}

// --- healthy page passes -----------------------------------------------------------------------------
test("the healthy shell (median LCP ~780ms) PASSES", () => {
  const r = run({ samples: HEALTHY });
  assert.equal(r.status, 0, r.out);
  assert.match(r.out, /PASS/);
});

// --- planted LCP regression is detected (the core NFR-P1 signal) -------------------------------------
test("a planted LCP regression (sustained ~3000ms) FAILS, naming LCP and NFR-P1", () => {
  const samples = [
    { lcpMs: 3000, tbtMs: 60, perfScore: 0.9 },
    { lcpMs: 3100, tbtMs: 65, perfScore: 0.9 },
    { lcpMs: 2950, tbtMs: 70, perfScore: 0.9 },
    { lcpMs: 3050, tbtMs: 60, perfScore: 0.9 },
    { lcpMs: 3200, tbtMs: 55, perfScore: 0.9 },
  ];
  const r = run({ samples });
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /LCP/);
  assert.match(r.out, /NFR-P1/);
});

test("a planted perfScore regression (median 0.60 < 0.80 floor) FAILS", () => {
  const samples = [
    { lcpMs: 800, tbtMs: 60, perfScore: 0.6 },
    { lcpMs: 800, tbtMs: 60, perfScore: 0.58 },
    { lcpMs: 800, tbtMs: 60, perfScore: 0.62 },
    { lcpMs: 800, tbtMs: 60, perfScore: 0.6 },
    { lcpMs: 800, tbtMs: 60, perfScore: 0.61 },
  ];
  const r = run({ samples });
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /performance score/);
});

test("a planted TBT regression (median ~900ms > 600ms) FAILS", () => {
  const samples = [
    { lcpMs: 800, tbtMs: 880, perfScore: 0.85 },
    { lcpMs: 800, tbtMs: 900, perfScore: 0.85 },
    { lcpMs: 800, tbtMs: 920, perfScore: 0.85 },
    { lcpMs: 800, tbtMs: 910, perfScore: 0.85 },
    { lcpMs: 800, tbtMs: 890, perfScore: 0.85 },
  ];
  const r = run({ samples });
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /TBT/);
});

// --- MEDIAN is the anti-flake property: outliers must not move the verdict ---------------------------
test("one flaky spike among healthy runs does NOT fail (median is immune to a single outlier)", () => {
  // Exactly the observed flake: 4 good runs + 1 huge spike. The OLD one-shot gate failed on the spike;
  // the median gate must not. If this ever goes red the stabilisation has regressed.
  const samples = [
    { lcpMs: 770, tbtMs: 60, perfScore: 0.98 },
    { lcpMs: 800, tbtMs: 70, perfScore: 0.97 },
    { lcpMs: 9000, tbtMs: 1200, perfScore: 0.3 }, // flaky runner spike
    { lcpMs: 780, tbtMs: 65, perfScore: 0.98 },
    { lcpMs: 760, tbtMs: 55, perfScore: 0.99 },
  ];
  const r = run({ samples });
  assert.equal(r.status, 0, r.out);
});

test("a SUSTAINED regression (majority of runs slow) still FAILS — median does not hide a real slowdown", () => {
  const samples = [
    { lcpMs: 3000, tbtMs: 60, perfScore: 0.9 },
    { lcpMs: 3100, tbtMs: 65, perfScore: 0.9 },
    { lcpMs: 3050, tbtMs: 70, perfScore: 0.9 },
    { lcpMs: 770, tbtMs: 60, perfScore: 0.98 }, // two good runs cannot rescue it
    { lcpMs: 800, tbtMs: 70, perfScore: 0.97 },
  ];
  const r = run({ samples });
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /LCP/);
});

// --- fail closed -------------------------------------------------------------------------------------
test("a page with ZERO valid samples -> exit 2 (could not measure; never a silent pass)", () => {
  const r = run({ samples: [{ lcpMs: null, tbtMs: null, perfScore: null }] });
  assert.equal(r.status, 2, r.out);
  assert.match(r.out, /zero valid/);
});

test("an empty pages array -> exit 2", () => {
  const r = run({ samples: HEALTHY, pages: [] });
  assert.equal(r.status, 2, r.out);
});

test("a samples fixture with no entry for the page -> exit 2 (fail closed)", () => {
  const r = run({ fixtureRaw: JSON.stringify({ "http://localhost:3000/other": HEALTHY }) });
  assert.equal(r.status, 2, r.out);
});

test("a malformed samples fixture (not JSON) -> exit 2", () => {
  const r = run({ fixtureRaw: "{ not json" });
  assert.equal(r.status, 2, r.out);
});

test("a missing config file -> exit 2", () => {
  const dir = mkdtempSync(join(tmpdir(), "lh-gate-"));
  const r = spawnSync(process.execPath, [CHECK, "--config", join(dir, "nope.json")], { encoding: "utf8" });
  assert.equal(r.status, 2);
});

// --- a disabled secondary budget is honoured (not every run has all three) ---------------------------
test("with tbtMs/perfScore omitted, only the LCP budget is enforced (healthy LCP passes)", () => {
  const samples = [
    { lcpMs: 800, tbtMs: 5000, perfScore: 0.1 },
    { lcpMs: 820, tbtMs: 5000, perfScore: 0.1 },
    { lcpMs: 790, tbtMs: 5000, perfScore: 0.1 },
    { lcpMs: 810, tbtMs: 5000, perfScore: 0.1 },
    { lcpMs: 800, tbtMs: 5000, perfScore: 0.1 },
  ];
  const r = run({ samples, config: { budgets: { lcpMs: 2500 } } });
  assert.equal(r.status, 0, r.out);
});

// cleanup is best-effort; the OS tmpdir is reclaimed.
test("cleanup", () => { try { rmSync(mkdtempSync(join(tmpdir(), "lh-gate-rm-")), { recursive: true, force: true }); } catch { /* ignore */ } });
