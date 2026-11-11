// record-terms: the signed-in administrator's acceptance of the current terms and privacy notice (TP1-08,
// Q-1-20). It is a POST-AUTHENTICATION function, so it composes verifyCaller (not assertInternalCall). It
// runs at aal1 — terms come BEFORE the two-factor code (migration 009) — and with allowInvited, because an
// invited administrator must accept before onboarding (AGENTS.md).
//
// It records the acceptance ONLY for the CURRENT version of EVERY document: if a submitted version does not
// match the current one (the text changed while the user was reading, Q-1-22), it returns `conflict` (409)
// and the screen reloads and asks again. The write is IDEMPOTENT via the unique (admin_id, document,
// version) constraint, so a repeat POST is a safe no-op. The policy_acceptances row IS the tamper-evident
// consent record (append-only + immutable, migration 009) — attributed (admin_email snapshot), timestamped,
// and carrying the request id and origin IP — so no separate audit event is written, and nothing here can be
// changed or deleted after the fact (compliance-data-lifecycle: consent evidence, NFR-S12).

import { z } from "npm:zod@4";
import { serve } from "../_shared/serve.ts";
import { verifyCaller } from "../_shared/auth.ts";
import { AppError } from "../_shared/errors.ts";

const DOCUMENTS = ["terms", "privacy"] as const;

const Body = z
  .object({
    acceptances: z
      .array(
        z
          .object({
            document: z.enum(DOCUMENTS),
            version: z.string().min(1).max(32),
          })
          .strict(),
      )
      .min(1)
      .max(2),
  })
  .strict();

serve("record-terms", async ({ req, admin, ip, requestId }) => {
  const caller = await verifyCaller(req, { allowInvited: true });

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) throw new AppError("validation_failed", "Invalid request");

  // The authoritative current versions. Service-role read: policy_versions is public to authenticated, but
  // we read it with the admin client to be independent of the caller's RLS context.
  const { data: versionRows, error: versionsError } = await admin
    .from("policy_versions")
    .select("document,current_version");
  if (versionsError) throw new AppError("internal", "Could not read policy versions");
  const currentVersion = new Map<string, string>();
  for (const row of versionRows ?? []) currentVersion.set(row.document, row.current_version);

  // Accept only the CURRENT version of EVERY document. A mismatch or a missing document means the user read a
  // stale version: a conflict (409), not a silent partial acceptance.
  const rows: Array<Record<string, unknown>> = [];
  for (const document of DOCUMENTS) {
    const version = currentVersion.get(document);
    if (!version) throw new AppError("internal", "Policy versions are not configured");
    const submitted = parsed.data.acceptances.find((acceptance) => acceptance.document === document);
    if (!submitted || submitted.version !== version) {
      throw new AppError("conflict", "The policy versions have changed; reload and accept the current ones");
    }
    rows.push({
      admin_id: caller.userId,
      admin_email: caller.email, // snapshot: the acceptance record outlives the account (NFR-S12)
      document,
      version,
      ip,
      request_id: requestId,
    });
  }

  // Idempotent: ON CONFLICT DO NOTHING on the unique (admin_id, document, version) key, so a retry or a
  // double-click records each acceptance exactly once and never fails. No UPDATE occurs, so the append-only
  // immutability trigger is never tripped.
  const { error: insertError } = await admin
    .from("policy_acceptances")
    .upsert(rows, { onConflict: "admin_id,document,version", ignoreDuplicates: true });
  if (insertError) throw new AppError("internal", "Could not record acceptance");

  return { accepted: true };
});
