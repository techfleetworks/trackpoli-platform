// Shared harness for the Deno edge-function integration tests (ADR-0035). These run against the REAL served
// edge runtime + the real local Supabase stack (the CI `function-tests` job boots it), so they assert the true
// HTTP contract and DB side effects — never mocks. See docs/arch-reviews + docs/skill-receipts for the ceremony.
//
// It creates ephemeral, uniquely-addressed people with the service role and tears them down in a `finally`, so
// no test depends on seed identities or collides with another. An acting Administrator Manager gets a GENUINE
// aal2 token by signing in and completing a TOTP enrol+verify (the same `aal` claim verifyCaller reads) — no
// browser, no UI. The base seed.sql cast and the seed-e2e.sql overlay are left untouched.

import { createClient, type SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { createHmac } from "node:crypto";
import { Buffer } from "node:buffer";

export const PASSWORD = "LocalOnly-Passw0rd!"; // >= 12 chars (config minimum_password_length)

export function env(name: string): string {
  const v = Deno.env.get(name);
  if (!v) throw new Error(`missing required env ${name}`);
  return v;
}

const SUPABASE_URL = env("SUPABASE_URL");
const SERVICE_ROLE_KEY = env("SUPABASE_SERVICE_ROLE_KEY");
const ANON_KEY = env("SUPABASE_ANON_KEY");

export function adminClient(): SupabaseClient {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function anonClient(): SupabaseClient {
  // A fresh client per caller so sessions never bleed between people.
  return createClient(SUPABASE_URL, ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export const admin = adminClient();

export function uniqueEmail(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}@example.test`;
}

export type Role = "admin" | "admin_manager";
export type Status = "invited" | "active" | "deactivated";

export type Person = { id: string; email: string };

// Create an ephemeral auth user (confirmed, with a password) and its profile row. No auto-profile trigger
// exists (the invite flow and seed.sql both insert the profile explicitly), so we insert it here.
export async function createPerson(opts: {
  prefix: string;
  role?: Role;
  status?: Status;
  email?: string;
  password?: string | null; // null => no password (an invite-created user that cannot sign in)
  authEmail?: string; // when the auth email must differ from the profile email (the rollback collision setup)
}): Promise<Person> {
  const email = opts.email ?? uniqueEmail(opts.prefix);
  const authEmail = opts.authEmail ?? email;
  const { data, error } = await admin.auth.admin.createUser({
    email: authEmail,
    password: opts.password === null ? undefined : (opts.password ?? PASSWORD),
    email_confirm: true,
    user_metadata: { display_name: opts.prefix },
  });
  if (error || !data.user) throw new Error(`createUser failed: ${error?.message}`);
  const id = data.user.id;
  const { error: pErr } = await admin.from("profiles").insert({
    id,
    email,
    display_name: opts.prefix,
    role: opts.role ?? "admin",
    status: opts.status ?? "active",
    invited_at: new Date().toISOString(),
    activated_at: (opts.status ?? "active") === "invited" ? null : new Date().toISOString(),
  });
  if (pErr) {
    await admin.auth.admin.deleteUser(id).catch(() => undefined);
    throw new Error(`profile insert failed: ${pErr.message}`);
  }
  return { id, email };
}

// Delete a person (profile row then auth user), tolerant of already-gone rows. Call in a `finally`.
// NOTE: a PostgREST query builder is a thenable, not a real Promise — it has no `.catch()`. It never rejects
// (an error is returned in `{ error }`), so we just await and ignore it. Only the GoTrue admin call below is a
// real Promise we can `.catch()`.
export async function deletePerson(id: string | undefined | null): Promise<void> {
  if (!id) return;
  await admin.from("profiles").delete().eq("id", id); // resolves to { error }; never rejects
  await admin.auth.admin.deleteUser(id).catch(() => undefined);
}

// ---- TOTP (RFC 6238), to complete a forced MFA enrol and reach aal2 (ported from the full-stack specs) ----
const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
function base32Decode(input: string): Uint8Array {
  const clean = input.replace(/[^A-Z2-7]/gi, "").toUpperCase();
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    value = (value << 5) | BASE32.indexOf(ch);
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return new Uint8Array(out);
}
export function totp(secret: string, atStep?: number): string {
  const step = atStep ?? Math.floor(Date.now() / 1000 / 30);
  const counter = Buffer.alloc(8);
  counter.writeBigInt64BE(BigInt(step));
  const hmac = createHmac("sha1", base32Decode(secret)).update(counter).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return String(code % 1_000_000).padStart(6, "0");
}

export type Session = { id: string; email: string; accessToken: string; refreshToken: string };

// Sign in (aal1). Returns the session tokens.
export async function signIn(email: string, password = PASSWORD): Promise<Session> {
  const c = anonClient();
  const { data, error } = await c.auth.signInWithPassword({ email, password });
  if (error || !data.session || !data.user) throw new Error(`signIn failed for ${email}: ${error?.message}`);
  return {
    id: data.user.id,
    email,
    accessToken: data.session.access_token,
    refreshToken: data.session.refresh_token,
  };
}

// Sign an EXISTING user in and upgrade the session to a GENUINE aal2 by enrolling a TOTP factor and
// verifying it. The returned access token carries aal:"aal2". Works for any role — the caller sets the role
// on the profile; verifyCaller reads it live.
export async function aal2Session(email: string, password = PASSWORD): Promise<{ accessToken: string; refreshToken: string }> {
  const c = anonClient();
  const { data: signInData, error: sErr } = await c.auth.signInWithPassword({ email, password });
  if (sErr || !signInData.session) throw new Error(`signIn failed for ${email}: ${sErr?.message}`);

  const { data: enrolled, error: eErr } = await c.auth.mfa.enroll({
    factorType: "totp",
    friendlyName: `harness-${crypto.randomUUID()}`,
  });
  if (eErr || !enrolled) throw new Error(`mfa.enroll failed: ${eErr?.message}`);
  const secret = (enrolled as { totp: { secret: string } }).totp.secret;

  // challengeAndVerify upgrades the session to aal2. A TOTP code is valid for the current 30s step (GoTrue
  // accepts the adjacent step too); retry across a possible step boundary — bounded, no sleep.
  for (let attempt = 0; attempt < 3; attempt++) {
    const { data: v, error: vErr } = await c.auth.mfa.challengeAndVerify({ factorId: enrolled.id, code: totp(secret) });
    if (v?.access_token) return { accessToken: v.access_token, refreshToken: v.refresh_token };
    if (attempt === 2) throw new Error(`mfa.challengeAndVerify failed: ${vErr?.message}`);
  }
  throw new Error("mfa.challengeAndVerify did not return a session");
}

// Create an active Administrator Manager and return a GENUINE aal2 session, with the created id(s) to clean up.
export async function createManagerAal2(prefix = "mgr"): Promise<Session & { cleanup: string[] }> {
  const person = await createPerson({ prefix, role: "admin_manager", status: "active" });
  const s = await aal2Session(person.email);
  return { id: person.id, email: person.email, accessToken: s.accessToken, refreshToken: s.refreshToken, cleanup: [person.id] };
}

export type FnResult = { status: number; ok: boolean; data?: unknown; code?: string; retryAfter: number | null };

// POST a function over HTTP exactly as src/features/auth/edgeClient.ts does: Bearer <user token> + apikey; the
// internal-call secret + x-client-ip are added only so serve() trusts the forwarded IP (authorization is the
// token). Returns the parsed envelope and the HTTP status.
export async function callFn(
  name: string,
  opts: { token?: string; body?: Record<string, unknown>; ip?: string | null } = {},
): Promise<FnResult> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    apikey: ANON_KEY,
  };
  if (opts.token) headers["Authorization"] = `Bearer ${opts.token}`;
  if (opts.ip) {
    headers["x-internal-call-secret"] = env("INTERNAL_CALL_SECRET");
    headers["x-client-ip"] = opts.ip;
  }
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
    method: "POST",
    headers,
    body: JSON.stringify(opts.body ?? {}),
  });
  const env2 = (await res.json().catch(() => null)) as
    | { ok: true; data: unknown }
    | { ok: false; error: { code: string; message: string } }
    | null;
  const retryAfter = Number(res.headers.get("Retry-After")) || null;
  if (env2 && env2.ok) return { status: res.status, ok: true, data: env2.data, retryAfter };
  return { status: res.status, ok: false, code: env2 && !env2.ok ? env2.error.code : undefined, retryAfter };
}

// Convenience reads with the service role (bypasses RLS).
export async function getProfile(id: string): Promise<{ email: string; role: string; status: string } | null> {
  const { data } = await admin.from("profiles").select("email,role,status").eq("id", id).maybeSingle();
  return data as { email: string; role: string; status: string } | null;
}

export async function getAuthEmail(id: string): Promise<string | null> {
  const { data } = await admin.auth.admin.getUserById(id);
  return data?.user?.email ?? null;
}

export async function countAuthUsersByEmail(email: string): Promise<number> {
  // listUsers is paginated (default 50 per page); the test addresses are unique so one page suffices, but page
  // through to be exact.
  let page = 1;
  let total = 0;
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(`listUsers failed: ${error.message}`);
    const users = data.users ?? [];
    total += users.filter((u) => (u.email ?? "").toLowerCase() === email.toLowerCase()).length;
    if (users.length < 200) break;
    page++;
  }
  return total;
}

export async function eventsFor(subjectId: string, action?: string): Promise<Array<Record<string, unknown>>> {
  let q = admin.from("activity_events").select("action,subject_id,details,actor_id").eq("subject_id", subjectId);
  if (action) q = q.eq("action", action);
  const { data, error } = await q;
  if (error) throw new Error(`activity_events read failed: ${error.message}`);
  return (data ?? []) as Array<Record<string, unknown>>;
}

// Can `refreshToken` still mint a new access token? False once the session is revoked (deactivate/change-email
// revoke_user_sessions deletes the auth.sessions row).
export async function refreshStillWorks(refreshToken: string): Promise<boolean> {
  const c = anonClient();
  const { data, error } = await c.auth.refreshSession({ refresh_token: refreshToken });
  return !error && !!data.session;
}
