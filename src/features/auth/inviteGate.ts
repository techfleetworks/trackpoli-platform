// The RequireActive (invite) gate decision (TP1-09, P1-08), as a pure function so it is unit-tested directly
// — no Next, DOM, or Supabase imports. src/middleware.ts owns reading the live profile status and turning a
// decision into a NextResponse; this owns only the routing rule. It runs AFTER the terms gate and BEFORE
// RequireMfa: an invited administrator accepts the current terms first (/terms), then activates their account
// here (/accept-invite: set a password or continue with Google → complete-invite), then enrols two-factor.
//
// This is a ROUTING layer, NEVER the authorization boundary: RLS gives an invited (non-active) session no
// access beyond its own profile row regardless of routing (migration 005), so a miss here is cosmetic, not a
// data exposure. The status is read LIVE from profiles (not the possibly-stale app_status token claim), the
// same way the terms gate reads acceptance live, so a just-activated user is never bounced back here while
// their token claim still says "invited" (the claim refreshes on the next token rotation). Reuses the MFA
// path helpers and the terms session-establishment passthrough so there is one source of path truth.

import { matchesAny } from "./requireMfa";
import { TERMS_PASSTHROUGH_PATHS } from "./termsGate";

// Paths an authenticated invited administrator may reach without being bounced to /accept-invite, so the
// activation funnel cannot deadlock: the accept-invite screen itself and its API, the terms funnel (terms
// come first, so never route off /terms to /accept-invite), sign-out (so they can always leave), and the
// activity ping (the idle timer keeps running). Everything else routes to /accept-invite, including the MFA
// funnel, because activation comes before two-factor.
export const INVITE_EXEMPT_PATHS = [
  "/accept-invite",
  "/api/accept-invite",
  "/terms",
  "/api/terms",
  "/api/sign-out",
  "/api/session/activity",
] as const;

export interface InviteGateInput {
  /** The request path, already normalised with normalisePath(). */
  path: string;
  authenticated: boolean;
  /**
   * The LIVE profile status (read from profiles, not the token claim). null when it could not be read; then
   * the gate allows (fail open) — RLS still limits an invited session to its own profile row.
   */
  status: "invited" | "active" | "deactivated" | null;
}

export type InviteGateDecision = { action: "allow" } | { action: "accept-invite" };

/**
 * Decide whether a request should be sent to the accept-invite screen. Order matches middleware: sign-in
 * guard, then terms, then this, then RequireMfa. An anonymous request is left to the other gates. An
 * authenticated request on a public, exempt or session-establishment path is allowed. Only a live status of
 * "invited" routes to /accept-invite; an active/deactivated/unreadable status allows (the other gates and
 * RLS handle those).
 */
export function decideInviteGate(input: InviteGateInput): InviteGateDecision {
  if (!input.authenticated) return { action: "allow" };
  if (matchesAny(input.path, TERMS_PASSTHROUGH_PATHS) || matchesAny(input.path, INVITE_EXEMPT_PATHS)) {
    return { action: "allow" };
  }
  return input.status === "invited" ? { action: "accept-invite" } : { action: "allow" };
}
