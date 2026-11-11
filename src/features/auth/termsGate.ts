// The RequireTerms gate decision (TP1-08, ADR-0012 terms option made live), as a pure function so it is
// unit-tested directly — no Next, DOM, or Supabase imports. src/middleware.ts owns reading
// has_accepted_current_policies() and turning a decision into a NextResponse; this owns only the routing
// rule. It runs BETWEEN the sign-in guard and RequireMfa, because every user accepts before any other
// screen or data (Q-1-20) and the terms screen comes before the two-factor code (aal1, migration 009).
//
// RequireTerms is a ROUTING layer, NEVER the authorization boundary: the restrictive RLS terms-gate
// (migration 009) blocks every table from an un-accepted session regardless of routing, so a miss here is
// cosmetic, not a data exposure (ADR-0012). Reusing the MFA path helpers keeps one source of path truth.

import { matchesAny } from "./requireMfa";

// Paths an authenticated administrator who has NOT yet accepted may still reach, so the terms funnel cannot
// deadlock: the terms screen itself, the acceptance API, sign-out (so a declining user can always leave),
// and the activity ping (the idle timer must keep running while they read — TP1-05). Everything else routes
// to /terms, including the MFA funnel, because terms come before two-factor (Q-1-20, migration 009).
export const TERMS_EXEMPT_PATHS = [
  "/terms",
  "/api/terms",
  "/api/sign-out",
  "/api/session/activity",
] as const;

// Session-establishment paths that must COMPLETE before a terms check makes sense, and that a middleware
// redirect would break (the OAuth callbacks, the re-auth round-trip, the sign-in API, the post-timeout
// screen). These deliberately EXCLUDE /sign-in/verify and /mfa/*: the two-factor code comes AFTER terms
// (Q-1-20), so an un-accepted session on those funnels is still sent to /terms first. /sign-in is omitted
// too — an authenticated, un-accepted session landing there is simply funnelled to /terms.
export const TERMS_PASSTHROUGH_PATHS = [
  "/auth/callback",
  "/auth/google",
  "/auth/reauth",
  "/api/sign-in",
  "/session-expired",
] as const;

export interface TermsGateInput {
  /** The request path, already normalised with normalisePath(). */
  path: string;
  authenticated: boolean;
  /**
   * Whether the session has accepted the current policies (has_accepted_current_policies()). null when it
   * could not be read; then the gate allows (fail open) — the restrictive RLS still blocks the data.
   */
  termsAccepted: boolean | null;
}

export type TermsGateDecision = { action: "allow" } | { action: "terms" };

/**
 * Decide whether a request should be sent to the terms screen. Order matches middleware: sign-in guard
 * first, then this, then RequireMfa. An anonymous request is left to the other gates. An authenticated
 * request on a public or exempt path is allowed. Otherwise, only an explicit "not accepted" routes to
 * /terms; an unreadable acceptance (null) allows, since RLS protects the data either way.
 */
export function decideTermsGate(input: TermsGateInput): TermsGateDecision {
  if (!input.authenticated) return { action: "allow" };
  if (matchesAny(input.path, TERMS_PASSTHROUGH_PATHS) || matchesAny(input.path, TERMS_EXEMPT_PATHS)) {
    return { action: "allow" };
  }
  return input.termsAccepted === false ? { action: "terms" } : { action: "allow" };
}
