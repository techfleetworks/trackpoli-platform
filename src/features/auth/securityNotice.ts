import { invokeInternalFunction, EdgeFunctionError } from "@/features/auth/edgeClient";
import { report } from "@/lib/report";

// Server-only (it composes edgeClient, which reads the internal-call secret from server env, so it is never
// bundled for the browser — same convention as edgeClient itself, which carries no "server-only" marker).
// Fire a security-alert email for a change the signed-in administrator just made to their OWN account
// (TP1-12, P1-18): a password change or a two-factor device replacement. These run in the Next runtime, which
// cannot import the Deno notices helper, so they hand off to the internal-only send-security-notice edge
// function (ADR-0023). BEST-EFFORT by contract: the account change has already committed, so this never
// throws and never blocks the caller's response — a dispatch failure is reported and swallowed here, and the
// edge function logs an actual send failure as its own operational event.

export type SecurityChangeType = "password_changed" | "two_factor_replaced";

export async function notifySecurityChange(type: SecurityChangeType, userId: string): Promise<void> {
  try {
    await invokeInternalFunction("send-security-notice", { type, user_id: userId }, null);
  } catch (error) {
    report("warning", "security notice dispatch failed", {
      type,
      reason: error instanceof EdgeFunctionError ? error.code : "unknown",
    });
  }
}
