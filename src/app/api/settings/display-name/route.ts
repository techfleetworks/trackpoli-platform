// POST /admin/api/settings/display-name — the Profile-tab name edit (TP1-11, P1-14). Thin: validate then
// delegate to the updateDisplayName service, which updates only the caller's own display_name under RLS
// (profiles_update_own_name) and lets the migration-007 trigger write profile.display_name_changed. The typed
// outcome is returned as a 200 envelope the client branches on.

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { updateDisplayName, buildUpdateDisplayNamePorts } from "@/features/settings/profile/updateDisplayName";

const Body = z.object({ displayName: z.string().min(1).max(120) }).strict();

export async function POST(request: NextRequest) {
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ outcome: "invalid" } as const);
  }
  const result = await updateDisplayName({ displayName: parsed.data.displayName }, buildUpdateDisplayNamePorts());
  return NextResponse.json(result);
}
