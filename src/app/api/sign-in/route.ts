// POST /admin/api/sign-in — the one server endpoint the sign-in screen calls. It stays thin: validate the
// body, resolve the caller IP from the trusted Cloudflare header, delegate to performSignIn (which owns
// the bot-check/lockout/attempt order and the enumeration-resistant timing), and map the result to HTTP.
// All three account-related failures return the identical generic 401, per ADR-0005.

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { buildSignInPorts, GENERIC_SIGN_IN_ERROR, performSignIn } from "@/features/auth/signIn";

const Body = z
  .object({
    email: z.string().email(),
    password: z.string().min(1),
    turnstileToken: z.string().min(1),
  })
  .strict();

function callerIp(request: NextRequest): string | null {
  // CF-Connecting-IP is set by Cloudflare and trusted at the edge (Q-1-18); x-forwarded-for is the
  // local-dev fallback. Never trust a client-supplied value beyond these.
  return (
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    null
  );
}

export async function POST(request: NextRequest) {
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: GENERIC_SIGN_IN_ERROR }, { status: 422 });
  }

  const ip = callerIp(request);
  const result = await performSignIn({ ...parsed.data, ip }, buildSignInPorts());

  switch (result.outcome) {
    case "success":
      return NextResponse.json({ ok: true });
    case "blocked": {
      if (result.reason === "rate_limited") {
        const headers = result.retryAfterSeconds
          ? { "Retry-After": String(result.retryAfterSeconds) }
          : undefined;
        return NextResponse.json(
          { ok: false, message: "Too many attempts. Please wait and try again." },
          { status: 429, headers },
        );
      }
      return NextResponse.json(
        { ok: false, message: "Please complete the verification and try again." },
        { status: 422 },
      );
    }
    default:
      // Paused, unknown email, and wrong password are deliberately indistinguishable here.
      return NextResponse.json({ ok: false, message: GENERIC_SIGN_IN_ERROR }, { status: 401 });
  }
}
