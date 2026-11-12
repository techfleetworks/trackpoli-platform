// POST /admin/api/accept-invite — the invited administrator activates their account (TP1-09, P1-08). It is
// reachable at aal1 (the accept-invite funnel is exempt from RequireMfa) but requires the invited session
// established by the /auth/confirm Continue page. Thin: validate the new password, then delegate to the
// acceptInvite service, which (defence in depth, judge-arch L1) sets the password ONLY for an account that is
// live-status 'invited', then calls complete-invite to flip invited → active. The service's typed outcome is
// returned as-is (ADR-0005): a below-policy password is "weak_password", a missing/expired invite session is
// "no_session"; only an unexpected failure is a 5xx.

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { acceptInvite, buildAcceptInvitePorts } from "@/features/auth/acceptInvite";

// Minimum 12 characters (NFR-S2), matching Supabase's minimum_password_length and the reset screen. Capped
// so an oversized value cannot be used to make the password hash expensive.
const Body = z.object({ password: z.string().min(12).max(128) }).strict();

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
    return NextResponse.json({ outcome: "weak_password" } as const);
  }

  const result = await acceptInvite(
    { password: parsed.data.password, ip: clientIp(request) },
    buildAcceptInvitePorts(request),
  );
  return NextResponse.json(result);
}
