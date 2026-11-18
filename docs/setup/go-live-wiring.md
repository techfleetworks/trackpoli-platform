# Go-live wiring checklist

What you need to do, per service, to get Porkbun, Sentry, Turnstile, Google OAuth, Vercel and Supabase
working so the app deploys and every feature functions. The accounts are provisioned; this is the
**dashboard wiring** that connects them.

> **Never paste a secret into chat or commit one to git.** Each secret value goes straight into the
> service's own settings page (Vercel env, Supabase dashboard, or GitHub Actions secrets).

---

## The big picture

**"Deploying" is largely already working** — production is live and the deploy pipeline
(`.github/workflows/deploy-production.yml`) has everything it needs in GitHub. What's missing is the
**per-feature wiring in each service's dashboard** (bot-check, emails, Google login, error tracking). None
of those values belong in your code or GitHub — they go into **Vercel env vars** or the **Supabase
dashboard**.

### Three destinations

| Destination | What it's for | Status |
|---|---|---|
| **GitHub → Settings → Secrets and variables → Actions** | CI deploy | ✅ Supabase + Vercel already set |
| **Vercel → Project → Settings → Environment Variables** | app runtime | can't be seen from the repo — you set these |
| **Supabase dashboard** (Auth settings + Edge Function secrets) | auth, emails, bot-check | can't be seen from the repo — you set these |

---

## Per service — what you do

### 1. Supabase — project `ytwhxwpqncglkpemdnqc`

- [ ] **Vercel env** (Production + Preview): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
      (from Project → API), and `SUPABASE_SERVICE_ROLE_KEY` (**secret — server env only**).
- [ ] **Auth → Settings:** set **Access token (JWT) expiry = 300 seconds** (closes a TP1-05 item); set
      **Site URL = `https://trackpoli.com/admin`** and add it to the redirect allow-list.
- [ ] **Edge Function secrets** (Dashboard → Edge Functions → Secrets, or `supabase secrets set`):
      `INTERNAL_CALL_SECRET`, `TURNSTILE_SECRET_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SITE_URL`,
      `ALLOWED_ORIGINS` (leave empty), plus the SMTP set from Porkbun below.

### 2. Vercel

- [ ] Already linked (GitHub has the token/org/project). You just need the **env vars** above and below set
      for **Production and Preview**.
- [ ] ⚠️ **`INTERNAL_CALL_SECRET` must be the _same value_ in Vercel env and in the Supabase function
      secrets** — the Next server signs internal calls with it and the Edge Functions verify it. If they
      differ, sign-in's bot-check and the security emails break.

### 3. Cloudflare Turnstile — the sign-in "are you a robot?" check

- [ ] **Site key** → Vercel env `NEXT_PUBLIC_TURNSTILE_SITE_KEY`
- [ ] **Secret key** → Supabase Edge Function secret `TURNSTILE_SECRET_KEY`
- [ ] Add `trackpoli.com` (and `localhost` for testing) to the Turnstile **allowed hostnames**.

> Until this is set, the sign-in page shows "Bot check appears here once configured."

### 4. Google OAuth — "Continue with Google"

- [ ] In **Google Cloud Console**: set the authorized redirect URI to
      `https://ytwhxwpqncglkpemdnqc.supabase.co/auth/v1/callback`.
- [ ] In **Supabase → Auth → Providers → Google**: paste the **Client ID** and **Client Secret**, enable
      the provider.

> No code/env change — Supabase handles the handshake; the app's only part is the `/admin/auth/callback` route.

### 5. Sentry — error tracking

- [ ] **DSN** → Vercel env `NEXT_PUBLIC_SENTRY_DSN` **and** `SENTRY_DSN`; also add `SENTRY_DSN` as a
      Supabase function secret.
- [ ] **Auth token** → **GitHub secret `SENTRY_AUTH_TOKEN`** (for source-map upload at build).
      **← missing from GitHub.**

### 6. Porkbun — the emails (recovery, invite, security alerts)

- [ ] Enable **Porkbun Email Hosting** (the free *forwarding* plan can't send via SMTP) and create a sender
      mailbox, e.g. `security@trackpoli.com`.
- [ ] Add **SPF, DKIM, DMARC** DNS records on `trackpoli.com` (or inbox delivery will fail / go to spam).
- [ ] Put the SMTP credentials in **two places**:
  - **Supabase → Auth → SMTP settings** (custom SMTP) → powers **recovery + invite** emails.
  - **Supabase Edge Function secrets** `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` / `SMTP_FROM`
    → powers the **security-alert** notices.

### Cloudflare — DNS / edge (for the real domain)

- [ ] Point `trackpoli.com` DNS at Vercel, SSL **Full (strict)**, add the **never-cache `/admin/*`** rule
      and sign-in/reset **rate-limiting**.

---

## The only true GitHub gaps

1. [ ] **`SENTRY_AUTH_TOKEN`** — not set (needed for Sentry source maps on build).
2. [ ] **Staging isn't wired** — `deploy-staging.yml` self-skips until you add the **variable**
       `STAGING_SUPABASE_PROJECT_REF` and the **secret** `STAGING_SUPABASE_DB_PASSWORD`. *(Skip this if
       you're production-only for now.)*

Everything else is **Vercel env / Supabase dashboard** config that can't be seen from the repo — so only
you can confirm it's done.

---

## What each piece unblocks

| Once wired | Unblocks |
|---|---|
| Turnstile (site + secret key) | Sign-in bot-check; the full sign-in flow |
| Porkbun SMTP + DNS | Recovery emails (TP1-03), invite emails (TP1-09), security alerts (TP1-12) |
| Google OAuth | "Continue with Google" sign-in, invite-with-Google, device-replace re-auth (TP1-04/09/10) |
| Supabase JWT = 300s | A TP1-05 acceptance item |
| Sentry DSN + token | Error reporting + readable stack traces in production |
| Cloudflare edge | Session-timeout / caching behaviour behind the real domain (TP1-02/05) |

See `docs/setup/tp1-02-credentials.md` for the original account-creation steps and `.env.example` for the
exact variable names.
