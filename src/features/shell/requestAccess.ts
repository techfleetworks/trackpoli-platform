// "Request access" on the 403 forbidden screen (TP1-06). An Administrator who reaches a manager-only route
// has no in-app way to ask for access, so the action composes an email — in the requester's OWN mail client
// — to the support/manager address, prefilled with who is asking and which page they hit. This is a
// client-only mailto: there is no server endpoint, no stored request, and no SMTP dependency (the user's mail
// client sends it), which is the deliberately minimal flow chosen in pattern-selector over a stored
// access-request table for a bounded administrator cast. The richer in-app request flow is a later ticket.
//
// Security (owasp-secure-coding-bdd): the attempted path comes from the ?from query param and is therefore
// caller-influenceable, but it only lands — percent-encoded by URLSearchParams, which escapes CR/LF so no
// mailto header can be injected — in the BODY of an email the user themselves composes and chooses to send.
// There is no trust boundary crossed on our side. The path is clamped so a pathological value cannot produce
// an unusable, enormous mailto URL.

/** The default support/manager recipient; override per environment with NEXT_PUBLIC_SUPPORT_EMAIL. */
const DEFAULT_SUPPORT_EMAIL = "support@trackpoli.com";

/** The address "Request access" emails. Reads the public build-time env, trimmed, else the default. */
export function supportEmail(): string {
  return process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.trim() || DEFAULT_SUPPORT_EMAIL;
}

const MAX_PATH = 200;

/**
 * Build the `mailto:` URL for the forbidden screen's "Request access" action. Pure and side-effect-free so it
 * is unit-testable; the component only renders the returned href. `to` defaults to {@link supportEmail}.
 */
export function requestAccessMailto(opts: {
  requesterEmail: string | null;
  attemptedPath: string | null;
  to?: string;
}): string {
  const to = (opts.to ?? supportEmail()).trim();
  const requester = opts.requesterEmail?.trim() || "(not signed in)";
  const path = opts.attemptedPath?.trim().slice(0, MAX_PATH) || "(not specified)";

  const subject = "Access request: Administrator manager section";
  const body = [
    "Hello,",
    "",
    "I'd like to request access to an Administrator manager section of the TrackPoli admin console.",
    "",
    `Requester: ${requester}`,
    `Attempted page: ${path}`,
    "",
    "Thank you.",
  ].join("\n");

  // URLSearchParams percent-encodes every value (CR/LF included), then uses "+" for spaces; most mail clients
  // accept "+", but "%20" is universally understood, so normalise it for the widest client support.
  const query = new URLSearchParams({ subject, body }).toString().replace(/\+/g, "%20");
  // The recipient is trusted (env or the default constant), so it is left raw — encoding the "@" to %40 is
  // RFC-valid but mishandled by some mail clients. Only the query (subject/body) carries untrusted input.
  return `mailto:${to}?${query}`;
}
