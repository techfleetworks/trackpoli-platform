# Multi-developer deploy runbook — GitHub → Vercel → Supabase

How several developers deploy TrackPoli to **Supabase** and **Vercel** themselves, safely, without
anyone running a production deploy from their laptop. The pipeline is already built (ADR-0015;
`deploy-staging.yml`, `deploy-production.yml`, `database.yml`) and stays **inert until the cloud
projects, secrets, and team access below exist**. This doc is the access + process half.

For the exact value-by-value "which secret comes from where," see
[`tp1-02-credentials.md`](tp1-02-credentials.md). For what to do when something breaks, see
[`../runbook.md`](../runbook.md). For the PR gate contract, see [`../../CONTRIBUTING.md`](../../CONTRIBUTING.md).

---

## The model: Git is the deploy button

Nobody types `vercel --prod` or `supabase db push` against a shared environment from their machine.
Every shared deploy is a Git event that CI runs, so it is reviewed, reproducible, and reversible.

```
  dev branch ──PR──▶ CI gates ──review/approve──▶ merge to main
                                                                        │
                                                   deploy-staging.yml (automatic)
                                                   • supabase db push  → staging DB (expand-only)
                                                   • functions deploy  → staging
                                                   • vercel deploy     → staging app
                                                                        │
                                              deploy-production.yml (manual: Actions → Run workflow)
                                              • gated by the "production" Environment reviewers
                                              • same expand-first order, then Vercel prod
                                                                        │
                                              rollback = run the same workflow with action=rollback
```

- **"Deploy to staging yourself" = merge your PR to `main`.** The `deploy-staging` job runs on every
  push to `main` and does the Supabase migration, the Edge Functions, and the Vercel deploy.
- **"Deploy to production" = anyone starts the `deploy-production` workflow**, but it pauses on the
  GitHub `production` Environment until a required reviewer approves. That approval *is* the control —
  not who can click the button.
- **Local development stays fully self-serve:** `npm run dev:all` (`supabase start && next dev`) runs
  a throwaway local Supabase on each dev's machine. They never touch staging/production to build.
- **Per-PR Vercel preview URLs are intentionally OFF.** Shared deploys go through the Vercel CLI inside
  Actions, and the Vercel project is not Git-auto-deploying, so no preview environment is provisioned.
  Developers verify locally (`npm run dev:all`) and on **staging** after merge. Production is the only
  hosted target that matters here. If previews are ever wanted later, that is a new decision (an ADR).

---

## 1. Access: who gets what

Grant per person, in each of the three services. The rule: individuals get enough to **build and open
PRs**; shared **secrets are never handed to individuals** — they live only in each service's settings
and are used by CI. Production is gated by review, not by withholding Git access.

| Person / principal | GitHub | Vercel | Supabase |
|---|---|---|---|
| Every developer | **Write** on `techfleetworks/trackpoli-platform` | **Member** of the Vercel team (sees deploys, preview logs, env var *names*) | **Developer/Member** on the Supabase org (read dashboards, run local CLI with their own access token) |
| Maintainers (the CODEOWNERS team) | Write + listed in [`.github/CODEOWNERS`](../../.github/CODEOWNERS) | Member | Owner/Admin on the Supabase org |
| Production approvers | Added as **required reviewers** on the `production` Environment | — | — |
| CI (GitHub Actions) | — | Uses `VERCEL_TOKEN` (a GitHub secret), not a person | Uses `SUPABASE_ACCESS_TOKEN` + DB passwords (GitHub secrets) |

Least privilege, concretely:

- A developer never needs the Supabase **service-role key** or the production **DB password**. Those
  live in Vercel server env / GitHub Actions secrets and are read by code and CI, never pasted to a
  person. Keep them out of chat and out of git (`.env.example` says the same).
- Prefer **one Vercel token owned by CI** (store it as the `VERCEL_TOKEN` GitHub secret) over each dev
  minting their own. If a dev does create a personal Vercel/Supabase token for local use, it is theirs
  and scoped to them; it never goes into the repo.

How to invite:

- **GitHub:** Repo → Settings → Collaborators and teams → add the team/person with **Write**.
- **Vercel:** Team → Settings → Members → Invite (role **Member**; **Owner** only for maintainers).
- **Supabase:** Organization → Team → Invite member (role **Developer**; **Owner/Admin** for maintainers).

---

## 2. One-time platform setup (maintainer checklist)

Do this once. Until it is done the deploy workflows self-skip or stay inert (by design), so `main`
pushes do not error.

### a. Provision the cloud projects

1. **Supabase:** create `trackpoli-staging` and `trackpoli-production` (Region: Europe). Steps and the
   key-by-key mapping are in [`tp1-02-credentials.md`](tp1-02-credentials.md) §1.
