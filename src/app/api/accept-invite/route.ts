// POST /admin/api/accept-invite — the invited administrator activates their account (TP1-09, P1-08). It is
// reachable at aal1 (the accept-invite funnel is exempt from RequireMfa) but requires the invited session
// established by the /auth/confirm Continue page. Thin: validate the new password, set it on the invited
// account (auth.updateUser), then forward to the complete-invite edge function to flip invited → active and
// write the audit event. Returns a typed outcome (ADR-0005): a below-policy password is a business outcome
// ("weak_password"), a missing/expired invite session is "no_session"; only an unexpected failure is a 5xx.

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { EdgeFunctionError, invokeUserFunction } from "@/features/auth/edgeClient";
import { createServerSupabase, readInviteStatus } from "@/lib/supabase/server";

// Minimum 12 characters (NFR-S2), matching Supabase's minimum_password_length and the reset screen. Capped
// so an oversized value cannot be used to make the password hash expensive.
const Body = z.object({ password: z.string().min(12).max(128) }).strict();

type AcceptInviteResult = { outcome: "done" } | { outcome: "no_session" } | { outcome: "weak_password" };

/** The real client IP from the edge/proxy headers; forwarded so the activation event records its origin. */
function clientIp(request: NextRequest): string | null {
  return (
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    null
  );
}

export async function POST(request: NextRequest) {
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    // Below the length policy (or no body): a weak password, surfaced without touching the account.
    return NextResponse.json({ outcome: "weak_password" } satisfies AcceptInviteResult);
  }

  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ outcome: "no_session" } satisfies AcceptInviteResult);
  }
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    return NextResponse.json({ outcome: "no_session" } satisfies AcceptInviteResult);
  }

  // Defence in depth (judge-arch L1): this route sets a password, so it must set one ONLY during activation —
  // never as an un-reauthenticated password change for an already-active administrator who reaches it (an
  // activated session's token claim can lag, so middleware routing alone is not enough). Read the LIVE own
  // status via the sanctioned data-access helper (readable at aal1 via profiles_select_own): an already-active
  // caller is sent on without touching their credential (idempotent "done"), and anything other than invited
  // is treated as a spent/absent invite.
  const status = await readInviteStatus(request);
  if (status !== "invited") {
    return NextResponse.json({
      outcome: status === "active" ? "done" : "no_session",
    } satisfies AcceptInviteResult);
  }

  // Set the invited account's password (email accounts; a Google-only invite uses the Google button and
  // never reaches this route). Supabase also enforces the minimum length and, on paid plans, the
  // leaked-password check — surface either as "weak_password" rather than a 500.
  const { error: pwError } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (pwError) {
    const code = (pwError as { code?: string }).code;
    const statusCode = (pwError as { status?: number }).status;
    if (code === "weak_password" || code === "validation_failed" || statusCode === 422) {
      return NextResponse.json({ outcome: "weak_password" } satisfies AcceptInviteResult);
    }
    throw pwError; // unexpected (transport/auth) — let it surface as a 500 the client retries
  }

  // Activate: complete-invite flips invited → active and writes admin.invite_accepted. It is idempotent, so a
  // retry after a password set is safe.
  try {
    await invokeUserFunction("complete-invite", {}, session.access_token, clientIp(request));
    return NextResponse.json({ outcome: "done" } satisfies AcceptInviteResult);
  } catch (error) {
    if (
      error instanceof EdgeFunctionError &&
      (error.code === "unauthenticated" || error.code === "forbidden")
    ) {
      // The invite session is gone or no longer invited — treat as an expired link, not a hard error.
      return NextResponse.json({ outcome: "no_session" } satisfies AcceptInviteResult);
    }
    throw error;
  }
}
