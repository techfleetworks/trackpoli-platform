-- supabase/seed-e2e.sql: E2E-ONLY fixture overlay. LOCAL + the `e2e-full-stack` CI job ONLY. NOT loaded by
-- `supabase db reset` (so the pgTAP database job keeps the exact 7-person cast its count invariants assert),
-- NOT run in production, NOT run by the safe-sessions job. It is applied with `psql -f` AFTER `db reset` in the
-- e2e-full-stack job, which layers these dedicated people on top of the base seed without touching it.
--
-- WHY A SEPARATE FILE (ADR-0034): the base seed.sql cast is coupled to pgTAP invariants — 60_terms_gate asserts
-- a manager sees EXACTLY 7 profiles, and 20_guards walks a narrative that assumes EXACTLY 3 active managers
-- (mia/max/tom). The manage-admins + accept-invite UI acceptance specs need their OWN dedicated people — an
-- acting manager that enrols two-factor, a deactivation target, a recreate target, and a second acting manager
-- for the invite flow — and an acting manager MUST be an active admin_manager. Adding any of them to seed.sql
-- would break those database-layer assertions (an added active manager alone falsifies the last-manager
-- narrative). Keeping them here leaves the base cast's documented contract and every pgTAP count untouched,
-- while the dedicated people stay isolated to the E2E stack. Each person below exists so one acceptance cell
-- needs them; none collides with the base cast or with each other (distinct emails are the row selectors).
--
--   mgr-manage@example.test   Administrator Manager, active, terms accepted  (manage-admins acting manager; enrols MFA)
--   tgt-deactivate@example.test  Administrator, active, terms accepted       (E2E-09 deactivation target)
--   tgt-recreate@example.test    Administrator, active, terms accepted       (E2E-17 recreate target)
--   mgr-invite@example.test   Administrator Manager, active, terms accepted  (accept-invite E2E-03 acting manager; enrols MFA)

-- One transaction for the whole overlay: psql runs statements in autocommit, so a temporary table created
-- with `on commit drop` outside an explicit transaction is dropped at the end of its own CREATE statement,
-- before the inserts can see it. Wrapping in begin/commit keeps the temp table alive across all four inserts
-- and makes the overlay atomic (with ON_ERROR_STOP=1 in the apply step, any failure stops psql before the
-- commit, so the job fails closed with nothing half-applied).
begin;

-- The dedicated people, inline (NOT added to tests.people — that table drives the pgTAP cast and stays the 7).
create temporary table e2e_people (id uuid, name text, email text, display_name text, role text) on commit drop;
insert into e2e_people (id, name, email, display_name, role) values
  ('00000000-0000-4000-8000-0000000000e1', 'mgr-manage',    'mgr-manage@example.test',    'Manny Manage',   'admin_manager'),
  ('00000000-0000-4000-8000-0000000000e2', 'tgt-deactivate','tgt-deactivate@example.test','Debbie Deact',   'admin'),
  ('00000000-0000-4000-8000-0000000000e3', 'tgt-recreate',  'tgt-recreate@example.test',  'Rory Recreate',  'admin'),
  ('00000000-0000-4000-8000-0000000000e4', 'mgr-invite',    'mgr-invite@example.test',    'Ingrid Invite',  'admin_manager');

-- Auth users. Same non-null token columns as seed.sql: GoTrue scans several auth.users token columns into
-- non-nullable Go strings, so a NULL there fails every sign-in ("converting NULL to string is unsupported").
-- The local password matches seed.sql (LocalOnly-Passw0rd!) so the acting managers can sign in by hand too.
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                        created_at, updated_at,
                        raw_app_meta_data, raw_user_meta_data,
                        confirmation_token, recovery_token, email_change,
                        email_change_token_new, email_change_token_current,
                        phone_change, phone_change_token, reauthentication_token)
select '00000000-0000-0000-0000-000000000000', p.id, 'authenticated', 'authenticated',
       p.email, extensions.crypt('LocalOnly-Passw0rd!', extensions.gen_salt('bf')), now(),
       now(), now(),
       '{"provider":"email","providers":["email"]}', '{}',
       '', '', '', '', '', '', '', ''
from e2e_people p;

-- Email identities, so supabase.auth.getUser() recognises a password account (same reason as seed.sql: without
-- the provider 'email' identity row the account is treated as Google-only).
insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select p.id::text, p.id,
       jsonb_build_object('sub', p.id::text, 'email', p.email,
                          'email_verified', true, 'phone_verified', false),
       'email', now(), now(), now()
from e2e_people p;

-- Profiles: all active, so each acting manager can sign in to aal2 and the targets appear in the list.
-- role is the public.admin_role enum (migration 001). A string LITERAL coerces to it, but p.role from the
-- temp table is text, which does not implicitly cast to the enum — so cast it explicitly.
insert into public.profiles (id, email, display_name, role, status, invited_at, activated_at, deactivated_at)
select p.id, p.email, p.display_name, p.role::public.admin_role, 'active', now(), now(), null
from e2e_people p;

-- Terms + privacy accepted (version '0', as seed.sql), so sign-in goes straight to MFA enrol and never the
-- terms gate, and the targets are ordinary active administrators.
insert into public.policy_acceptances (admin_id, admin_email, document, version)
select p.id, p.email, d.document, '0'
from e2e_people p cross join (values ('terms'), ('privacy')) d (document);

commit;
