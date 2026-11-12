// resend-invite: an Administrator Manager re-sends an invitation to someone who has not yet accepted (TP1-09,
// P1-08). MANAGER-only, aal2. Only a profile still in status 'invited' can be re-invited; an active or
// deactivated target is a conflict. Throttled to 3 resends per invited admin per hour so an inbox cannot be
// flooded (contract, section 4).
//
// SPIKE (TP1-09, Q-1-03): the mechanism for re-sending to an already-created but unconfirmed user is the
// ticket's one-day spike, confirmed against the live Supabase + SMTP stack (domain-blocked, Q-1-21). The
// chosen approach is inviteUserByEmail again for the unconfirmed user; the documented fallbacks, in order,
// are generateLink of type 'invite'/'magiclink' sent through the project's SMTP, then delete-and-recreate.
// The outcome is recorded in decisions.md; the contract here stays unchanged whichever mechanism wins.

import { z } from "npm:zod@4";
import { serve } from "../_shared/serve.ts";
import { verifyCaller } from "../_shared/auth.ts";
import { writeEvent } from "../_shared/events.ts";
import { enforceRateLimit, rateKey } from "../_shared/rateLimit.ts";
import { AppError } from "../_shared/errors.ts";

const Body = z.object({ admin_id: z.string().uuid() }).strict();

const MAX_PER_ADMIN = 3;
const WINDOW_SECONDS = 60 * 60;

serve("resend-invite", async ({ req, admin, ip, requestId }) => {
  const caller = await verifyCaller(req, { requireAal2: true });
  if (caller.role !== "admin_manager") {
    throw new AppError("forbidden", "Only an Administrator Manager can resend invitations");
  }

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) throw new AppError("validation_failed", "Invalid request", "admin_id");
  const { admin_id } = parsed.data;

  const { data: target, error: readError } = await admin
    .from("profiles")
    .select("id,email,display_name,status")
    .eq("id", admin_id)
    .maybeSingle();
  if (readError) throw new AppError("internal", "Could not read the administrator");
  if (!target) throw new AppError("not_found", "That administrator does not exist");
  if (target.status !== "invited") {
    throw new AppError("conflict", "Only a pending invitation can be resent");
  }

  await enforceRateLimit(admin, rateKey("resend-invite", "admin", admin_id), MAX_PER_ADMIN, WINDOW_SECONDS);

  const appUrl = Deno.env.get("APP_URL") ?? "";
  const { error: inviteError } = await admin.auth.admin.inviteUserByEmail(target.email, {
    data: { display_name: target.display_name },
    redirectTo: `${appUrl}/accept-invite`,
  });
  if (inviteError) {
    // During the domain-blocked period (Q-1-21, no SMTP) this send is expected to fail; serve reports the
    // internal failure to the operational log. The spike decides the final mechanism (see the header note).
    throw new AppError("internal", "Could not resend the invite");
  }

  await writeEvent(admin, {
    actor: caller.userId,
    action: "admin.invite_resent",
    subjectType: "admin",
    subjectId: admin_id,
    summary: `${caller.displayName} resent an invitation`,
    ip,
    requestId,
  });

  return { ok: true };
});
