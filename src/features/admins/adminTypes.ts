// Client-safe admin types shared by the server list service, the API routes, and the client list/dialogs
// (TP1-10). Kept free of any server/DB/framework import so a "use client" component can import it without
// pulling server code into the browser bundle.

import type { AdminRole, AdminStatus } from "@/lib/roles";

export interface AdminRow {
  readonly id: string;
  readonly email: string;
  readonly displayName: string;
  readonly role: AdminRole;
  readonly status: AdminStatus;
  /** Last successful sign-in (profiles.last_sign_in_at), or null if they have never signed in. */
  readonly lastSignInAt: string | null;
  /** When the administrator was added (profiles.created_at). */
  readonly createdAt: string;
}
