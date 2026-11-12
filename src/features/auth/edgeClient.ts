// Server-only client for the Edge Functions. The browser never calls these; the TrackPoli server does. Two
// flavours: PRE-authentication functions (sign-in-check, auth-event, request-password-reset) carry the anon
// key plus the shared INTERNAL_CALL_SECRET (invokeInternalFunction); POST-authentication functions
// (record-terms) carry the signed-in user's access token so the function's verifyCaller validates the caller
// (invokeUserFunction). Secrets are read from server env only. This is the one place that composes the call,
// so a route handler never hand-rolls it.

import { internalCallSecret, supabaseAnonKey, supabaseUrl } from "@/lib/supabase/config";

/** A non-ok envelope from an Edge Function, carrying its error code so callers can branch. */
export class EdgeFunctionError extends Error {
  readonly code: string;
  readonly retryAfterSeconds?: number;
  constructor(code: string, message: string, retryAfterSeconds?: number) {
    super(message);
    this.name = "EdgeFunctionError";
    this.code = code;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

type Envelope<T> = { ok: true; data: T } | { ok: false; error: { code: string; message: string } };

/** POST to an edge function and unwrap its { ok, data } / { ok:false, error } envelope. One parse path for
 *  both the internal and the user-authenticated callers, so the error taxonomy is handled in one place. */
async function postFunction<T>(name: string, body: Record<string, unknown>, headers: Record<string, string>): Promise<T> {
  const response = await fetch(`${supabaseUrl()}/functions/v1/${name}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const envelope = (await response.json().catch(() => null)) as Envelope<T> | null;
  if (!envelope) {
    throw new EdgeFunctionError("internal", `Malformed response from ${name}`);
  }
  if (!envelope.ok) {
    const retryAfter = Number(response.headers.get("Retry-After")) || undefined;
    throw new EdgeFunctionError(envelope.error.code, envelope.error.message, retryAfter);
  }
  return envelope.data;
}

/** Call a PRE-authentication function: anon key + the shared internal-call secret + the real caller IP. */
export async function invokeInternalFunction<T>(
  name: "sign-in-check" | "auth-event" | "request-password-reset",
  body: Record<string, unknown>,
  ip: string | null,
): Promise<T> {
  const anon = supabaseAnonKey();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${anon}`,
    apikey: anon,
    "x-internal-call-secret": internalCallSecret(),
  };
  if (ip) headers["x-client-ip"] = ip;
  return postFunction<T>(name, body, headers);
}

/**
 * Call a POST-authentication function on behalf of the signed-in user. The user's access token rides as the
 * bearer so the function's verifyCaller validates the caller and loads their profile (TP1-08: record-terms,
 * which runs at aal1 with allowInvited). The internal-call secret is sent too, but ONLY so the function's
 * serve() trusts the forwarded client IP (the real end-user IP, which the TrackPoli server knows) — the
 * authorization is the user's token, never the secret.
 *
 * record-terms (TP1-08) and complete-invite (TP1-09) are the post-auth functions the Next server calls on the
 * caller's own behalf; both run at aal1 (complete-invite with allowInvited, as the caller is still invited).
 */
export async function invokeUserFunction<T>(
  name: "record-terms" | "complete-invite",
  body: Record<string, unknown>,
  accessToken: string,
  ip: string | null,
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${accessToken}`,
    apikey: supabaseAnonKey(),
  };
  if (ip) {
    headers["x-internal-call-secret"] = internalCallSecret();
    headers["x-client-ip"] = ip;
  }
  return postFunction<T>(name, body, headers);
}
