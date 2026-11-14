// Edge middleware for the admin app. It keeps the HttpOnly cookie session fresh (via updateSession — the
// only place a session is read/written, ADR-0005) and guards the app in three stages: an expired session
// (idle or 4-hour absolute limit, TP1-05) is sent to /session-expired; an unauthenticated visitor to any
// non-public path is sent to sign-in; and a signed-in administrator who has not satisfied two-factor is sent
// to enrol or verify (RequireMfa, ADR-0009). The Supabase client is constructed in src/lib/supabase/server.ts,
// never here, so the "Exactly one Supabase client" arch-gate rule holds.
//
// Both gates are ROUTING layers only. The authorization boundary is the RLS is_aal2() gate (migrations
// 001/005/009), which denies every aal1 request regardless of routing, and the session timeout is enforced
// by the signed activity cookie read below; a routing miss here is cosmetic, never a data exposure (ADR-0009).
// Session enforcement FAILS OPEN: an unreadable or absent activity cookie (or a missing secret in local dev)
// leaves routing to the MFA/sign-in stages, so a reading gap never locks an administrator out.

import { NextResponse, type NextRequest } from "next/server";
import { hasSupabaseEnv, internalCallSecret } from "@/lib/supabase/config";
import { updateSession } from "@/lib/supabase/server";
import { decideMfaGate, matchesAny, normalisePath } from "@/features/auth/requireMfa";
import { decideTermsGate, TERMS_EXEMPT_PATHS, TERMS_PASSTHROUGH_PATHS } from "@/features/auth/termsGate";
import { decideInviteGate, INVITE_EXEMPT_PATHS } from "@/features/auth/inviteGate";
import { decideSessionGate } from "@/features/auth/session/sessionGate";
import { decideRoleGate } from "@/features/auth/guards/routeGate";
import { readTermsAccepted, readInviteStatus } from "@/lib/supabase/server";
import { ACTIVITY_COOKIE, evaluateActivity, readActivity } from "@/lib/sessionActivity";
import { sessionLimits } from "@/lib/config";
import { report } from "@/lib/report";
import { generateNonce, buildCsp, securityHeaderEntries } from "@/lib/securityHeaders";

/** Expire the session's cookies on a response so the browser stops presenting a dead session. */
function clearAuthCookies(request: NextRequest, response: NextResponse): void {
  for (const cookie of request.cookies.getAll()) {
    if (cookie.name.startsWith("sb-") || cookie.name === ACTIVITY_COOKIE) {
      response.cookies.set(cookie.name, "", { path: "/admin", maxAge: 0 }); // owasp-lint:ignore deletion (maxAge:0, empty value); cookie security flags do not apply to a clear
    }
  }
}

