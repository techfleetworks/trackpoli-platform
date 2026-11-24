-- Add a tamper-proof `session_started_at` access-token claim so the edge middleware can enforce the
-- 4-hour ABSOLUTE session cap even when the signed `tp-activity` cookie is deleted (TP1-05, ADR-0010
-- hardening; judge-arch MED-1). The cookie is the only carrier of "last activity", so the IDLE cap still
-- needs it (or the server-side session registry) and stays fail-open; but the session's START is knowable
-- from `auth.sessions.created_at`, which the auth server already owns, so promoting it to a signed claim
-- closes the cookie-delete bypass of the absolute cap without any new table. See ADR-0038.
--
-- Migration safety (release-deployment-safety): this is a `create or replace function` of an existing
-- function with the SAME signature — no table, column, type or data change, no lock on any table, and
-- privileges/policies from migration 006 are preserved by replace. It is additive and backward compatible:
-- it only ADDS a claim; app_role/app_status and every passed-through claim are unchanged, and a session
-- with no row / no session_id simply omits the new claim (the middleware then falls back to the cookie,
-- exactly as before). Forward/back deploys are safe in any order (an old reader ignores the extra claim).

create or replace function public.custom_access_token_hook(event jsonb) returns jsonb
  language plpgsql stable set search_path = '' as $$
declare
  v_claims jsonb := event -> 'claims';
  v_role text;
  v_status text;
  v_session_id uuid := nullif(v_claims ->> 'session_id', '')::uuid;
  v_started_at timestamptz;
begin
  select role::text, status::text into v_role, v_status
  from public.profiles where id = (event ->> 'user_id')::uuid;
  v_claims := jsonb_set(v_claims, '{app_role}',   to_jsonb(coalesce(v_role, 'none')));
  v_claims := jsonb_set(v_claims, '{app_status}', to_jsonb(coalesce(v_status, 'none')));

  -- session_started_at: the session's creation time, as epoch SECONDS (like iat/exp), signed into the
  -- token so the client cannot forge or strip it. Read from auth.sessions (owned by supabase_auth_admin,
  -- which this hook runs as — no extra grant needed). When there is no session_id or no matching row the
  -- claim is omitted, so the absolute-cap fallback is simply absent and routing degrades to the cookie.
  if v_session_id is not null then
    select created_at into v_started_at from auth.sessions where id = v_session_id;
    if v_started_at is not null then
      v_claims := jsonb_set(
        v_claims, '{session_started_at}', to_jsonb(floor(extract(epoch from v_started_at))::bigint));
    end if;
  end if;

  return jsonb_build_object('claims', v_claims);
end $$;
