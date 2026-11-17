// Guard for ADR-0031. The skill-receipt gate binds every `applied` entry's `where` files to the change
// diff. CI built that diff with `--diff-filter=ACMR`, which DROPS deleted files. A PR whose whole point is a
// deletion ("remove the dead Banner component") legitimately applies a skill TO the file it deletes, so the
// honest receipt cited that file - and the gate rejected it as "not in the change diff". The receipt was
// structurally un-passable for deletion PRs (#54, #56 red on exactly this).
//
// The fix: the receipt job's changed-list uses `--diff-filter=ACMRD` (deletions INCLUDED). These tests FAIL if
// that is reverted, so the regression cannot return silently. They also assert the arch-review job's list stays
// deletion-FREE, because that gate greps file CONTENTS and a deleted file has none (verifiable-quality-gates:
// each guard discriminates - flip either filter and the matching test goes red).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");
// Normalize CRLF so the job-block regex is line-ending agnostic (Windows checkouts carry \r\n).
const yml = readFileSync(resolve(REPO, ".github/workflows/gates.yml"), "utf8").replace(/\r\n/g, "\n");

// Split the workflow into its top-level jobs (2-space-indented keys under `jobs:`), so each assertion reads
// only the block it names and cannot be satisfied by a different job's filter line.
function jobBlock(name) {
  const re = new RegExp(`\\n  ${name}:\\n([\\s\\S]*?)(?=\\n  [A-Za-z0-9_-]+:\\n|$)`);
  const m = yml.match(re);
  assert.ok(m, `gates.yml must define a "${name}" job`);
  return m[1];
}

// Pull every `--diff-filter=XXXX` token out of a block.
function diffFilters(block) {
  return [...block.matchAll(/--diff-filter=([A-Z]+)/g)].map((m) => m[1]);
}

test("the receipt job's changed-list includes deletions (ACMRD), so a deletion PR can cite the file it deletes", () => {
  const filters = diffFilters(jobBlock("receipt"));
  assert.ok(filters.length > 0, "the receipt job must compute a --diff-filter changed-list");
  assert.ok(
    filters.every((f) => f.includes("D")),
    `every --diff-filter in the receipt job must include D (deletions); found ${JSON.stringify(filters)}. ` +
      "Without D the receipt's diff-binding rejects a deletion PR that honestly cites the file it removes. See ADR-0031.",
  );
});

test("the arch-review job's changed-list excludes deletions, because it greps file contents", () => {
  const filters = diffFilters(jobBlock("arch-review"));
  assert.ok(filters.length > 0, "the arch-review job must compute a --diff-filter changed-list");
  assert.ok(
    filters.every((f) => !f.includes("D")),
    `no --diff-filter in the arch-review job may include D; found ${JSON.stringify(filters)}. ` +
      "That gate greps each changed file's contents, and a deleted file has none to grep. See ADR-0031.",
  );
});
