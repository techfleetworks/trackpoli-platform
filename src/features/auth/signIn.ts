// Sign-in orchestration (ADR-0005). One fixed order per attempt: bot-check + lockout (sign-in-check) →
// password attempt → record a failure (auth-event). Every account-related failure — a paused account, an
// unknown email, a wrong password — returns the SAME generic "failed" outcome and is padded to a fixed
// minimum duration, so the three are indistinguishable in content and (within jitter) in time. A bot-check
// or rate-limit block is NOT account-related, so it is its own outcome and is not padded.
//
// The pure performSignIn() takes its effects as ports, so the enumeration/timing behaviour is unit-tested
// with fakes; buildSignInPorts() wires the real Edge Functions and the cookie-bound Supabase client.

import { createServerSupabase } from "@/lib/supabase/server";
import { report } from "@/lib/report";
import { EdgeFunctionError, invokeInternalFunction } from "./edgeClient";

/** The one generic message every account-related failure shows. Never says which part was wrong. */
export const GENERIC_SIGN_IN_ERROR = "Incorrect email or password. Please try again.";

// Minimum duration for any account-related failure response, so a paused/unknown/wrong-password outcome
// cannot be told apart by timing. Best-effort: a cold start can still exceed it (see ADR-0005).
export const SIGN_IN_TIMING_FLOOR_MS = 750;

export type SignInResult =
  | { outcome: "success" }
  | { outcome: "failed" }
  | { outcome: "blocked"; reason: "turnstile" | "rate_limited"; retryAfterSeconds?: number };

export interface SignInInput {
  email: string;
  password: string;
  turnstileToken: string;
  ip: string | null;
}

/** Thrown by the checkSignIn port for a non-account block (bot check failed, or rate limited). */
export class SignInBlocked extends Error {
  readonly reason: "turnstile" | "rate_limited";
  readonly retryAfterSeconds?: number;
  constructor(reason: "turnstile" | "rate_limited", retryAfterSeconds?: number) {
    super(reason);
    this.name = "SignInBlocked";
    this.reason = reason;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export interface SignInPorts {
  checkSignIn(input: { email: string; turnstileToken: string; ip: string | null }): Promise<{ allowed: boolean }>;
  attemptPassword(email: string, password: string): Promise<boolean>;
  recordFailure(input: { email: string; ip: string | null }): Promise<void>;
  now(): number;
  sleep(ms: number): Promise<void>;
}

export async function performSignIn(input: SignInInput, ports: SignInPorts): Promise<SignInResult> {
  const start = ports.now();

  let allowed: boolean;
  try {
    ({ allowed } = await ports.checkSignIn({
      email: input.email,
      turnstileToken: input.turnstileToken,
      ip: input.ip,
    }));
  } catch (error) {
    if (error instanceof SignInBlocked) {
      return { outcome: "blocked", reason: error.reason, retryAfterSeconds: error.retryAfterSeconds };
    }
    throw error;
  }

  if (!allowed) {
    return failed(ports, start); // account is paused
  }

  const ok = await ports.attemptPassword(input.email, input.password);
  if (!ok) {
    await ports.recordFailure({ email: input.email, ip: input.ip });
    return failed(ports, start); // wrong password or unknown email — same outcome as a pause
  }

  return { outcome: "success" };
}

async function failed(ports: SignInPorts, start: number): Promise<SignInResult> {
  const elapsed = ports.now() - start;
  if (elapsed < SIGN_IN_TIMING_FLOOR_MS) {
    await ports.sleep(SIGN_IN_TIMING_FLOOR_MS - elapsed);
  }
  return { outcome: "failed" };
}

/** The production ports: the real Edge Functions and the cookie-bound Supabase client. */
export function buildSignInPorts(): SignInPorts {
  return {
    async checkSignIn({ email, turnstileToken, ip }) {
      try {
        const data = await invokeInternalFunction<{ allowed: boolean; lockedUntil: string | null }>(
          "sign-in-check",
          { email, turnstileToken },
          ip,
        );
        return { allowed: data.allowed };
      } catch (error) {
        if (error instanceof EdgeFunctionError) {
          if (error.code === "validation_failed") throw new SignInBlocked("turnstile");
          if (error.code === "rate_limited") throw new SignInBlocked("rate_limited", error.retryAfterSeconds);
        }
        throw error;
      }
    },
    async attemptPassword(email, password) {
      const supabase = await createServerSupabase();
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      return !error && Boolean(data.user);
    },
    async recordFailure({ email, ip }) {
      // Best-effort: the failure is already recorded by the Edge Function; if the call itself fails we
      // report it but keep the generic outcome, so a reporting hiccup cannot leak which path was taken.
      await invokeInternalFunction("auth-event", { email }, ip).catch((error: unknown) => {
        report("warning", "auth-event call failed", {
          reason: error instanceof Error ? error.message : String(error),
        });
      });
    },
    now: () => Date.now(),
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  };
}
