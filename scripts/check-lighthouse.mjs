#!/usr/bin/env node
/**
 * check-lighthouse — the NFR-P1 performance gate for the admin shell (TP1-07, P1-12).
 *
 * NFR-P1: "Shell loads and is interactive in 2.5 seconds or less on a mid-range laptop on broadband (LCP)."
 * This runs Lighthouse against the shell and fails if Largest Contentful Paint exceeds the budget (or the
 * overall performance score / Total Blocking Time fall below their floors). It writes the full result,
 * including every per-run sample, to reports/lighthouse-results.json.
 *
 * STABILITY (why this gate measures the way it does — see docs/adr/0032):
 *   - DETERMINISTIC device model. Lighthouse runs with throttlingMethod:"simulate" and an EXPLICIT, fixed
 *     throttling block (rttMs / throughputKbps / cpuSlowdownMultiplier). The score then models a fixed
 *     device from the trace via Lantern, instead of reflecting the raw, drifting CPU of a shared CI runner.
 *   - AVERAGED. Each URL is measured N times (config.samples, default 5) and the MEDIAN of lcpMs / tbtMs /
 *     perfScore is what the budget is checked against, so a single flaky run cannot flip the gate.
 *   - PINNED browser. The e2e workflow installs a fixed Chrome and exports CHROME_PATH; chrome-launcher
 *     honours it, so the browser version does not drift between runs. No app change is needed for that.
 *
 * FAIL CLOSED. "I could not measure" and "I measured and it passed" are different outcomes with different
 * exit codes. A Chrome-launch failure, a missing/empty config, zero pages, or a URL that yields zero valid
 * samples all exit non-zero — never a silent exit 0. Exit 0 = every page within budget; 1 = a budget
 * breach; 2 = usage / environment error.
 *
 * Like the axe gate (run-axe.mjs), it is NOT dependency-free and does NOT run in the dependency-free CI: it
 * needs `lighthouse` + `chrome-launcher` and a RUNNING app. The shell demo is gated off in a normal prod
 * build, so build/start the measurement target with the gallery enabled first:
 *
 *   npm i -D lighthouse chrome-launcher          # already in devDependencies
 *   NEXT_PUBLIC_ENABLE_GALLERY=1 npm run build
 *   NEXT_PUBLIC_ENABLE_GALLERY=1 npm run start & # serve the production build on :3000
 *   node scripts/check-lighthouse.mjs --config lighthouse.config.json --out reports/lighthouse-results.json
 *
 * TEST-ONLY SEAM (verifiable-quality-gates): the discrimination test (test/lighthouse-gate.test.mjs) cannot
 * launch Chrome in the dependency-free `node --test` suite, so it injects the per-run samples the live
 * browser would have produced via CHECK_LIGHTHOUSE_SAMPLES_FIXTURE (a JSON file of url -> array of
 * {lcpMs,tbtMs,perfScore}). The seam feeds INPUTS only; the real median + budget-comparison + exit-code
 * logic still runs and is what the test exercises. It activates ONLY when that env var is set — prod and CI
 * never set it, so with it unset the measurement path below is byte-for-byte the live-Chrome path.
 *
 * The lighthouse/chrome-launcher imports are dynamic so this file parses (and the seam path runs) even where
 * lighthouse is not installed, so it can live in the repo alongside the committed config.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

function die(code, msg) {
  console.error(`check-lighthouse: ${msg}`);
  process.exit(code);
}
function opt(name, def) {
  const i = process.argv.indexOf(name);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : def;
}
// Median of the finite numbers in `nums`; null when none are finite.
function median(nums) {
  const xs = nums.filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
  if (!xs.length) return null;
  const mid = Math.floor(xs.length / 2);
  return xs.length % 2 ? xs[mid] : (xs[mid - 1] + xs[mid]) / 2;
}

const CONFIG = resolve(opt("--config", "lighthouse.config.json"));
const OUT = resolve(opt("--out", "reports/lighthouse-results.json"));

let cfg;
try {
  cfg = JSON.parse(readFileSync(CONFIG, "utf8"));
} catch (e) {
  die(2, `cannot read config ${CONFIG}: ${e.message}`);
}
const baseUrl = (cfg.baseUrl || "http://localhost:3000").replace(/\/$/, "");
const pages = Array.isArray(cfg.pages) && cfg.pages.length ? cfg.pages : die(2, "config.pages must be a non-empty array");
const budgets = cfg.budgets || {};
const lcpMs = Number(budgets.lcpMs ?? 2500);
const tbtMs = budgets.tbtMs == null ? null : Number(budgets.tbtMs);
const perfScore = budgets.perfScore == null ? null : Number(budgets.perfScore);
const formFactor = cfg.formFactor === "mobile" ? "mobile" : "desktop";

// How many times to measure each URL; the budget is checked against the MEDIAN. Odd N (default 5) is best.
const samples = Math.max(1, Math.trunc(Number(opt("--samples", cfg.samples ?? 5))));
if (!Number.isFinite(samples)) die(2, "config.samples must be a positive integer");

// Explicit, fixed device model so the score does not reflect the raw CI-runner CPU. Desktop defaults model
// a mid-range laptop on broadband (NFR-P1); overridable via config.throttling.
const t = cfg.throttling || {};
const throttling = {
  rttMs: Number(t.rttMs ?? 40),
  throughputKbps: Number(t.throughputKbps ?? 10240),
  cpuSlowdownMultiplier: Number(t.cpuSlowdownMultiplier ?? 1),
  requestLatencyMs: Number(t.requestLatencyMs ?? 0),
  downloadThroughputKbps: Number(t.downloadThroughputKbps ?? 0),
  uploadThroughputKbps: Number(t.uploadThroughputKbps ?? 0),
};

const urlFor = (page) => (page.startsWith("http") ? page : `${baseUrl}${page}`);

// Collect `samples` raw measurements for every page, either from the live browser or (test-only) from the
// injected fixture. Returns { [url]: [{ lcpMs, tbtMs, perfScore }, ...] }. Fails closed on any error.
async function collectSamples() {
  const FIXTURE = process.env.CHECK_LIGHTHOUSE_SAMPLES_FIXTURE; // set ONLY by tests; never in prod/CI
  if (FIXTURE) {
    let injected;
    try {
      injected = JSON.parse(readFileSync(resolve(FIXTURE), "utf8"));
    } catch (e) {
      die(2, `cannot read samples fixture ${FIXTURE}: ${e.message}`);
    }
    const out = {};
    for (const page of pages) {
      const url = urlFor(page);
      const rows = injected[url] ?? injected[page];
      if (!Array.isArray(rows)) die(2, `samples fixture has no array of samples for ${url}`);
      out[url] = rows.map((r) => ({
        lcpMs: r?.lcpMs == null ? null : Number(r.lcpMs),
        tbtMs: r?.tbtMs == null ? null : Number(r.tbtMs),
        perfScore: r?.perfScore == null ? null : Number(r.perfScore),
      }));
    }
    return out;
  }

  // ---- live measurement path (byte-for-byte unchanged by the seam when the env var is unset) ----
  let lighthouse, chromeLauncher;
  try {
    ({ default: lighthouse } = await import("lighthouse"));
    chromeLauncher = await import("chrome-launcher");
  } catch (e) {
    die(2, `lighthouse + chrome-launcher are required but not importable (${e.message}). Install the devDependencies and run against a started app.`);
  }

  let chrome;
  try {
    chrome = await chromeLauncher.launch({ chromeFlags: ["--headless=new", "--no-sandbox", "--disable-gpu"] });
  } catch (e) {
    die(2, `could not launch Chrome (${e.message}). Ensure Chrome is installed/pinned and CHROME_PATH is set.`);
  }

  const base = {
    logLevel: "error",
    output: "json",
    onlyCategories: ["performance"],
    port: chrome.port,
    formFactor,
    throttlingMethod: "simulate",
    throttling,
    screenEmulation:
      formFactor === "desktop"
        ? { mobile: false, width: 1350, height: 940, deviceScaleFactor: 1, disabled: false }
        : undefined,
  };

  const out = {};
  let envError = null;
  try {
    for (const page of pages) {
      const url = urlFor(page);
      const rows = [];
      for (let i = 0; i < samples; i++) {
        let run;
        try {
          run = await lighthouse(url, base);
        } catch (e) {
          // A thrown measurement is an environment error, not a pass. Record it, stop, and (after Chrome is
          // killed in the finally) exit 2 — never let it surface as an unhandled rejection or a silent pass.
          envError = `Lighthouse run failed for ${url}: ${e.message}`;
          break;
        }
        const lhr = run?.lhr;
        rows.push({
          lcpMs: lhr?.audits?.["largest-contentful-paint"]?.numericValue ?? null,
          tbtMs: lhr?.audits?.["total-blocking-time"]?.numericValue ?? null,
          perfScore: lhr?.categories?.performance?.score ?? null,
        });
      }
      if (envError) break;
      out[url] = rows;
    }
  } finally {
    try { await chrome.kill(); } catch { /* ignore */ }
  }
  if (envError) die(2, envError);
  return out;
}

