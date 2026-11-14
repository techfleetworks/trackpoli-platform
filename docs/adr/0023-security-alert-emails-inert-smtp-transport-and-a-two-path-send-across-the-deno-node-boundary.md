# 0023. Security alert emails: an inert-until-configured SMTP transport, and a two-path send across the Deno/Node boundary

Date: 2026-11-13

## Status

Accepted

Builds on the admin-management email handling ([0021](0021-manage-administrators-authoritative-status-best-effort-side-effects-and-delete-then-reinvite.md)),
the self-service profile & security changes ([0022](0022-my-profile-and-security-settings-tabbed-shell-and-self-service-account-writes.md)),
and the "fail-closed but inert" deploy posture for domain-blocked infrastructure ([0015](0015-staging-deploy-self-skips-until-configured-fail-closed-but-inert.md)).

## Context

TP1-12 (P1-18) delivers the minimum set of out-of-band security alerts: an **email‑changed** notice (to the old
*and* the new address), a **password‑changed** notice, and a **two‑factor‑device‑replaced** notice. Each says
what changed, when (UTC, day‑month‑year), and what to do if it wasn't the person; none carries a link or a
secret (NFR‑P4). A failed send must log one operational event and must not undo the change. Several points were
left to implementation:

1. **What is the transport?** The project's existing emails (invite, recovery) ride **GoTrue/Supabase SMTP**,
   which is **not configured yet** (domain‑blocked, Q‑1‑21). The three TP1‑12 notices are **not** GoTrue email
   events (there is no "password changed" or "2FA replaced" GoTrue template, and the manager‑driven
   `change-email` uses the admin API, which notifies no one), so they must be sent by our own code. The domain
   is trackpoli.com at **Porkbun**, whose email offering is a **mailbox/SMTP** service, not a transactional
   API.
2. **Where do the sends live?** `change-email` is an edge function (Deno). But **password‑changed** (TP1‑11)
   and **two‑factor‑replaced** (TP1‑04) happen in **Next API routes (Node)**, which cannot import a Deno
   `_shared` module. The deliverable names `supabase/functions/_shared/notices.ts` — one templates home.
3. **How do we test it** when the repo has no Deno test runner (edge functions are covered by BDD/E2E, which
   are harness‑gated)?

## Decision

**One pure templates module shared by Deno and the Node tests; an SMTP transport that is inert until
configured; and two send paths that meet at that one templates home.**

- **SMTP transport, inert‑until‑configured (resolves 1).** `_shared/notices.ts` `buildSmtpTransport()` reads the
  `SMTP_*` function secrets (the Porkbun trackpoli.com mailbox) and returns a transport, or **null** when any
  secret is absent. While it is null — the current domain‑blocked state — every caller stays **inert**: it logs
  one `reportNonFatal` "skipped, SMTP not configured" event and returns ok, never failing or undoing the
  account change. This is the ADR‑0015 "fail‑closed but inert" posture, and it matches `request-password-reset`,
  which already expects its send to fail during this period. The mailer is **dynamically imported** only when
  SMTP is configured, so the inert path loads no mail dependency at all and the exact client can be swapped at
  wiring time.
- **One pure templates + fan‑out module (resolves 1 and 3).** `_shared/noticeTemplates.ts` holds the three
  templates, the UTC formatter, the `NoticeTransport` port, and `sendSecurityNotice(transport, recipients, …)`,
  with **no Deno/npm/jsr/network imports**. So the Deno edge code imports it, and the Node test suite (vitest)
  imports it by a relative path to prove the content rules (no links/secrets) and the fan‑out in CI — even
  though the edge runtime itself is not unit‑tested here. The transport is an injected port, so the fan‑out is
  tested with a fake.
- **Two send paths meeting at one templates home (resolves 2).** `change-email` (edge) imports the helpers and
  sends the **email‑changed** notice to the old and the new address inline, after its authoritative change and
  audit event. The **password‑changed** and **two‑factor‑replaced** changes run in Next routes, so they call a
  new **internal‑only** edge function `send-security-notice` (verify_jwt=false + `assertInternalCall`) via
  `invokeInternalFunction`. That function resolves the recipient from the **user id the trusted server
  supplied** (never a body‑supplied address), builds the transport and sends. The Node side
  (`notifySecurityChange`) is **best‑effort**: it never throws and never changes the route's outcome.
- **Rejected alternatives (pattern-selector).** (a) A second, Node‑side mailer with its own copy of the
  templates — two homes that drift; rejected. (b) Driving the notices asynchronously off the migration‑007
  audit events via a Supabase DB webhook — the cleanest decoupling, but more infrastructure than Phase 1 needs
  and not yet configured; recorded here as the intended future improvement.
- **Best‑effort, reported, never undone.** A missing transport or a failed send writes exactly one operational
  event (`security_notice_skipped_unconfigured` / `security_notice_send_failed`, no email/name in the message)
  and the change stands — the ticket's acceptance and the `reportNonFatal` contract (ADR‑0021).
- **No links or secrets (NFR‑P4, OWASP).** Templates state only what/when/what‑to‑do; `send-security-notice` is
  internal‑only, so it cannot be abused to send mail to arbitrary addresses or to probe who has an account.

## Consequences

- **Good.** One templates home; the pure core is CI‑tested now despite the Deno runtime; the live send drops in
  the moment the Porkbun mailbox + SMTP secrets + DNS exist, with no caller change; a notice can never block or
  undo the security change it reports; internal‑only + server‑resolved recipient keep the sender from becoming
  an attack surface. The same Porkbun SMTP, once set as Supabase's custom SMTP, also unblocks the existing
  invite/recovery sends.
- **Cost.** The password/2FA flows take one extra internal edge round‑trip (awaited but swallowed). SMTP mailbox
  sending is fine for these low‑volume, per‑account alerts but is not a bulk relay. Deliverability needs
  SPF/DKIM/DMARC on trackpoli.com or the alerts land in spam.
- **Limitation (evidence state: not-assessed).** While domain‑blocked the live send does not deliver, so
  **E2E‑18's live pass is deferred** to the full‑stack harness, as for every other Phase‑1 email flow. The three
  templates, the fan‑out, and the Node dispatch wiring are unit‑tested now; the edge functions are covered by
  the BDD scenarios (harness‑gated). The chosen `npm:nodemailer` client under the Supabase edge runtime is
  asserted from its documented npm‑specifier support, not observed running, since it is only reached once
  configured.
