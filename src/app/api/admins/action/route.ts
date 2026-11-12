// POST /admin/api/admins/action — the one endpoint behind the Admin-management list dialogs (TP1-10, P1-13).
// Thin: validate the action verb + forward its payload to the admin-actions service, which calls the mapped
// edge function on the signed-in manager's behalf. The edge function is the authorization boundary (manager +
// aal2, decided from the profile); this route adds no role check of its own. Expected failures come back as a
// 200 envelope { ok: false, code } the client branches on (the accept-invite route uses the same typed-200
// shape); only an unexpected throw is a 5xx.

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import {
  ACTION_TO_FUNCTION,
  buildAdminActionPorts,
  callAdminAction,
  type AdminAction,
} from "@/features/admins/adminActions";

const ACTIONS = Object.keys(ACTION_TO_FUNCTION) as [AdminAction, ...AdminAction[]];

// The payload is forwarded verbatim to the edge function, which validates it authoritatively with a strict
// zod schema (unknown fields rejected, emails normalised). The route only checks the action verb.
const Body = z
  .object({
    action: z.enum(ACTIONS),
    payload: z.record(z.string(), z.unknown()).default({}),
  })
  .strict();

export async function POST(request: NextRequest) {
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, code: "validation_failed", message: "Invalid request." } as const,
      { status: 422 },
    );
  }

  const result = await callAdminAction(parsed.data.action, parsed.data.payload, buildAdminActionPorts(request));
  return NextResponse.json(result);
}
