// POST /admin/api/settings/change-password — the Security-tab change-password endpoint (TP1-11, P1-14).
// Reached only by a signed-in administrator. Thin: validate the body, then delegate to the changePassword
// service, which re-verifies the CURRENT password (GoTrue-rate-limited, never an unthrottled oracle) before
// setting the new one, and refuses a Google-only account. The service's typed outcome is returned as-is (a
// typed-200 envelope the client branches on, like the accept-invite route): a below-policy new password is
// "weak_password", a wrong current password is "wrong_password"; only an unexpected failure is a 5xx.

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { changePassword, buildChangePasswordPorts } from "@/features/settings/security/changePassword";

// The new password meets the section-5 policy (>= 12, NFR-S2); the current password only needs to be present.
// Both are capped so an oversized value cannot be used to make a hash/verify expensive.
const Body = z
  .object({
    currentPassword: z.string().min(1).max(128),
    newPassword: z.string().min(12).max(128),
  })
  .strict();

export async function POST(request: NextRequest) {
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    // A missing current password or a below-length new password: surfaced without touching the account. A
    // too-short new password maps to weak_password (the same outcome GoTrue would give).
    const field = parsed.success ? null : parsed.error.issues[0]?.path[0];
    return NextResponse.json({ outcome: field === "newPassword" ? "weak_password" : "wrong_password" } as const);
  }

  const result = await changePassword(
    { currentPassword: parsed.data.currentPassword, newPassword: parsed.data.newPassword },
    buildChangePasswordPorts(),
  );
  return NextResponse.json(result);
}
