"use client";

import * as React from "react";

import { apiFetch } from "@/lib/apiFetch";
import type { AdminRow } from "./adminTypes";

// Client data hook for the Admin-management list (TP1-10). Loads the list from the GET route and exposes the
// loading / ready / error states the design's list screens show. `reload({ silent: true })` refetches after an
// action without flashing the skeleton (the current rows stay on screen while the fresh data arrives). State
// is only set after the fetch resolves (never synchronously inside the mount effect), so there are no
// cascading renders.

type ListResponse =
  | { outcome: "ok"; admins: AdminRow[] }
  | { outcome: "unauthenticated" | "forbidden" | "error" };

export type AdminsStatus = "loading" | "ready" | "error";

export function useAdmins() {
  const [admins, setAdmins] = React.useState<AdminRow[] | null>(null);
  const [status, setStatus] = React.useState<AdminsStatus>("loading");

  // Fetch the list and set the rows; returns the next status so the caller decides when to apply it.
  const fetchList = React.useCallback(async (): Promise<AdminsStatus> => {
    try {
      const res = await apiFetch<ListResponse>("/admin/api/admins/list");
      if (res.outcome === "ok") {
        setAdmins(res.admins);
        return "ready";
      }
      return "error";
    } catch {
      // apiFetch already reported the transport/HTTP failure.
      return "error";
    }
  }, []);

  // Explicit reload (retry button, or a quiet refresh after an action). `silent` keeps the current rows while
  // the refresh is in flight; otherwise the skeleton shows.
  const reload = React.useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!opts?.silent) setStatus("loading");
      setStatus(await fetchList());
    },
    [fetchList],
  );

  React.useEffect(() => {
    let active = true;
    void (async () => {
      const next = await fetchList();
      if (active) setStatus(next);
    })();
    return () => {
      active = false;
    };
  }, [fetchList]);

  return { admins, status, reload };
}
