#!/usr/bin/env bash
# apply-ruleset.sh — make the live repo's branch protection match a committed ruleset.
#
# Governance-as-code: the JSON files in .github/rulesets/ are the single source of truth for how `main`
# is protected. This script applies ONE of them via the GitHub API so protection is reproducible and
# reviewable in a PR — never hand-clicked in the UI and silently forgotten. Idempotent: it updates the
# ruleset if one with the same name already exists, otherwise creates it.
#
# GitHub composes all active rulesets (their rules are unioned), so protection is intentionally split
# into separately-appliable files — each applied on its own, so one can be rolled out or rolled back
# without touching the others (ADR-0033):
#   - main-protection.json   the full intended protection (PR approval + the core required checks).
#   - e2e-acceptance.json     ONLY the proven full-stack E2E + NFR-P1 lighthouse required checks.
#
#   scripts/apply-ruleset.sh [owner/repo] [ruleset-file]
#     owner/repo    defaults to the current checkout's origin.
#     ruleset-file  a file name under .github/rulesets/ (or a path); defaults to main-protection.json.
#
#   # apply only the e2e acceptance gates (the narrow ratchet step), leaving main-protection as-is:
#   scripts/apply-ruleset.sh "" e2e-acceptance.json
#
# Requires: gh (authenticated with admin on the repo). No jq needed — uses gh's built-in --jq and node.
set -euo pipefail

REPO="${1:-$(gh repo view --json nameWithOwner -q .nameWithOwner)}"
RULESET_FILE="${2:-main-protection.json}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# Resolve the ruleset file: an absolute/relative path as given, else a name under .github/rulesets/.
if [ -f "$RULESET_FILE" ]; then
  JSON="$RULESET_FILE"
else
  JSON="$ROOT/.github/rulesets/$RULESET_FILE"
fi

[ -f "$JSON" ] || { echo "ruleset file not found: $JSON" >&2; exit 1; }
NAME="$(node -e "process.stdout.write(require(process.argv[1]).name)" "$JSON")"

# Find an existing ruleset with this name (an idempotent upsert keyed on the name).
ID="$(gh api "repos/$REPO/rulesets" --jq ".[] | select(.name==\"$NAME\") | .id" | head -n1 || true)"

if [ -n "${ID:-}" ]; then
  echo "Updating ruleset '$NAME' (id $ID) on $REPO from $JSON …"
  gh api -X PUT "repos/$REPO/rulesets/$ID" --input "$JSON" >/dev/null
else
  echo "Creating ruleset '$NAME' on $REPO from $JSON …"
  gh api -X POST "repos/$REPO/rulesets" --input "$JSON" >/dev/null
fi

echo "Done — live protection on $REPO now matches $JSON."
echo "Verify: gh api repos/$REPO/rulesets --jq '.[].name'"