const samplesByUrl = await collectSamples();

const results = [];
const failures = [];
for (const page of pages) {
  const url = urlFor(page);
  const rows = samplesByUrl[url] || [];
  const mLcp = median(rows.map((r) => r.lcpMs));
  const mTbt = median(rows.map((r) => r.tbtMs));
  const mScore = median(rows.map((r) => r.perfScore));

  // Fail closed: a page we could not actually measure is NOT a pass.
  if (mLcp == null && mTbt == null && mScore == null) {
    die(2, `${url}: zero valid Lighthouse samples (could not measure; failing closed)`);
  }

  results.push({ url, samples: rows, lcpMs: mLcp, tbtMs: mTbt, perfScore: mScore });

  if (mLcp != null && mLcp > lcpMs) failures.push(`${url}: median LCP ${Math.round(mLcp)}ms > budget ${lcpMs}ms (NFR-P1)`);
  if (tbtMs != null && mTbt != null && mTbt > tbtMs) failures.push(`${url}: median TBT ${Math.round(mTbt)}ms > budget ${tbtMs}ms`);
  if (perfScore != null && mScore != null && mScore < perfScore)
    failures.push(`${url}: median performance score ${mScore.toFixed(2)} < floor ${perfScore}`);
}

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(
  OUT,
  JSON.stringify({ config: { baseUrl, budgets, formFactor, samples, throttlingMethod: "simulate", throttling }, results }, null, 2) + "\n",
);

for (const r of results) {
  console.log(
    `  ${r.url}  median of ${r.samples.length}: ` +
      `LCP=${r.lcpMs == null ? "n/a" : Math.round(r.lcpMs) + "ms"}  ` +
      `TBT=${r.tbtMs == null ? "n/a" : Math.round(r.tbtMs) + "ms"}  ` +
      `perf=${r.perfScore == null ? "n/a" : r.perfScore.toFixed(2)}`,
  );
}
if (failures.length) {
  console.error(`\ncheck-lighthouse - FAIL (${failures.length}):`);
  for (const f of failures) console.error(`  • ${f}`);
  process.exit(1);
}
console.log(`\ncheck-lighthouse - PASS. ${results.length} page(s) within budget (median LCP <= ${lcpMs}ms, NFR-P1). Report: ${OUT}`);
