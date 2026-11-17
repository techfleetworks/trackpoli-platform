// The RequireMfa gate decision (ADR-0009), as a pure function so it is unit-tested directly — no Next, DOM,
// or Supabase imports. src/middleware.ts owns the session refresh, the assurance-level read, and turning a
// decision into a NextResponse; this owns only the routing rule.
//
// RequireMfa is a ROUTING layer, never the authorization boundary: the RLS is_aal2() gate denies every aal1
// request regardless of routing, so a miss here is cosmetic, not a data exposure (ADR-0009).

// Paths reachable without a session: the sign-in screen, the OAuth routes, the sign-in API, and the
// session-expired screen (the browser lands there after a timeout once the session cookies are cleared, so
// it must be viewable with no session — TP1-05).
export const MFA_PUBLIC_PATHS = [
  "/sign-in",
  "/auth/callback",
  "/auth/google",
  "/api/sign-in",
  "/session-expired",
  // Password recovery is reachable without a two-factor session: the signed-out entry points
  // (/forgot-password and its /sent subpath, via the prefix match) and their POST endpoint, plus the
  // recovery-session pages — /reset-password and its /api/reset-password, and /auth/confirm (the token-hash
  // Continue landing for recovery AND invite email links) together with /api/auth/confirm, the POST that
  // actually exchanges the one-time token and establishes the session (the Continue click runs while still
  // signed OUT, so the API itself must be public, not just its page — ADR-0008). Without these, the sign-in
  // guard redirected a signed-out visitor straight to /sign-in, so "Forgot password?" and an emailed link
  // could never be reached once the middleware is active (TP1-03/07/09, E2E-05). Routing only — each page and
  // API still enforces its own recovery/invite session, and RLS is the authorization boundary (ADR-0012).
  "/forgot-password",
  "/reset-password",
  "/auth/confirm",
  "/api/auth/confirm",
  "/api/request-password-reset",
  "/api/reset-password",
] as const;

// Paths a signed-in administrator may reach while still at aal1, so the two-factor funnel cannot deadlock:
// the enrol and verify screens, their APIs, sign-out (so a stuck user can always leave), and the activity
// ping (the idle timer must keep running during forced enrolment, TP1-05). Everything else requires aal2.
export const MFA_EXEMPT_PATHS = [
  "/mfa/enrol",
  "/sign-in/verify",
  "/api/mfa/enrol",
  "/api/mfa/verify",
  "/api/sign-out",
  "/api/session/activity",
  // Terms come BEFORE the two-factor code (Q-1-20, migration 009), so the terms screen and its API must be
  // reachable at aal1 without RequireMfa bouncing the user to enrol/verify (TP1-08). The terms gate, which
  // runs before RequireMfa in the middleware, is what funnels an un-accepted session here.
  "/terms",
  "/api/terms",
  // Accept-invite comes BEFORE two-factor too (TP1-09): an invited administrator sets a password / continues
  // with Google and activates at aal1, then enrols. The invite gate (before RequireMfa) funnels them here.
  "/accept-invite",
  "/api/accept-invite",
] as const;

/** Normalise away the /admin basePath whether or not the runtime includes it in the pathname. */
export function normalisePath(pathname: string): string {
  if (pathname.startsWith("/admin")) return pathname.slice("/admin".length) || "/";
  return pathname;
}

export function matchesAny(path: string, list: readonly string[]): boolean {
  return list.some((p) => path === p || path.startsWith(`${p}/`));
}

export interface MfaGateInput {
  /** The request path, already normalised with normalisePath(). */
  path: string;
  authenticated: boolean;
  /** Assurance level from updateSession; null when it could not be read (then MFA routing is skipped). */
  currentLevel: string | null;
  nextLevel: string | null;
}

export type MfaGateDecision =
  | { action: "allow" }
  | { action: "sign-in" } // not authenticated on a protected path
  | { action: "enrol" } // authenticated, below aal2, no verified factor yet
  | { action: "verify" }; // authenticated, below aal2, a verified factor exists

/**
 * Decide where a request should go. Order matches middleware: the sign-in guard first, then RequireMfa.
 * A missing assurance reading (currentLevel null) leaves routing to "allow" — RLS still protects the data.
 */
export function decideMfaGate(input: MfaGateInput): MfaGateDecision {
  const onPublic = matchesAny(input.path, MFA_PUBLIC_PATHS);

  if (!input.authenticated) {
    return onPublic ? { action: "allow" } : { action: "sign-in" };
  }

  // Authenticated. Apply RequireMfa only on a confident sub-aal2 reading and only on a gated path.
  const belowAal2 = input.currentLevel !== null && input.currentLevel !== "aal2";
  if (belowAal2 && !onPublic && !matchesAny(input.path, MFA_EXEMPT_PATHS)) {
    return input.nextLevel === "aal2" ? { action: "verify" } : { action: "enrol" };
  }

  return { action: "allow" };
}
