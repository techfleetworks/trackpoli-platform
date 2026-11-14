// Change-password orchestration (TP1-11, P1-14). An authenticated administrator changes their own password.
// Ports + pure core, the same shape as acceptInvite.ts / mfa.ts, so the security-critical ordering is
// unit-tested with fakes and no Next/React/DOM is imported.
//
// Security (owasp-secure-coding-bdd — Authentication / Password Storage / Session Management):
//   1. The CURRENT password is re-verified before any change — the open session alone is not trusted, the
//      same rule device replacement follows (ADR-0009). Verification goes through verifyPassword, i.e.
//      GoTrue's signInWithPassword on a throwaway client, so it inherits GoTrue's native sign-in rate limit
//      (it is NOT an unthrottled password-guessing oracle) and never persists a session.
//   2. A Google-only account has no password to change: it returns not_available (the card is also hidden
//      for it), so this endpoint can never set a first password on a passwordless account.
//   3. The new password is enforced to the section-5 policy (>= 12, NFR-S2) by GoTrue (weak_password) and by
//      the route's zod; the auth.password_changed audit event comes from the migration-007 trigger, so this
//      core writes no event and never logs a password.

import { createServerSupabase } from "@/lib/supabase/server";
import { verifyPassword } from "@/lib/supabase/verifier";

export type ChangePasswordResult =
  | { outcome: "done" }
  | { outcome: "wrong_password" } // the current password did not verify
  | { outcome: "weak_password" } // the new password is below the shared policy
  | { outcome: "not_available" }; // Google-only / no password identity (or no session)

export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
}

export interface ChangePasswordPorts {
  /** The signed-in administrator's email IF they have a password identity, else null (Google-only / no session). */
  getPasswordEmail(): Promise<string | null>;
  /** True iff email + current password authenticate (GoTrue-rate-limited; never persists a session). */
  verifyCurrent(email: string, password: string): Promise<boolean>;
  /** Set the new password; ok:false when GoTrue rejects it as weak/below policy. */
  updatePassword(password: string): Promise<{ ok: boolean }>;
}

export async function changePassword(
  input: ChangePasswordInput,
  ports: ChangePasswordPorts,
): Promise<ChangePasswordResult> {
  const email = await ports.getPasswordEmail();
  // No password identity: a Google-only account (or a lost session) has no password to change. Never set one.
  if (!email) return { outcome: "not_available" };

  const verified = await ports.verifyCurrent(email, input.currentPassword);
  if (!verified) return { outcome: "wrong_password" };

  const updated = await ports.updatePassword(input.newPassword);
  if (!updated.ok) return { outcome: "weak_password" };

  return { outcome: "done" };
}

/** Production ports: the cookie-bound session (for identity + the update) and the throwaway verifier client. */
export function buildChangePasswordPorts(): ChangePasswordPorts {
  return {
    async getPasswordEmail() {
      const supabase = await createServerSupabase();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      // A password account has an "email" identity; a Google-only account has only "google".
      const hasPassword = user?.identities?.some((identity) => identity.provider === "email");
      return hasPassword ? (user?.email ?? null) : null;
    },
    verifyCurrent: (email, password) => verifyPassword(email, password),
    async updatePassword(password) {
      const supabase = await createServerSupabase();
      const { error } = await supabase.auth.updateUser({ password });
      if (!error) return { ok: true };
      // GoTrue enforces minimum_password_length (12, NFR-S2) and, on paid plans, the leaked-password check: a
      // weak/leaked password is a weak_password outcome. A transport/auth error must NOT be misreported as a
      // weak password, so it is rethrown to surface as a 5xx the client can retry.
      const code = (error as { code?: string }).code;
      const status = (error as { status?: number }).status;
      if (code === "weak_password" || code === "validation_failed" || status === 422) {
        return { ok: false };
      }
      throw error;
    },
  };
}
