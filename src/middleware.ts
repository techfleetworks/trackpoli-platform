// Edge middleware for the admin app. Its one job this increment is to keep the HttpOnly cookie session
// fresh on every request by delegating to updateSession() (the only place a session is read/written, per
// ADR-0005). Route-guard redirects (sending an unauthenticated visitor to the sign-in screen) are added
// in the next increment, together with the sign-in route they redirect to; adding them before that route
// exists would redirect into a 404. The client is constructed in src/lib/supabase/server.ts, never here,
// so the "Exactly one Supabase client" arch-gate rule holds.

import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/server";

export async function middleware(request: NextRequest) {
  const { response } = await updateSession(request);
  return response;
}

export const config = {
  // Run on every request except Next.js internals and static assets; those never carry a session to
  // refresh and must not pay the auth-server round-trip.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
