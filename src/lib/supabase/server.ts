// The server-side Supabase clients (ADR-0005). These are the ONLY clients that read or set the session.
// Two request-bound contexts live here, both inside src/lib/supabase so the arch-gate "Exactly one
// Supabase client" rule holds:
//   - createServerSupabase(): for Server Components, Server Actions and Route Handlers (binds to the
//     next/headers cookie store).
//   - updateSession(): for middleware (binds to the NextRequest/NextResponse cookie jars).
// A fresh instance is created per request — never a module-level singleton — because each closes over
// request-scoped cookies. Session cookies are scoped to the /admin path (matching basePath), so they are
// never sent to another app on the domain, and they are HttpOnly, so no browser script can read the token.
//
// next/headers is imported lazily (only inside createServerSupabase) so that importing this module from
// edge middleware does not statically pull an RSC-only API into the middleware bundle.

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { report } from "@/lib/report";
import { normaliseRole, normaliseStatus, type AdminRole, type AdminStatus } from "@/lib/roles";
import { supabaseAnonKey, supabaseUrl } from "./config";

const COOKIE_OPTIONS = { path: "/admin" } as const;

/** A per-request client bound to the next/headers cookie store (Server Components / Actions / Routes). */
export async function createServerSupabase() {
  const { cookies } = await import("next/headers");
  const cookieStore = await cookies();
  return createServerClient<Database>(supabaseUrl(), supabaseAnonKey(), {
    cookieOptions: COOKIE_OPTIONS,
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, {
              ...options,
              path: "/admin",
              httpOnly: true,
              sameSite: "lax",
              secure: process.env.NODE_ENV === "production",
            });
          }
        } catch (error) {
          // Expected when called from a Server Component, where the cookie store is read-only; the session
          // is refreshed instead by middleware on the next request. We recover by deferring the write to
          // middleware, and still report so a genuine cookie-write failure is never silently swallowed
          // (decisions.md, Error handling).
          report("debug", "server supabase setAll skipped (read-only cookie context)", {
            cookieCount: cookiesToSet.length,
            reason: error instanceof Error ? error.message : String(error),
          });
        }
      },
    },
  });
}

/** The caller's two-factor assurance level, used only for routing (ADR-0009). currentLevel is the session's
 *  present level; nextLevel is "aal2" once a verified factor exists. The RLS is_aal2() gate, not this, is
 *  the authorization boundary. */
export interface AssuranceLevel {
  // Supabase types these as a loose string ("aal1" | "aal2" | (string & {})); we compare against "aal2".
  currentLevel: string | null;
  nextLevel: string | null;
}

/**
 * Read the administrator's role/status from the verified access-token claims (app_role/app_status, migration
 * 006). Routing/rendering only — RLS is the authorization boundary (ADR-0005/0009). Best-effort: returns
 * nulls if the claims cannot be read, so a reading gap degrades to "no role opinion", never a hard failure.
 */
export async function readAdminClaims(
  supabase: SupabaseClient<Database>,
): Promise<{ role: AdminRole | null; status: AdminStatus | null }> {
  try {
    const { data } = await supabase.auth.getClaims();
    const claims = data?.claims as Record<string, unknown> | undefined;
    if (!claims) return { role: null, status: null };
    return { role: normaliseRole(claims.app_role), status: normaliseStatus(claims.app_status) };
  } catch (error) {
    // The token should always carry the role claim, so a read failure is an anomaly that fail-CLOSES a real
    // manager out of manager routes — report at warning (Sentry), not debug, so a regression is visible
    // (judge-arch TP1-06 LOW). Routing still degrades gracefully to "no role opinion"; RLS protects the data.
    report("warning", "admin claims could not be read (role routing degraded)", {
      reason: error instanceof Error ? error.message : String(error),
    });
    return { role: null, status: null };
  }
}

/**
 * Refresh the session for a middleware pass and return the current user alongside the response that
 * carries any refreshed cookies. The caller (src/middleware.ts) owns the routing/guard decision; this
 * function owns only the session read, the assurance-level read, and the cookie plumbing.
 */
