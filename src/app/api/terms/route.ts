// POST /admin/api/terms — the endpoint the terms acceptance screen calls (TP1-08). It is reachable at aal1
// (the terms funnel is exempt from RequireMfa) but still requires a signed-in session, enforced by the
// cookie-bound Supabase client. Thin: confirm the session, validate the body, forward to the record-terms
// edge function with the user's access token, and map the typed outcome to a 200 body — a version conflict
// is a BUSINESS outcome ("stale_version"), not a transport error, so the screen can show the "new version"
// path. Only an unexpected failure is a non-2xx, which apiFetch surfaces as the retryable error.

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { EdgeFunctionError, invokeUserFunction } from "@/features/auth/edgeClient";
import { createServerSupabase } from "@/lib/supabase/server";

const Body = z
  .object({
    acceptances: z
      .array(
        z
          .object({
            document: z.enum(["terms", "privacy"]),
            version: z.string().min(1).max(32),
          })
          .strict(),
      )
      .min(1)
      .max(2),
  })
  .strict();

/** The real client IP from the edge/proxy headers; forwarded so the acceptance records where it originated. */
function clientIp(request: NextRequest): string | null {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || null;
  return request.headers.get("x-real-ip");
}

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "session_expired" }, { status: 401 });
  }
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    return NextResponse.json({ error: "session_expired" }, { status: 401 });
  }

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  try {
    await invokeUserFunction<{ accepted: true }>(
      "record-terms",
      { acceptances: parsed.data.acceptances },
      session.access_token,
      clientIp(request),
    );
    return NextResponse.json({ outcome: "accepted" });
  } catch (error) {
    if (error instanceof EdgeFunctionError) {
      // A version conflict (409) is a business outcome the screen handles (the versions changed while the
      // user was reading); everything else is an error it retries.
      if (error.code === "conflict") {
        return NextResponse.json({ outcome: "stale_version" });
      }
      if (error.code === "unauthenticated" || error.code === "forbidden") {
        return NextResponse.json({ error: error.code }, { status: 401 });
      }
    }
    // Unexpected: let it surface as a 500 so apiFetch raises the retryable "could not save" error.
    throw error;
  }
}
