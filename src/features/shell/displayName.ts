import type { AuthUser } from "@/features/auth/AuthProvider";

// The name shown in the shell's side nav and top bar (TP1-06). Prefer the administrator's real profile
// display name; fall back to their email, then a generic label, so the shell is never blank. Trimmed so a
// whitespace-only name does not render as an empty label.
export function shellDisplayName(user: Pick<AuthUser, "display_name" | "email">): string {
  return user.display_name?.trim() || user.email?.trim() || "Administrator";
}