2. **Vercel:** create the project and link it to `techfleetworks/trackpoli-platform` (Region: Europe /
   `fra1`). Set the app env vars (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
   `SUPABASE_SERVICE_ROLE_KEY`, `INTERNAL_CALL_SECRET`, Sentry/Turnstile) for **both** Preview and
   Production, per [`tp1-02-credentials.md`](tp1-02-credentials.md) §2 and [`../../.env.example`](../../.env.example).

### b. Set the GitHub Actions secrets and variables

Repo → Settings → **Secrets and variables → Actions**.

**Secrets** (encrypted; the workflows read these):

| Secret | Used by | Source |
|---|---|---|
| `SUPABASE_ACCESS_TOKEN` | staging + production migrate/functions | Supabase → Account → Access Tokens |
| `STAGING_SUPABASE_DB_PASSWORD` | staging migrate | Supabase staging project DB settings |
| `PRODUCTION_SUPABASE_DB_PASSWORD` | production migrate | Supabase production project DB settings |
| `VERCEL_TOKEN` | staging + production app deploy | Vercel → Account → Tokens |
| `VERCEL_ORG_ID` | app deploy | Vercel → Project → Settings → General |
| `VERCEL_PROJECT_ID` | app deploy | same page |

**Variables** (not secret; gate whether a job runs):

| Variable | Effect |
|---|---|
| `STAGING_SUPABASE_PROJECT_REF` | **Setting this turns staging ON.** `deploy-staging` self-skips while it is empty. |
| `PRODUCTION_SUPABASE_PROJECT_REF` | the project ref the production deploy pushes to |

### c. Create the GitHub Environments and reviewers

Repo → Settings → **Environments**:

- **`staging`** — no reviewers (auto-deploys on merge to `main`).
- **`production`** — add the **required reviewers** (at least one; the production workflow expects a
  **second migration reviewer** too). This is the human gate on `deploy-production`.

### d. Turn on branch protection and code-owner review

1. Apply the committed ruleset: `scripts/apply-ruleset.sh` (defined in
   [`.github/rulesets/main-protection.json`](../../.github/rulesets/main-protection.json)). It requires
   the CI gate checks and one approving review to merge to `main`.
2. Create the maintainers team referenced in [`.github/CODEOWNERS`](../../.github/CODEOWNERS) (or swap
   in real `@handles`), then flip `"require_code_owner_review": true` in the ruleset and re-apply, so
   migration and deploy-pipeline changes cannot merge without a maintainer's review.

### e. Smoke-test the pipeline (before trusting it)

1. Open a tiny PR → confirm the CI gates run green.
2. Merge it → watch `deploy-staging` run green in the Actions tab; open the staging URL.
3. Run `deploy-production` (Actions → deploy-production → Run workflow → `deploy`) → confirm it **pauses
   for approval**, approve, and verify production.
4. Run it again with `action=rollback` on staging-like data first if possible, to confirm rollback works.

---

## 3. How a developer ships a change (the daily loop)

1. **Branch** off `main`. Build locally: `npm run dev:all` (local Supabase + Next). Add a migration
   under `supabase/migrations/` if the schema changes — **expand-only** (new columns/tables/functions;
   nothing destructive in the same release). Regenerate types: `npm run gen:types`.
2. **Gates before you push:** `npm run check:blocking` must exit 0. A schema change also needs
   `npm run check:migrations`; follow the PR checklist in [`../../CONTRIBUTING.md`](../../CONTRIBUTING.md)
   (ADR, `@security` scenario for auth, skill receipt, arch-review log).
3. **Open the PR.** CI runs the gates and the `database` workflow (real Supabase pgTAP) if you touched
   `supabase/**`. Get the review(s); CODEOWNERS auto-requests a maintainer on migrations/deploy files.
4. **Merge to `main`.** `deploy-staging` runs automatically → your change is on staging. You deployed it.
5. **Promote to production** when staging looks good: Actions → **deploy-production** → Run workflow →
   `deploy`. It waits for a `production` reviewer to approve, then migrates + deploys production.

---

## 4. Rollback

- **App (fast):** Actions → deploy-production → Run workflow → `action=rollback`. This re-promotes the
  last known-good Vercel deployment. Also doable from the Vercel dashboard (Deployments → Promote).
- **Database:** rollback does **not** undo a migration. Because the expand phase is backward-compatible,
  the previous app still runs against the new schema. Destructive "contract" changes (dropping old
  columns) are a **separate, later** migration made only after a release is stable — so a rollback never
  meets a missing column (release-deployment-safety).

---

## 5. Secrets & least-privilege rules (do not drift)

- Secrets live in **Supabase settings**, **Vercel env vars**, or **GitHub Actions secrets** — never in
  git, never in chat, never in a `NEXT_PUBLIC_*` var (those reach the browser).
- The service-role key and production DB password are **CI/server only**. No developer needs them to
  build; the browser never calls Supabase directly.
- Rotate `VERCEL_TOKEN` and `SUPABASE_ACCESS_TOKEN` when someone with access leaves, and remove them
  from the GitHub/Vercel/Supabase member lists the same day.
