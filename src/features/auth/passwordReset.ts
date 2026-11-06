// Password-recovery orchestration (ADR-0008). Two flows, each taking its effects as ports so the
// security-critical behaviour is unit-tested with fakes, mirroring signIn.ts.
//
// 1. performPasswordReset — the forgot-password REQUEST. It calls the request-password-reset Edge Function
//    (bot-check, rate limits, and — only for an eligible account — the recovery email) and returns ONE
//    identical "sent" outcome whether or not the address has an account, padded to a fixed minimum duration
//    so the two cases cannot be told apart by timing (OWASP Forgot Password enumeration control). A
//    bot-check or rate-limit block is not account-related, so it is its own outcome and is not padded.
//
// 2. completePasswordReset — finishing the reset on the recovery session. It applies the new password under
//    the shared policy, then clears the lockout counter, writes the audit event, and ends ALL sessions (no
//    auto-login; the user returns to the normal sign-in, per the cheat sheet and ADR-0008).

import { createServerSupabase } from "@/lib/supabase/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { emailHashHex } from "@/lib/emailHash";
import { EdgeFunctionError, invokeInternalFunction } from "./edgeClient";

// Minimum duration for the reset-request response, so "account exists" and "no account" cannot be told
// apart by timing. Best-effort: a cold start or a slow mail send can still exceed it (see ADR-0008).
export const PASSWORD_RESET_TIMING_FLOOR_MS = 750;

export type RequestResetResult =
  | { outcome: "sent" }
  | { outcome: "blocked"; reason: "turnstile" | "rate_limited"; retryAfterSeconds?: number };

export interface RequestResetInput {
  email: string;
  turnstileToken: string;
  ip: string | null;
}

/** Thrown by the requestReset port for a non-account block (bot check failed, or rate limited). */
export class ResetBlocked extends Error {
  readonly reason: "turnstile" | "rate_limited";
  readonly retryAfterSeconds?: number;
  constructor(reason: "turnstile" | "rate_limited", retryAfterSeconds?: number) {
    super(reason);
    this.name = "ResetBlocked";
    this.reason = reason;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export interface RequestResetPorts {
  requestReset(input: { email: string; turnstileToken: string; ip: string | null }): Promise<void>;
  now(): number;
  sleep(ms: number): Promise<void>;
}

export async function performPasswordReset(
  input: RequestResetInput,
  ports: RequestResetPorts,
): Promise<RequestResetResult> {
  const start = ports.now();
  try {
    await ports.requestReset({ email: input.email, turnstileToken: input.turnstileToken, ip: input.ip });
  } catch (error) {
    if (error instanceof ResetBlocked) {
      // A block is not account-related, so it is returned immediately and is not padded.
      return { outcome: "blocked", reason: error.reason, retryAfterSeconds: error.retryAfterSeconds };
    }
    throw error; // infra failure (not account-correlated) — let it surface, like performSignIn
  }
  await pad(ports, start);
  return { outcome: "sent" };
}

async function pad(ports: RequestResetPorts, start: number): Promise<void> {
  const elapsed = ports.now() - start;
  if (elapsed < PASSWORD_RESET_TIMING_FLOOR_MS) {
    await ports.sleep(PASSWORD_RESET_TIMING_FLOOR_MS - elapsed);
  }
}

/** Production ports for the request flow: the real pre-auth Edge Function. */
export function buildRequestResetPorts(): RequestResetPorts {
  return {
    async requestReset({ email, turnstileToken, ip }) {
      try {
        await invokeInternalFunction<{ ok: true }>("request-password-reset", { email, turnstileToken }, ip);
      } catch (error) {
        if (error instanceof EdgeFunctionError) {
          if (error.code === "validation_failed") throw new ResetBlocked("turnstile");
          if (error.code === "rate_limited") throw new ResetBlocked("rate_limited", error.retryAfterSeconds);
        }
        throw error;
      }
    },
    now: () => Date.now(),
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  };
}

// --- Reset completion -------------------------------------------------------------------------------

export type CompleteResetResult =
  | { outcome: "done" }
  | { outcome: "no_session" } // no valid recovery session (link consumed, expired, or invalid)
  | { outcome: "weak_password" }; // new password did not meet the shared policy

export interface CompleteResetInput {
  password: string;
  ip: string | null;
  requestId: string;
}

export interface CompleteResetPorts {
  /** The user established by the recovery-session exchange, or null if there is none. */
  getRecoveryUser(): Promise<{ id: string; email: string } | null>;
  /** Set the new password; ok:false when it is rejected (e.g. below the minimum length). */
  updatePassword(password: string): Promise<{ ok: boolean }>;
  /** Audited privileged side-effects: clear the lockout counter and write the completion event. */
  onReset(user: { id: string; email: string }, ip: string | null, requestId: string): Promise<void>;
  /** End every session for the account (no auto-login). */
  signOutEverywhere(): Promise<void>;
}

export async function completePasswordReset(
  input: CompleteResetInput,
  ports: CompleteResetPorts,
): Promise<CompleteResetResult> {
  const user = await ports.getRecoveryUser();
  if (!user) return { outcome: "no_session" };

  const updated = await ports.updatePassword(input.password);
  if (!updated.ok) return { outcome: "weak_password" };

  // Only after the password is actually changed: clear the lockout, record the event, end all sessions.
  await ports.onReset(user, input.ip, input.requestId);
  await ports.signOutEverywhere();
  return { outcome: "done" };
}

/** Production ports for completion: the cookie-bound recovery session plus the audited admin client. */
export function buildCompleteResetPorts(): CompleteResetPorts {
  return {
    async getRecoveryUser() {
      const supabase = await createServerSupabase();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || !user.email) return null;
      return { id: user.id, email: user.email };
    },
    async updatePassword(password) {
      const supabase = await createServerSupabase();
      // Supabase enforces minimum_password_length (12, NFR-S2); a rejection surfaces as an error.
      const { error } = await supabase.auth.updateUser({ password });
      return { ok: !error };
    },
    async onReset(user, ip, requestId) {
      // Audited privileged operation on the server, via the service-role client (sanctioned by ADR-0005).
      const admin = createAdminSupabase();
      const hash = await emailHashHex(user.email);
      const { error: clearError } = await admin.rpc("clear_sign_in_failures", { p_hash: hash });
      if (clearError) throw clearError;
      const { error: eventError } = await admin.rpc("log_event", {
        p_actor: user.id,
        p_action: "auth.password_reset_completed",
        p_subject_type: "profile", // the account whose password was reset is the subject
        p_subject_id: user.id,
        p_summary: "Password reset completed",
        p_details: {},
        p_ip: ip,
        p_request: requestId,
      });
      if (eventError) throw eventError;
    },
    async signOutEverywhere() {
      const supabase = await createServerSupabase();
      await supabase.auth.signOut({ scope: "global" });
    },
  };
}