export async function middleware(request: NextRequest) {
  // Per-request CSP nonce (TP1-13 PR B, ADR-0025). The nonce + the CSP ride on the forwarded REQUEST headers
  // (x-nonce + content-security-policy) so Next nonces its own scripts; `secure` then stamps every response
  // with the full security header set (CSP is report-only by default — CSP_ENFORCE flips it). Applied to the
  // pass-through response AND every redirect/early return below.
  const nonce = generateNonce();
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("content-security-policy", buildCsp(nonce));
  const secure = <T extends NextResponse>(res: T): T => {
    for (const [name, value] of securityHeaderEntries(nonce)) res.headers.set(name, value);
    return res;
  };

  // Without Supabase env (e.g. local dev before the secrets are set) there is no session to refresh or
  // guard, so pass through and keep the UI reachable. Production always has env, so the guard is active.
  if (!hasSupabaseEnv()) {
    return secure(NextResponse.next({ request: { headers: requestHeaders } }));
  }

  const { response, user, aal, role, status } = await updateSession(request, requestHeaders);
  const path = normalisePath(request.nextUrl.pathname);

  // Stage 1: session-timeout enforcement (TP1-05). Best-effort: if the cookie or secret cannot be read, the
  // state is null and the gate allows — RLS still protects the data.
  let activityState = null;
  if (user) {
    try {
      const payload = await readActivity(request.cookies.get(ACTIVITY_COOKIE)?.value, internalCallSecret());
      if (payload) activityState = evaluateActivity(payload, Date.now(), sessionLimits());
    } catch (error) {
      report("debug", "session-timeout enforcement skipped", {
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const sessionDecision = decideSessionGate({ path, authenticated: Boolean(user), activityState });
  if (sessionDecision.action === "expired") {
    // An API caller gets a clean 401 (the client's 401/403 seam lands it on /session-expired); a page
    // navigation is redirected, keeping the return path and the cause for the right copy.
    if (path.startsWith("/api/")) {
      const denied = NextResponse.json({ ok: false, reason: "expired" }, { status: 401 });
      clearAuthCookies(request, denied);
      return secure(denied);
    }
    const expiredUrl = new URL("/admin/session-expired", request.url);
    expiredUrl.searchParams.set("reason", sessionDecision.cause);
    expiredUrl.searchParams.set("next", request.nextUrl.pathname);
    const redirect = NextResponse.redirect(expiredUrl);
    clearAuthCookies(request, redirect);
    return secure(redirect);
  }

  // Stage 2 + 3 + 4: sign-in guard, then RequireTerms, then RequireMfa.
  const decision = decideMfaGate({
    path,
    authenticated: Boolean(user),
    currentLevel: aal?.currentLevel ?? null,
    nextLevel: aal?.nextLevel ?? null,
  });

  // Sign-in guard: an unauthenticated request to a protected path goes to sign-in.
  if (decision.action === "sign-in") {
    const signInUrl = new URL("/admin/sign-in", request.url);
    signInUrl.searchParams.set("next", request.nextUrl.pathname);
    return secure(NextResponse.redirect(signInUrl));
  }

  // Stage 3: RequireTerms (TP1-08, Q-1-20). An authenticated session that has not accepted the current
  // policies is sent to /terms BEFORE the two-factor funnel. The acceptance (has_accepted_current_policies())
  // is read only for an authenticated request on a gated path — never on the terms funnel, the session-
  // establishment passthrough, or a public path — so the per-request RPC cost is paid only where it can
  // change routing. RLS (migration 009) remains the authorization boundary; a read gap fails open (ADR-0012).
  if (user) {
    const termsGated =
      !matchesAny(path, TERMS_PASSTHROUGH_PATHS) && !matchesAny(path, TERMS_EXEMPT_PATHS);
    if (termsGated) {
      const termsAccepted = await readTermsAccepted(request);
      if (decideTermsGate({ path, authenticated: true, termsAccepted }).action === "terms") {
        return secure(NextResponse.redirect(new URL("/admin/terms", request.url)));
      }
    }
  }

  // Stage 3b: RequireActive — the invite gate (TP1-09, P1-08). An invited session is sent to /accept-invite
  // to set a password / continue with Google and activate, AFTER terms and BEFORE the two-factor funnel. The
  // live status (not the app_status token claim) is read only when the claim already says "invited", so an
  // active session never pays the read and a just-activated user is not bounced back while their claim is
  // stale. RLS limits an invited session to its own row regardless (migration 005); a read gap fails open.
  if (user && status === "invited") {
    const inviteGated =
      !matchesAny(path, TERMS_PASSTHROUGH_PATHS) && !matchesAny(path, INVITE_EXEMPT_PATHS);
    if (inviteGated) {
      const liveStatus = await readInviteStatus(request);
      if (decideInviteGate({ path, authenticated: true, status: liveStatus }).action === "accept-invite") {
        return secure(NextResponse.redirect(new URL("/admin/accept-invite", request.url)));
      }
    }
  }

  // Stage 4: RequireMfa.
  switch (decision.action) {
    case "enrol":
      return secure(NextResponse.redirect(new URL("/admin/mfa/enrol", request.url)));
    case "verify":
      return secure(NextResponse.redirect(new URL("/admin/sign-in/verify", request.url)));
    default: {
      // Stage 4: role gate (TP1-06). An administrator who reaches a manager-only route is redirected to the
      // forbidden screen, keeping the attempted path for its breadcrumb + copy. UX routing only — the manager
      // API returns 403 and RLS returns no rows to a non-manager regardless (ADR-0012).
      const roleDecision = decideRoleGate({ path, authenticated: Boolean(user), role });
      if (roleDecision.action === "forbidden") {
        const forbiddenUrl = new URL("/admin/forbidden", request.url);
        forbiddenUrl.searchParams.set("from", request.nextUrl.pathname);
        return secure(NextResponse.redirect(forbiddenUrl));
      }
      return secure(response);
    }
  }
}

export const config = {
  // Run on every request except Next.js internals and static assets; those never carry a session to
  // refresh and must not pay the auth-server round-trip.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
