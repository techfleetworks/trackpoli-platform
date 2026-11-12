// GET /admin/api/admins/list — the Admin-management list data for the client list (TP1-10, P1-13). Thin: it
// delegates to the manager-only listAdmins service, which checks the role claim for a clean 403 AND is backed
// by the profiles_select_manager RLS policy (the real boundary, ADR-0012). The typed outcome is returned
// as-is; the client renders the loading / ready / error / empty states from it.

import { NextResponse } from "next/server";
import { listAdmins } from "@/features/admins/listAdmins";

export async function GET() {
  return NextResponse.json(await listAdmins());
}
