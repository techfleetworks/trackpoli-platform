// Manage-side edge-function integration tests (TP1-10, ADR-0035). Served edge runtime + real local Supabase
// stack; true DB side effects, no mocks. Behaviour: features/admins/manage-admins.feature.
//
// What this tier UNIQUELY owns (vs the pgTAP data layer and the Playwright acceptance specs):
//  - deactivate-admin: the authoritative status change + the session-kill (revoke_user_sessions) + the audit event;
//  - recreate-admin: the account_deleted snapshot written BEFORE the delete so the audit trail survives, and the
//    new-id re-invite;
//  - change-email: the auth-first/profile-second update, the rollback that restores the auth email on a profile
//    write failure, the session revoke, and the (unlinked-account) unlink path;
//  - the function's last_manager 409 MAPPING (the race itself is owned + proven at the data layer: pgTAP
//    supabase/tests/database/20_guards_and_append_only.test.sql + supabase/tests/race/last_manager_race.sh);
//  - the self-target (cannot_target_self), manager-only (forbidden) and aal2 (mfa_required) guards.

import { assertEquals, assert } from "jsr:@std/assert@1";
import {
  aal2Session,
  admin,
  callFn,
  createManagerAal2,
  createPerson,
  deletePerson,
  eventsFor,
  getAuthEmail,
  getProfile,
  refreshStillWorks,
  signIn,
  uniqueEmail,
} from "./_harness.ts";

// --- Permission & self-target guards ----------------------------------------------------------------------

Deno.test("deactivate-admin: a plain Administrator (aal2) is refused forbidden (@usecase:manage-manager-only)", async () => {
  const plain = await createPerson({ prefix: "plain", role: "admin", status: "active" });
  const target = await createPerson({ prefix: "victim", role: "admin", status: "active" });
  try {
    const s = await aal2Session(plain.email);
    const r = await callFn("deactivate-admin", { token: s.accessToken, body: { admin_id: target.id } });
    assertEquals(r.status, 403);
    assertEquals(r.code, "forbidden");
    assertEquals((await getProfile(target.id))?.status, "active", "nothing changed");
  } finally {
    await deletePerson(plain.id);
    await deletePerson(target.id);
  }
});

Deno.test("change-role: a manager without aal2 is refused mfa_required (@usecase:manage-requires-aal2)", async () => {
  const mgr = await createPerson({ prefix: "aal1mgr", role: "admin_manager", status: "active" });
  const target = await createPerson({ prefix: "role-target", role: "admin", status: "active" });
  try {
    const s = await signIn(mgr.email); // aal1
    const r = await callFn("change-role", { token: s.accessToken, body: { admin_id: target.id, role: "admin_manager" } });
    assertEquals(r.status, 403);
    assertEquals(r.code, "mfa_required");
    assertEquals((await getProfile(target.id))?.role, "admin", "nothing changed");
  } finally {
    await deletePerson(mgr.id);
    await deletePerson(target.id);
  }
});

Deno.test("deactivate-admin: deactivating your own account is cannot_target_self", async () => {
  const mgr = await createManagerAal2("self-deact");
  try {
    const r = await callFn("deactivate-admin", { token: mgr.accessToken, body: { admin_id: mgr.id } });
    assertEquals(r.status, 409);
    assertEquals(r.code, "cannot_target_self");
    assertEquals((await getProfile(mgr.id))?.status, "active");
  } finally {
    for (const id of mgr.cleanup) await deletePerson(id);
  }
});

Deno.test("recreate-admin: recreating your own account is cannot_target_self (nothing deleted)", async () => {
  const mgr = await createManagerAal2("self-recreate");
  try {
    const r = await callFn("recreate-admin", { token: mgr.accessToken, body: { admin_id: mgr.id } });
    assertEquals(r.status, 409);
    assertEquals(r.code, "cannot_target_self");
    assert((await getProfile(mgr.id)) !== null, "the manager's own account must be untouched");
  } finally {
    for (const id of mgr.cleanup) await deletePerson(id);
  }
});

