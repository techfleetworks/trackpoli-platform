// Server-side admin-management action service (TP1-10, P1-13). The list dialogs POST one action to the
// /admin/api/admins/action route, which delegates here. This is the one place that composes the privileged
// call: read the signed-in manager's session token, forward the action's payload to its edge function on the
// caller's behalf (invokeUserFunction carries the aal2 token + the forwarded IP), and map the edge error
// envelope to a typed result the client branches on (last_manager → the blocked dialog, email_in_use → the
// field error, mfa_required → re-verify). The edge function is the authorization boundary; this never reads
// the database. Effects are injected as ports so the mapping is unit-tested with fakes (mirrors acceptInvite).

import type { NextRequest } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { EdgeFunctionError, invokeUserFunction } from "@/features/auth/edgeClient";

/** The UI action verbs, mapped to their edge functions. The invite/resend/revoke verbs drive the existing
 *  TP1-09 functions from the manager-facing list; the rest are the TP1-10 management functions. */
export const ACTION_TO_FUNCTION = {
  invite: "invite-admin",
  resend: "resend-invite",
  revoke: "revoke-invite",
  "change-role": "change-role",
  "change-email": "change-email",
  deactivate: "deactivate-admin",
  reactivate: "reactivate-admin",
  recreate: "recreate-admin",
} as const;

export type AdminAction = keyof typeof ACTION_TO_FUNCTION;
type AdminFunctionName = (typeof ACTION_TO_FUNCTION)[AdminAction];

export type AdminActionResult =
  | { ok: true; data: Record<string, unknown> }
  | { ok: false; code: string; message: string; retryAfterSeconds?: number };

export interface AdminActionPorts {
  /** The signed-in manager's access token, or null when the session is gone. */
  getAccessToken(): Promise<string | null>;
  /** The real end-user IP, forwarded so the audit event records its origin. */
  ip: string | null;
  /** Invoke the named edge function on the caller's behalf. */
  invoke(
    name: AdminFunctionName,
    body: Record<string, unknown>,
    accessToken: string,
    ip: string | null,
  ): Promise<Record<string, unknown>>;
}

export async function callAdminAction(
  action: AdminAction,
  payload: Record<string, unknown>,
  ports: AdminActionPorts,
): Promise<AdminActionResult> {
  const token = await ports.getAccessToken();
  if (!token) {
    return { ok: false, code: "unauthenticated", message: "Your session has expired. Sign in again." };
  }
  try {
    const data = await ports.invoke(ACTION_TO_FUNCTION[action], payload, token, ports.ip);
    return { ok: true, data };
  } catch (error) {
    // Expected edge failures carry a code the client branches on; anything else is unexpected and surfaces
    // as a 500 the client can retry.
    if (error instanceof EdgeFunctionError) {
      return { ok: false, code: error.code, message: error.message, retryAfterSeconds: error.retryAfterSeconds };
    }
    throw error;
  }
}

/** The real client IP from the edge/proxy headers (same precedence as the accept-invite route). */
function clientIp(request: NextRequest): string | null {
  return (
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    null
  );
}

/** Production ports for one request: the cookie-bound session token, the forwarded IP, and the edge invoke. */
export function buildAdminActionPorts(request: NextRequest): AdminActionPorts {
  return {
    ip: clientIp(request),
    async getAccessToken() {
      const supabase = await createServerSupabase();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      return session?.access_token ?? null;
    },
    invoke: (name, body, accessToken, ip) => invokeUserFunction(name, body, accessToken, ip),
  };
}
