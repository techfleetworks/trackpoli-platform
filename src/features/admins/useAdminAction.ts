"use client";

import * as React from "react";

import { apiFetch, ApiError } from "@/lib/apiFetch";
import type { AdminAction, AdminActionResult } from "./adminActions";

// Client hook for the Admin-management action dialogs (TP1-10). Each dialog calls run(action, payload); the
// POST route returns a typed envelope (200 even for expected failures), so the dialog branches on
// result.ok / result.code (last_manager → the blocked dialog, email_in_use → the field error, …). A
// transport or 5xx failure is turned into a generic { ok:false, code:"internal" } the dialog shows inline, so
// a thrown error never escapes into the UI. The type-only import of AdminAction/AdminActionResult is erased
// at build, so no server code reaches the browser bundle.

export function useAdminAction() {
  const [pending, setPending] = React.useState(false);

  const run = React.useCallback(
    async (action: AdminAction, payload: Record<string, unknown>): Promise<AdminActionResult> => {
      setPending(true);
      try {
        return await apiFetch<AdminActionResult>("/admin/api/admins/action", {
          method: "POST",
          body: { action, payload },
        });
      } catch (error) {
        const message =
          error instanceof ApiError && error.status === 0
            ? "You appear to be offline. Check your connection and try again."
            : "Something went wrong on our side. Please try again.";
        return { ok: false, code: "internal", message };
      } finally {
        setPending(false);
      }
    },
    [],
  );

  return { run, pending };
}
