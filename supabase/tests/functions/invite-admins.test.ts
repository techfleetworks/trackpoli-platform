// Invite-side edge-function integration tests (TP1-09, ADR-0035). Served edge runtime + real local Supabase
// stack; true DB side effects, no mocks. Behaviour: features/admins/invite-admins.feature.
//
// What this tier UNIQUELY owns (vs the pgTAP data layer and the Playwright acceptance specs): the invite-admin
// / resend-invite / record-terms HTTP contract and orchestration — manager/aal2 gating, zod validation, the
// email_in_use pre-check, the rollback of the just-created auth user on a profile-insert failure, the
// resend-invite fixed-window rate limit, and the record-terms stale-version conflict.

import { assertEquals, assert } from "jsr:@std/assert@1";
import {
  aal2Session,
  admin,
  callFn,
  countAuthUsersByEmail,
  createManagerAal2,
  createPerson,
  deletePerson,
  getProfile,
  signIn,
  uniqueEmail,
  test,
} from "./_harness.ts";

// --- Permission & contract (what verifyCaller + _shared/serve uniquely own) -------------------------------

test("invite-admin: no bearer token is 401 unauthenticated", async () => {
  const r = await callFn("invite-admin", { body: { email: uniqueEmail("x"), display_name: "X", role: "admin" } });
  assertEquals(r.status, 401);
  assertEquals(r.code, "unauthenticated");
});

test("invite-admin: a plain Administrator (aal2) is refused forbidden (@usecase:invite-manager-only)", async () => {
  // A non-manager with a verified aal2 session still cannot invite — access is decided from the profile role.
  const plain = await createPerson({ prefix: "plain-admin", role: "admin", status: "active" });
  try {
    const session = await aal2Session(plain.email);
    const r = await callFn("invite-admin", {
      token: session.accessToken,
      body: { email: uniqueEmail("x"), display_name: "X", role: "admin" },
    });
    assertEquals(r.status, 403);
    assertEquals(r.code, "forbidden");
  } finally {
    await deletePerson(plain.id);
  }
});

test("invite-admin: a manager without aal2 is refused mfa_required", async () => {
  const mgr = await createPerson({ prefix: "aal1-mgr", role: "admin_manager", status: "active" });
  try {
    const s = await signIn(mgr.email); // aal1 only — no MFA
    const r = await callFn("invite-admin", {
      token: s.accessToken,
      body: { email: uniqueEmail("x"), display_name: "X", role: "admin" },
    });
    assertEquals(r.status, 403);
    assertEquals(r.code, "mfa_required");
  } finally {
    await deletePerson(mgr.id);
  }
});

test("invite-admin: an unknown body field is rejected 422 validation_failed", async () => {
  const mgr = await createManagerAal2("validate-mgr");
  try {
    const r = await callFn("invite-admin", {
      token: mgr.accessToken,
      body: { email: uniqueEmail("x"), display_name: "X", role: "admin", sneaky: true },
    });
    assertEquals(r.status, 422);
    assertEquals(r.code, "validation_failed");
  } finally {
    for (const id of mgr.cleanup) await deletePerson(id);
  }
});

// --- Duplicate email (@usecase:invite-duplicate-email) ----------------------------------------------------

test("invite-admin: inviting an email already held by an active admin is email_in_use, nothing created", async () => {
  const mgr = await createManagerAal2("dup-mgr");
  const taken = uniqueEmail("taken");
  const existing = await createPerson({ prefix: "existing", role: "admin", status: "active", email: taken });
  try {
    const before = await countAuthUsersByEmail(taken);
    const r = await callFn("invite-admin", {
      token: mgr.accessToken,
      body: { email: taken, display_name: "Dup", role: "admin" },
    });
    assertEquals(r.status, 409);
    assertEquals(r.code, "email_in_use");
    // Nothing created: still exactly the one existing auth user with that email, profile unchanged.
    assertEquals(await countAuthUsersByEmail(taken), before);
    const prof = await getProfile(existing.id);
    assertEquals(prof?.status, "active");
  } finally {
    await deletePerson(existing.id);
    for (const id of mgr.cleanup) await deletePerson(id);
  }
});

// Note on "invitable again once deactivated" (@usecase:invite-duplicate-email, the `But` clause): at the stack
// level this is realised by recreate-admin (which deletes the old profile AND auth user, then re-invites) —
// see manage-admins.test.ts. A RAW re-invite of a still-present deactivated holder's address proceeds past the
// email_in_use pre-check (deactivated is excluded, invite-admin/index.ts:48) but then fails on the profiles
// citext-email collision with the holder's surviving row — exactly the rollback path asserted below. So the
// contract's two halves are: the active/invited holder → email_in_use (asserted above), and the re-invite
// mechanics → the recreate-admin flow + the rollback test (below), not a separate near-vacuous "not blocked" case.

// --- Rollback (@usecase:invite-rollback) ------------------------------------------------------------------