// --- Deactivate session-kill (@usecase:E2E-09) ------------------------------------------------------------

Deno.test("deactivate-admin: ends the target's access at once — status, event and session-kill", async () => {
  const mgr = await createManagerAal2("deact-mgr");
  const target = await createPerson({ prefix: "deact-target", role: "admin", status: "active" });
  try {
    // The target is signed in (holds a live session) before being deactivated.
    const targetSession = await signIn(target.email);
    assert(await refreshStillWorks(targetSession.refreshToken), "precondition: the target's session is live");

    const r = await callFn("deactivate-admin", { token: mgr.accessToken, body: { admin_id: target.id }, ip: "203.0.113.7" });
    assertEquals(r.status, 200);

    // Authoritative status change (RLS denies every non-active session the instant it is written — the lockout
    // half is owned at the data layer by supabase/tests/database/50_lockout.test.sql).
    assertEquals((await getProfile(target.id))?.status, "deactivated");
    // One admin.deactivated audit event for this subject.
    const events = await eventsFor(target.id, "admin.deactivated");
    assertEquals(events.length, 1, "exactly one admin.deactivated event");
    // Session-kill: the target's refresh token no longer mints a session (revoke_user_sessions ran).
    assertEquals(await refreshStillWorks(targetSession.refreshToken), false, "the target's session must be revoked");
  } finally {
    await deletePerson(target.id);
    for (const id of mgr.cleanup) await deletePerson(id);
  }
});

// --- Recreate snapshot preserved (@usecase:E2E-17 / @usecase:recreate-audit) ------------------------------

Deno.test("recreate-admin: the account_deleted snapshot carries the identity and survives the delete; a fresh invite gets a new id", async () => {
  const mgr = await createManagerAal2("recreate-mgr");
  const email = uniqueEmail("recreate-target");
  const target = await createPerson({ prefix: "Recreate Target", role: "admin", status: "active", email });
  let createdId: string | undefined;
  try {
    const r = await callFn("recreate-admin", { token: mgr.accessToken, body: { admin_id: target.id } });
    assertEquals(r.status, 200, `recreate should succeed; got ${r.code}`);
    createdId = (r.data as { id: string }).id;
    const previousId = (r.data as { previous_id: string }).previous_id;
    assertEquals(previousId, target.id);
    assert(createdId !== target.id, "recreate must mint a NEW account id");

    // The account_deleted event was written BEFORE the delete, carrying the old email/name/role snapshot so the
    // deleted person's identity survives in the audit trail (log_event snapshots only the actor).
    const deleted = await eventsFor(target.id, "admin.account_deleted");
    assertEquals(deleted.length, 1, "exactly one admin.account_deleted event for the old id");
    const details = deleted[0].details as { email?: string; display_name?: string; role?: string };
    assertEquals(details.email, email, "the snapshot carries the old email");
    assertEquals(details.role, "admin", "the snapshot carries the old role");
    assert(typeof details.display_name === "string" && details.display_name.length > 0, "the snapshot carries the old name");

    // The old profile is gone; the new profile exists, same email, status invited, new id.
    assertEquals(await getProfile(target.id), null, "the old profile must be deleted");
    const fresh = await getProfile(createdId);
    assertEquals(fresh?.email, email);
    assertEquals(fresh?.status, "invited");
    assertEquals(fresh?.role, "admin");
  } finally {
    if (createdId) await deletePerson(createdId);
    await deletePerson(target.id);
    for (const id of mgr.cleanup) await deletePerson(id);
  }
});

// --- Change-email happy path + rollback + unlink (@usecase:change-email / @usecase:change-email-rollback) --

