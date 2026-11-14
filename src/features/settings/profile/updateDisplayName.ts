// Update-own-display-name orchestration (TP1-11, P1-14). An administrator edits only their OWN display name.
// Ports + pure core so the validation is unit-tested with fakes. The RLS policy profiles_update_own_name
// (migration 005) is the real boundary — a user may update only the display_name column of their own row —
// and the migration-007 trigger writes the profile.display_name_changed audit event; this core writes none.

import { createServerSupabase } from "@/lib/supabase/server";

export type UpdateDisplayNameResult =
  | { outcome: "done"; displayName: string }
  | { outcome: "invalid" } // empty or over 120 chars (the DB check constraint, migration 001)
  | { outcome: "no_session" }
  | { outcome: "error" };

export interface UpdateDisplayNamePorts {
  getUserId(): Promise<string | null>;
  /** Update the caller's own display name; ok:false when the write is refused. */
  update(userId: string, displayName: string): Promise<{ ok: boolean }>;
}

export async function updateDisplayName(
  input: { displayName: string },
  ports: UpdateDisplayNamePorts,
): Promise<UpdateDisplayNameResult> {
  const name = input.displayName.trim();
  // Mirror the DB check constraint (1..120) so an invalid name is a clean outcome, not a 500.
  if (name.length < 1 || name.length > 120) return { outcome: "invalid" };

  const userId = await ports.getUserId();
  if (!userId) return { outcome: "no_session" };

  const { ok } = await ports.update(userId, name);
  return ok ? { outcome: "done", displayName: name } : { outcome: "error" };
}

export function buildUpdateDisplayNamePorts(): UpdateDisplayNamePorts {
  return {
    async getUserId() {
      const supabase = await createServerSupabase();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      return user?.id ?? null;
    },
    async update(userId, displayName) {
      const supabase = await createServerSupabase();
      // RLS profiles_update_own_name restricts this to the caller's own row and the display_name column only.
      const { error } = await supabase.from("profiles").update({ display_name: displayName }).eq("id", userId);
      return { ok: !error };
    },
  };
}