test("invite-admin: a failed profile insert deletes the just-created auth user (no orphan)", async () => {
  // Deterministic profile-insert failure with no fault injection: a DEACTIVATED holder owns profiles.email =
  // `addr` but has a DIFFERENT auth email, so (1) the email_in_use pre-check passes (deactivated is free),
  // (2) inviteUserByEmail(addr) SUCCEEDS creating a new auth user with auth email = addr, then (3) the profile
  // insert with email = addr collides on the citext unique index and FAILS → provisionInvitedAdmin must delete
  // the just-created auth user. We assert that auth user is gone: a planted no-op rollback leaves it (count 1).
  const mgr = await createManagerAal2("rollback-mgr");
  const addr = uniqueEmail("rollback-target");
  const holder = await createPerson({
    prefix: "rollback-holder",
    role: "admin",
    status: "deactivated",
    email: addr, // profile email collides
    authEmail: uniqueEmail("rollback-authonly"), // auth email differs, so the invite's createUser succeeds
  });
  try {
    assertEquals(await countAuthUsersByEmail(addr), 0, "precondition: no auth user owns the target address yet");
    const r = await callFn("invite-admin", {
      token: mgr.accessToken,
      body: { email: addr, display_name: "Rollback", role: "admin" },
    });
    assertEquals(r.status, 500, "a profile-insert collision surfaces as internal");
    assertEquals(r.code, "internal");
    // The just-created auth user (auth email = addr) must have been rolled back.
    assertEquals(
      await countAuthUsersByEmail(addr),
      0,
      "rollback must delete the just-created auth user; a lingering user is an orphan",
    );
    // No stray invited profile was left for addr (still only the deactivated holder).
    const { data } = await admin.from("profiles").select("id,status").eq("email", addr);
    const rows = (data ?? []) as Array<{ id: string; status: string }>;
    assertEquals(rows.length, 1);
    assertEquals(rows[0].status, "deactivated");
  } finally {
    await deletePerson(holder.id);
    for (const id of mgr.cleanup) await deletePerson(id);
  }
});

// --- Resend rate limit (@usecase:resend-rate-limited) -----------------------------------------------------

test("resend-invite: the fixed-window limit throttles the 4th resend per invited admin (Retry-After)", async () => {
  // resend-invite enforces the rate limit BEFORE the send, so the throttle is observable regardless of whether
  // the underlying invite send succeeds locally: the first three calls are not rate_limited; the fourth is
  // refused 429 rate_limited with a Retry-After. (MAX_PER_ADMIN=3 / 1h window.)
  const mgr = await createManagerAal2("resend-mgr");
  const invited = await createPerson({ prefix: "pending", role: "admin", status: "invited", password: null });
  try {
    for (let i = 1; i <= 3; i++) {
      const r = await callFn("resend-invite", { token: mgr.accessToken, body: { admin_id: invited.id } });
      assert(r.code !== "rate_limited", `resend #${i} must not be rate_limited (got ${r.code})`);
    }
    const fourth = await callFn("resend-invite", { token: mgr.accessToken, body: { admin_id: invited.id } });
    assertEquals(fourth.status, 429);
    assertEquals(fourth.code, "rate_limited");
    assert((fourth.retryAfter ?? 0) > 0, "429 must carry a positive Retry-After");
  } finally {
    await deletePerson(invited.id);
    for (const id of mgr.cleanup) await deletePerson(id);
  }
});

test("resend-invite: only an invited profile can be resent (active target is conflict)", async () => {
  const mgr = await createManagerAal2("resend-conflict-mgr");
  const activeTarget = await createPerson({ prefix: "active-target", role: "admin", status: "active" });
  try {
    const r = await callFn("resend-invite", { token: mgr.accessToken, body: { admin_id: activeTarget.id } });
    assertEquals(r.status, 409);
    assertEquals(r.code, "conflict");
  } finally {
    await deletePerson(activeTarget.id);
    for (const id of mgr.cleanup) await deletePerson(id);
  }
});

// --- Stale terms (record-terms version conflict; Q-1-22) --------------------------------------------------

test("record-terms: a stale policy version is refused 409 conflict; the current version is accepted", async () => {
  // record-terms runs at aal1 with allowInvited. An invited administrator who submits a version that is not the
  // current one (the text changed while they read) gets a conflict; submitting the current versions succeeds.
  // (The data-layer terms GATE — RLS blocking a manager who has not accepted — is owned by pgTAP
  // supabase/tests/database/60_terms_gate.test.sql; this proves the FUNCTION's version-match mapping.)
  const invited = await createPerson({ prefix: "terms-invited", role: "admin", status: "invited" });
  try {
    const s = await signIn(invited.email); // aal1 is enough; record-terms does not require aal2
    // The current versions seed as '0' (supabase/seed.sql); submit a stale version → conflict.
    const stale = await callFn("record-terms", {
      token: s.accessToken,
      body: { acceptances: [{ document: "terms", version: "999-stale" }, { document: "privacy", version: "999-stale" }] },
    });
    assertEquals(stale.status, 409);
    assertEquals(stale.code, "conflict");

    // Read the authoritative current versions and submit them → accepted.
    const { data: versions } = await admin.from("policy_versions").select("document,current_version");
    const current = new Map<string, string>();
    for (const row of (versions ?? []) as Array<{ document: string; current_version: string }>) {
      current.set(row.document, row.current_version);
    }
    const ok = await callFn("record-terms", {
      token: s.accessToken,
      body: {
        acceptances: [
          { document: "terms", version: current.get("terms")! },
          { document: "privacy", version: current.get("privacy")! },
        ],
      },
    });
    assertEquals(ok.status, 200);
    assertEquals(ok.ok, true);
  } finally {
    await deletePerson(invited.id);
  }
});
