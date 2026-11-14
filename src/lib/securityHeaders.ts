// Browser security headers + a per-request Content-Security-Policy nonce (TP1-13, P1-16; owasp-secure-coding).
// Pure and framework-free so the policy and the header set are unit-tested directly; the middleware generates
// a nonce per request, forwards it on the request headers (so Next nonces its own scripts) and sets these
// headers on every response.
//
// The CSP ships in REPORT-ONLY by default (ADR-0025): because the policy cannot be verified against a running
// app in CI (the app is auth-gated and the stack is domain-blocked, Q-1-21), report-only lets staging surface
// every violation in the browser console with no risk of breaking the first deploy. Setting CSP_ENFORCE to a
// truthy value flips it to the enforcing `Content-Security-Policy` header once staging is clean.

// A random nonce for this request. 16 bytes of CSPRNG, base64 — unique per response (CSP requires it).
export function generateNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

// Origins the app legitimately talks to. Kept here so the policy has one source of truth; the exact set is
// tuned against the report-only violations on staging (ADR-0025). strict-dynamic means CSP3 browsers ignore
// the script-src host list (a nonced loader may pull more), but it is kept as a fallback for older browsers.
const SUPABASE = "https://*.supabase.co";
const SENTRY = "https://*.ingest.sentry.io";
const TURNSTILE = "https://challenges.cloudflare.com";
const GOOGLE = "https://accounts.google.com";

/** Build the CSP string for one request's nonce. Scripts are nonce + strict-dynamic (no unsafe-inline);
 *  styles allow 'unsafe-inline' (next/font and inline styles — a deliberate, lower-risk relaxation);
 *  framing is denied (frame-ancestors 'none') and only Turnstile/Google may be framed BY us. */
export function buildCsp(nonce: string): string {
  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' ${TURNSTILE}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self'",
    `connect-src 'self' ${SUPABASE} ${SENTRY} ${TURNSTILE} ${GOOGLE}`,
    `frame-src ${TURNSTILE} ${GOOGLE}`,
    "worker-src 'self' blob:",
    "upgrade-insecure-requests",
  ].join("; ");
}

/** True when the CSP should be enforced rather than report-only. Default (unset) is report-only. */
export function cspEnforced(): boolean {
  const flag = (process.env.CSP_ENFORCE ?? "").toLowerCase();
  return flag === "1" || flag === "true" || flag === "yes";
}

export function cspHeaderName(): "Content-Security-Policy" | "Content-Security-Policy-Report-Only" {
  return cspEnforced() ? "Content-Security-Policy" : "Content-Security-Policy-Report-Only";
}

// The static headers, independent of the nonce. HSTS forces HTTPS for two years incl. subdomains; nosniff
// stops MIME sniffing; the admin app is never framed, indexed, or a referrer leak; the Permissions-Policy
// denies powerful features the admin console does not use.
export const STATIC_SECURITY_HEADERS: Readonly<Record<string, string>> = {
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Robots-Tag": "noindex, nofollow",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
};

/** Every security header to set on a response for this request's nonce: the static set plus the CSP under the
 *  enforcing or report-only name. */
export function securityHeaderEntries(nonce: string): Array<[string, string]> {
  return [...Object.entries(STATIC_SECURITY_HEADERS), [cspHeaderName(), buildCsp(nonce)]];
}