Deno.test("change-email: updates both stores, records the event, revokes sessions, runs the unlink path", async () => {
  const mgr = await createManagerAal2("ce-mgr");
  const oldEmail = uniqueEmail("ce-old");
  const target = await createPerson({ prefix: "ce-target", role: "admin", status: "active", email: oldEmail });
  const newEmail = uniqueEmail("ce-new");
  try {
    const targetSession = await signIn(target.email);
    assert(await refreshStillWorks(targetSession.refreshToken), "precondition: target session live");

    const r = await callFn("change-email", { token: mgr.accessToken, body: { admin_id: target.id, new_email: newEmail } });
    assertEquals(r.status, 200, `change-email should succeed; got ${r.code}`);

    // Both the auth and the profile email move to the new address (no divergence).
    assertEquals((await getProfile(target.id))?.email, newEmail, "profile email updated");
    assertEquals((await getAuthEmail(target.id))?.toLowerCase(), newEmail, "auth email updated");
    // The event records from→to.
    const events = await eventsFor(target.id, "admin.email_changed");
    assertEquals(events.length, 1);
    const d = events[0].details as { from?: string; to?: string };
    assertEquals(d.from, oldEmail);
    assertEquals(d.to, newEmail);
    // Sessions revoked. (The Google unlink is a no-op here — no linked Google identity — and must not error;
    // the real Google round-trip is domain-blocked, Q-1-24 / ADR-0021.)
    assertEquals(await refreshStillWorks(targetSession.refreshToken), false, "the target's session must be revoked");
  } finally {
    await deletePerson(target.id);
    for (const id of mgr.cleanup) await deletePerson(id);
  }
});

Deno.test("change-email: a failed profile write restores the auth email so the two stores never diverge", async () => {
  // Deterministic profile-write failure, no fault injection: a DEACTIVATED holder owns profiles.email = clash
  // but a DIFFERENT auth email. change-email(target → clash): the clash pre-check passes (deactivated is free),
  // the auth update to `clash` succeeds (no auth user owns it), then the profiles.email update to `clash`
  // collides on the citext unique index and FAILS → the handler must restore the target's auth email to the old
  // address. We assert the auth email is back to the old value and the profile email is unchanged: a planted
  // no-op restore leaves the auth email diverged at `clash`.
  const mgr = await createManagerAal2("ce-rollback-mgr");
  const oldEmail = uniqueEmail("cer-old");
  const clash = uniqueEmail("cer-clash");
  const target = await createPerson({ prefix: "cer-target", role: "admin", status: "active", email: oldEmail });
  const holder = await createPerson({
    prefix: "cer-holder",
    role: "admin",
    status: "deactivated",
    email: clash, // profile email collides
    authEmail: uniqueEmail("cer-holder-auth"), // auth email differs, so the auth update to `clash` is free
  });
  try {
    const r = await callFn("change-email", { token: mgr.accessToken, body: { admin_id: target.id, new_email: clash } });
    assertEquals(r.status, 500, `a profile-write collision surfaces as internal; got ${r.code}`);
    assertEquals(r.code, "internal");
    // Rollback: the two stores must not diverge — both still the OLD address for the target.
    assertEquals((await getAuthEmail(target.id))?.toLowerCase(), oldEmail, "auth email must be restored to the old address");
    assertEquals((await getProfile(target.id))?.email, oldEmail, "profile email must be unchanged");
  } finally {
    await deletePerson(holder.id);
    await deletePerson(target.id);
    for (const id of mgr.cleanup) await deletePerson(id);
  }
});

