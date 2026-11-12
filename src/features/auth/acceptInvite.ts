// Accept-invite (activation) orchestration (TP1-09, P1-08, ADR-0020). It takes its effects as ports so the
// security-critical behaviour is unit-tested with fakes, mirroring passwordReset.ts / signIn.ts. The route
// (src/app/api/accept-invite/route.ts) stays thin: parse the body, build the ports, call this.
//
// The order encodes the defence-in-depth guard (judge-arch L1): the password is set ONLY during activation.
// An already-active caller is sent on WITHOUT touching their credential (so this route can never be an
// un-reauthenticated password change), and anything other than 'invited' is treated as a spent/absent
// invite. The live status is read (not the stale app_status claim) so a just-activated session is handled
// correctly. complete-invite then flips invited → active (idempotent).

import type { NextRequest } from "next/server";
import { createServerSupabase, readInviteStatus } from "@/lib/supabase/server";
import { EdgeFunctionError, invokeUserFunction } from "./edgeClient";

export type AcceptInviteResult =
  | { outcome: "done" }
  | { outcome: "no_session" } // no invite session, or the account is no longer invited
  | { outcome: "weak_password" }; // the new password did not meet the shared policy

export interface AcceptInviteInput {
  password: string;
  ip: string | null;
}

/** Thrown by the activate port when the invite session is gone or no longer invited. */
export class ActivationSessionGone extends Error {
  constructor() {
    super("activation session gone");
    this.name = "ActivationSessionGone";
  }
}

export interface AcceptInvitePorts {
  /** The LIVE own profile status, or null when it cannot be read. */
  getStatus(): Promise<"invited" | "active" | "deactivated" | null>;
  /** Set the new password; ok:false when it is rejected (below the length policy, or leaked). */
  updatePassword(password: string): Promise<{ ok: boolean }>;
  /** Flip invited → active via complete-invite; throws ActivationSessionGone for an auth/forbidden outcome. */
  activate(ip: string | null): Promise<void>;
}

export async function acceptInvite(
  input: AcceptInviteInput,
  ports: AcceptInvitePorts,
): Promise<AcceptInviteResult> {
  const status = await ports.getStatus();
  // Defence in depth (L1): set a password ONLY during activation. An already-active caller is sent on
  // without a credential change; anything other than invited is a spent/absent invite.
  if (status !== "invited") {
    return { outcome: status === "active" ? "done" : "no_session" };
  }

  const updated = await ports.updatePassword(input.password);
  if (!updated.ok) return { outcome: "weak_password" };

  try {
    await ports.activate(input.ip);
  } catch (error) {
    if (error instanceof ActivationSessionGone) return { outcome: "no_session" };
    throw error; // unexpected — let it surface as a 500 the client retries
  }
  return { outcome: "done" };
}

/** Production ports for one request: the cookie-bound invite session, the live status read, and
 *  complete-invite. Request-scoped (passed in), so there is no shared mutable state across requests. */
export function buildAcceptInvitePorts(request: NextRequest): AcceptInvitePorts {
  return {
    // Live own status (not the stale app_status claim), via the sanctioned data-access helper.
    getStatus: () => readInviteStatus(request),
    async updatePassword(password) {
      const supabase = await createServerSupabase();
      // Supabase enforces minimum_password_length (12, NFR-S2) and, on paid plans, the leaked-password check:
      // a weak/leaked password is a 422/weak_password outcome, but a transport/auth error must NOT be
      // misreported as a weak password, so it is rethrown.
      const { error } = await supabase.auth.updateUser({ password });
      if (!error) return { ok: true };
      const code = (error as { code?: string }).code;
      const status = (error as { status?: number }).status;
      if (code === "weak_password" || code === "validation_failed" || status === 422) {
        return { ok: false };
      }
      throw error;
    },
    async activate(ip) {
      const supabase = await createServerSupabase();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) throw new ActivationSessionGone();
      try {
        await invokeUserFunction("complete-invite", {}, session.access_token, ip);
      } catch (error) {
        if (
          error instanceof EdgeFunctionError &&
          (error.code === "unauthenticated" || error.code === "forbidden")
        ) {
          throw new ActivationSessionGone();
        }
        throw error;
      }
    },
  };
}