export async function updateSession(
  request: NextRequest,
  // Optional forwarded request headers (TP1-13 PR B): middleware passes a Headers carrying the per-request
  // CSP nonce (x-nonce + the Content-Security-Policy request header Next reads to nonce its own scripts). When
  // present, the forwarded request uses these headers; the cookie refresh is kept in sync by re-serialising
  // request.cookies into this Headers' Cookie on every setAll, so the session-refresh behaviour is unchanged.
  requestHeaders?: Headers,
): Promise<{
  response: NextResponse;
  user: User | null;
  aal: AssuranceLevel | null;
  role: AdminRole | null;
  status: AdminStatus | null;
}> {
  const nextInit = () =>
    requestHeaders ? NextResponse.next({ request: { headers: requestHeaders } }) : NextResponse.next({ request });
  let response = nextInit();
  const supabase = createServerClient<Database>(supabaseUrl(), supabaseAnonKey(), {
    cookieOptions: COOKIE_OPTIONS,
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value); // owasp-lint:ignore request-side mirror for this pass only, not a browser Set-Cookie; security attributes apply to the response set below, not to request cookies
        }
        // Keep the forwarded Cookie header in step with the refreshed request cookies so the nonce-carrying
        // headers do not drop the session refresh for the current render.
        if (requestHeaders) {
          requestHeaders.set(
            "cookie",
            request.cookies.getAll().map((c) => `${c.name}=${c.value}`).join("; "),
          );
        }
        response = nextInit();
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, {
            ...options,
            path: "/admin",
            httpOnly: true,
            sameSite: "lax",
            secure: request.nextUrl.protocol === "https:",
          });
        }
      },
    },
  });

  // getUser() revalidates the token with the auth server (unlike getSession, which trusts the cookie),
  // which is what refreshes an expiring session and lets middleware trust the result.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Assurance level drives only which MFA screen the user lands on (ADR-0009). Best-effort: if it cannot be
  // read, return null and let the route gate skip the MFA redirect — RLS still denies every aal1 request, so
  // a missing reading is a cosmetic routing gap, never a data exposure.
  let aal: AssuranceLevel | null = null;
  let role: AdminRole | null = null;
  let status: AdminStatus | null = null;
  if (user) {
    try {
      const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (data) aal = { currentLevel: data.currentLevel, nextLevel: data.nextLevel };
    } catch (error) {
      report("debug", "assurance-level read skipped", {
        reason: error instanceof Error ? error.message : String(error),
      });
    }
    // Role/status for route gating (ADR-0012). Best-effort; RLS still protects the data regardless.
    ({ role, status } = await readAdminClaims(supabase));
  }
  return { response, user, aal, role, status };
}

/**
 * Read whether the current session has accepted the current policy versions, for the middleware terms gate
 * (TP1-08, Q-1-20). Calls the security-definer has_accepted_current_policies() (migration 009) on a
 * request-cookie-bound client. ROUTING only — the restrictive RLS terms gate is the authorization boundary
 * (ADR-0012), so this is best-effort: a read failure returns null and the gate allows (fail open), since
 * RLS still blocks every table from an un-accepted session. The middleware calls this only for an
 * authenticated request on a gated path, so the per-request RPC cost is not paid on the terms funnel or the
 * public paths. A later optimisation can promote the signal to a token claim; the boundary stays RLS.
 */
export async function readTermsAccepted(request: NextRequest): Promise<boolean | null> {
  const supabase = createServerClient<Database>(supabaseUrl(), supabaseAnonKey(), {
    cookieOptions: COOKIE_OPTIONS,
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll() {
        // Read-only pass: this call never refreshes the session (updateSession already did), so there are
        // no cookies to write back.
      },
    },
  });
  try {
    const { data, error } = await supabase.rpc("has_accepted_current_policies");
    if (error) {
      report("warning", "terms acceptance read failed (terms routing degraded)", { reason: error.message });
      return null;
    }
    return data === true;
  } catch (error) {
    report("debug", "terms acceptance read skipped", {
      reason: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/**
 * Read the current session's LIVE profile status for the middleware invite gate (TP1-09, P1-08). The own
 * profile row is readable at aal1 (profiles_select_own, migration 005), so an invited administrator can read
 * their own status. ROUTING only — RLS is the authorization boundary (ADR-0012), so this is best-effort: a
 * read failure returns null and the gate allows (fail open), since RLS limits an invited session to its own
 * row regardless. Reading LIVE (not the app_status token claim) means a just-activated user is not bounced
 * back to /accept-invite while their claim is still stale. The middleware calls this only when the token
 * claim already says "invited", so an active session never pays the read.
 */
export async function readInviteStatus(
  request: NextRequest,
): Promise<"invited" | "active" | "deactivated" | null> {
  const supabase = createServerClient<Database>(supabaseUrl(), supabaseAnonKey(), {
    cookieOptions: COOKIE_OPTIONS,
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll() {
        // Read-only pass: updateSession already refreshed the session, so there is nothing to write back.
      },
    },
  });
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;
    const { data, error } = await supabase
      .from("profiles")
      .select("status")
      .eq("id", user.id)
      .maybeSingle();
    if (error) {
      report("warning", "invite status read failed (invite routing degraded)", { reason: error.message });
      return null;
    }
    return normaliseStatus(data?.status);
  } catch (error) {
    report("debug", "invite status read skipped", {
      reason: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/**
 * Exchange a Google re-authentication code to read ONLY the returning identity, without persisting the new
 * session (ADR-0009, device replacement). The cookie writes from the exchange are discarded, so the
 * administrator's live aal2 session is left untouched — we learn who came back from Google and compare, but
 * do not drop them to aal1. Returns whether the returning identity matches the current session's user.
 */
export async function exchangeReauthIdentity(
  code: string,
): Promise<{ status: "ok" | "mismatch" | "error"; userId: string | null }> {
  const { cookies } = await import("next/headers");
  const cookieStore = await cookies();
  const supabase = createServerClient<Database>(supabaseUrl(), supabaseAnonKey(), {
    cookieOptions: COOKIE_OPTIONS,
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      // Discard every write: the re-auth session must NOT replace the live aal2 session (ADR-0009). The
      // PKCE verifier is read above; the resulting session is intentionally thrown away.
      setAll() {},
    },
  });

  const {
    data: { user: before },
  } = await supabase.auth.getUser();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user || !before) {
    return { status: "error", userId: before?.id ?? null };
  }
  return { status: data.user.id === before.id ? "ok" : "mismatch", userId: before.id };
}