Deno.test("change-email: changing to an address held by an active admin is email_in_use (nothing changed)", async () => {
  const mgr = await createManagerAal2("ce-dup-mgr");
  const taken = uniqueEmail("ce-taken");
  const holder = await createPerson({ prefix: "ce-holder", role: "admin", status: "active", email: taken });
  const target = await createPerson({ prefix: "ce-dup-target", role: "admin", status: "active" });
  const targetOld = (await getProfile(target.id))!.email;
  try {
    const r = await callFn("change-email", { token: mgr.accessToken, body: { admin_id: target.id, new_email: taken } });
    assertEquals(r.status, 409);
    assertEquals(r.code, "email_in_use");
    assertEquals((await getProfile(target.id))?.email, targetOld, "nothing changed");
    assertEquals((await getAuthEmail(target.id))?.toLowerCase(), targetOld);
  } finally {
    await deletePerson(holder.id);
    await deletePerson(target.id);
    for (const id of mgr.cleanup) await deletePerson(id);
  }
});

// --- Last-manager: the function's 409 mapping (the race is owned by pgTAP + last_manager_race.sh) ----------

Deno.test("change-role: the sole active manager cannot self-demote — the guard surfaces as last_manager", async () => {
  // The guard (migration 002) is GLOBAL: it fires only when a demote would leave zero active managers. To reach
  // it honestly we reduce the active-manager count to a single ephemeral manager — deactivating the seeded
  // managers one at a time, each step still leaving >= 1 so the guard permits it — then have that sole manager
  // self-demote through change-role (which has no self-check). A `finally` reactivates the seed managers. No
  // sleeps, no concurrency: deterministic. The RACE itself is proven at the layer that owns it
  // (supabase/tests/database/20_guards_and_append_only.test.sql + supabase/tests/race/last_manager_race.sh).
  const mgr = await createManagerAal2("last-mgr");
  const collapsed: string[] = [];
  try {
    // Deactivate every OTHER active manager (the seed's mia/max/tom and anything else), one at a time.
    const { data: others, error } = await admin
      .from("profiles")
      .select("id")
      .eq("role", "admin_manager")
      .eq("status", "active")
      .neq("id", mgr.id);
    if (error) throw new Error(`read managers failed: ${error.message}`);
    for (const row of (others ?? []) as Array<{ id: string }>) {
      const { error: uErr } = await admin
        .from("profiles")
        .update({ status: "deactivated", deactivated_at: new Date().toISOString() })
        .eq("id", row.id);
      if (uErr) throw new Error(`collapse step failed on ${row.id}: ${uErr.message}`);
      collapsed.push(row.id);
    }

    // The ephemeral manager is now the only active manager; self-demoting them would leave zero → guard fires.
    const r = await callFn("change-role", { token: mgr.accessToken, body: { admin_id: mgr.id, role: "admin" } });
    assertEquals(r.status, 409);
    assertEquals(r.code, "last_manager");
    // The guard refused the change, so the role is unchanged.
    assertEquals((await getProfile(mgr.id))?.role, "admin_manager", "the refused demote must not have applied");
  } finally {
    // Restore the seed managers so later tests / jobs see the original cast.
    for (const id of collapsed) {
      await admin
        .from("profiles")
        .update({ status: "active", deactivated_at: null, deactivated_by: null })
        .eq("id", id)
        .catch(() => undefined);
    }
    for (const id of mgr.cleanup) await deletePerson(id);
  }
});

Deno.test("change-role: demoting a NON-last manager succeeds and revokes the target's sessions", async () => {
  // The positive half of @usecase:change-role-last-manager: with other active managers present (the seed cast),
  // demoting one manager to admin succeeds and revokes their sessions.
  const mgr = await createManagerAal2("demote-mgr");
  const target = await createPerson({ prefix: "demote-target", role: "admin_manager", status: "active" });
  try {
    const targetSession = await signIn(target.email);
    const r = await callFn("change-role", { token: mgr.accessToken, body: { admin_id: target.id, role: "admin" } });
    assertEquals(r.status, 200, `demote should succeed; got ${r.code}`);
    assertEquals((await getProfile(target.id))?.role, "admin");
    assertEquals(await refreshStillWorks(targetSession.refreshToken), false, "the demoted target's session must be revoked");
  } finally {
    await deletePerson(target.id);
    for (const id of mgr.cleanup) await deletePerson(id);
  }
});
