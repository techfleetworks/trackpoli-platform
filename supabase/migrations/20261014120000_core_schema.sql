-- TrackPoli core schema: politicians, parties, bills, policies, the Source entity,
-- and the verification/publication state model (ADR-0006). Supabase owns facts;
-- Sanity owns prose and references these ids (ADR-0005). Public (anon) reads only
-- rows whose status = 'published'; all writes go through an admin (RLS below).
--
-- Expand/contract-safe: this is the initial schema, so every statement is additive
-- (CREATE), there are no existing rows, and the few CREATE INDEX statements are
-- suppressed for the migration-safety gate with a reason (new table, nothing to lock).

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.record_status as enum
  ('draft', 'awaiting_review', 'approved', 'published', 'rejected', 'needs_correction');
create type public.government_level as enum ('federal', 'state', 'lga');
create type public.source_type as enum
  ('official_document', 'news_article', 'manifesto', 'social_media', 'press_release', 'interview', 'other');
create type public.bill_stage as enum
  ('introduced', 'committee', 'passed_chamber', 'enacted', 'withdrawn');
create type public.policy_state as enum
  ('proposed', 'announced', 'active', 'amended', 'withdrawn');
create type public.vote_position as enum ('yea', 'nay', 'abstain', 'absent');
create type public.app_role as enum ('admin', 'reviewer');

-- ---------------------------------------------------------------------------
-- Access control + shared helpers
-- ---------------------------------------------------------------------------
create table public.user_roles (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  role       public.app_role not null default 'reviewer',
  created_at timestamptz not null default now()
);

create function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles r
    where r.user_id = auth.uid() and r.role = 'admin'
  );
$$;

create function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Tamper-evident audit: records who changed what. SECURITY DEFINER so it can write
-- the append-only audit_log regardless of the caller's RLS.
create table public.audit_log (
  id           uuid primary key default gen_random_uuid(),
  actor_id     uuid references auth.users (id),
  action       text not null,
  subject_type text not null,
  subject_id   uuid not null,
  diff         jsonb,
  created_at   timestamptz not null default now()
);

create function public.record_audit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.audit_log (actor_id, action, subject_type, subject_id, diff)
  values (
    auth.uid(),
    tg_op,
    tg_table_name,
    coalesce(new.id, old.id),
    case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end
  );
  return coalesce(new, old);
end;
$$;

-- The verification workflow trail: every status transition of any record.
create table public.review_events (
  id           uuid primary key default gen_random_uuid(),
  subject_type text not null,
  subject_id   uuid not null,
  from_status  public.record_status,
  to_status    public.record_status not null,
  actor_id     uuid references auth.users (id),
  reason       text,
  created_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- The Source entity (ADR-0005): one owner for provenance, attached to claims.
-- ---------------------------------------------------------------------------
create table public.sources (
  id               uuid primary key default gen_random_uuid(),
  source_name      text not null,
  original_url     text,
  archived_url     text,
  document_title   text,
  author           text,
  source_type      public.source_type not null default 'other',
  publication_date date,
  last_verified_at timestamptz,
  status           public.record_status not null default 'draft',
  created_by       uuid references auth.users (id),
  published_at     timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- Polymorphic link from a source to the exact claim it supports on any record.
-- subject_id is intentionally not a cross-table FK (it points at several tables);
-- subject_type is constrained to the known set and the pair is indexed.
create table public.source_links (
  id           uuid primary key default gen_random_uuid(),
  source_id    uuid not null references public.sources (id) on delete cascade,
  subject_type text not null check (subject_type in
    ('politician', 'party', 'bill', 'policy', 'policy_implementation', 'vote')),
  subject_id   uuid not null,
  claim        text not null,
  passage      text,
  created_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Core content entities (each carries the verification/publication state)
-- ---------------------------------------------------------------------------
create table public.parties (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null,
  abbreviation        text,
  logo_url            text,
  founding_date       date,
  registration_number text,
  registration_status text,
  level               public.government_level,
  registered_address  text,
  contact_email       text,
  ideology            text,
  status              public.record_status not null default 'draft',
  created_by          uuid references auth.users (id),
  published_at        timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create table public.politicians (
  id                 uuid primary key default gen_random_uuid(),
  full_name          text not null,
  preferred_name     text,
  gender             text,
  date_of_birth      date,
  photo_url          text,
  office_title       text,
  level              public.government_level,
  constituency       text,
  party_id           uuid references public.parties (id),
  current_term_start date,
  biography          text,
  status             public.record_status not null default 'draft',
  created_by         uuid references auth.users (id),
  published_at       timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create table public.bills (
  id             uuid primary key default gen_random_uuid(),
  title          text not null,
  bill_number    text,
  sponsor_id     uuid references public.politicians (id),
  chamber        text,
  stage          public.bill_stage not null default 'introduced',
  subject        text,
  summary        text,
  document_url   text,
  introduced_date date,
  status         public.record_status not null default 'draft',
  created_by     uuid references auth.users (id),
  published_at   timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create table public.policies (
  id                      uuid primary key default gen_random_uuid(),
  name                    text not null,
  policy_type             text,
  responsible_institution text,
  responsible_id          uuid references public.politicians (id),
  announcement_date       date,
  effective_date          date,
  objective               text,
  affected_sector         text,
  geographic_scope        text,
  document_url            text,
  policy_state            public.policy_state not null default 'proposed',
  status                  public.record_status not null default 'draft',
  created_by              uuid references auth.users (id),
  published_at            timestamptz,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

create table public.policy_implementations (
  id                  uuid primary key default gen_random_uuid(),
  policy_id           uuid not null references public.policies (id) on delete cascade,
  start_date          date,
  programme           text,
  milestones          jsonb,
  budget              text,
  geographic_coverage text,
  current_status      text,
  delays              text,
  status              public.record_status not null default 'draft',
  created_by          uuid references auth.users (id),
  published_at        timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create table public.votes (
  id            uuid primary key default gen_random_uuid(),
  politician_id uuid not null references public.politicians (id) on delete cascade,
  bill_id       uuid not null references public.bills (id) on delete cascade,
  position      public.vote_position not null,
  vote_date     date,
  chamber       text,
  status        public.record_status not null default 'draft',
  created_by    uuid references auth.users (id),
  published_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (politician_id, bill_id)
);

-- ---------------------------------------------------------------------------
-- Indexes (new tables: non-concurrent is safe, nothing to lock)
-- ---------------------------------------------------------------------------
-- migration-safety:ignore=index-not-concurrent new table, no existing rows to lock
create index idx_politicians_status on public.politicians (status);
-- migration-safety:ignore=index-not-concurrent new table, no existing rows to lock
create index idx_politicians_party on public.politicians (party_id);
-- migration-safety:ignore=index-not-concurrent new table, no existing rows to lock
create index idx_parties_status on public.parties (status);
-- migration-safety:ignore=index-not-concurrent new table, no existing rows to lock
create index idx_bills_status on public.bills (status);
-- migration-safety:ignore=index-not-concurrent new table, no existing rows to lock
create index idx_policies_status on public.policies (status);
-- migration-safety:ignore=index-not-concurrent new table, no existing rows to lock
create index idx_votes_politician on public.votes (politician_id);
-- migration-safety:ignore=index-not-concurrent new table, no existing rows to lock
create index idx_source_links_subject on public.source_links (subject_type, subject_id);
-- migration-safety:ignore=index-not-concurrent new table, no existing rows to lock
create index idx_review_events_subject on public.review_events (subject_type, subject_id);
-- migration-safety:ignore=index-not-concurrent new table, no existing rows to lock
create index idx_audit_subject on public.audit_log (subject_type, subject_id);

-- ---------------------------------------------------------------------------
-- updated_at + audit triggers on the content tables
-- ---------------------------------------------------------------------------
create trigger trg_parties_updated before update on public.parties for each row execute function public.set_updated_at();
create trigger trg_politicians_updated before update on public.politicians for each row execute function public.set_updated_at();
create trigger trg_bills_updated before update on public.bills for each row execute function public.set_updated_at();
create trigger trg_policies_updated before update on public.policies for each row execute function public.set_updated_at();
create trigger trg_policy_impl_updated before update on public.policy_implementations for each row execute function public.set_updated_at();
create trigger trg_votes_updated before update on public.votes for each row execute function public.set_updated_at();
create trigger trg_sources_updated before update on public.sources for each row execute function public.set_updated_at();

create trigger trg_parties_audit after insert or update or delete on public.parties for each row execute function public.record_audit();
create trigger trg_politicians_audit after insert or update or delete on public.politicians for each row execute function public.record_audit();
create trigger trg_bills_audit after insert or update or delete on public.bills for each row execute function public.record_audit();
create trigger trg_policies_audit after insert or update or delete on public.policies for each row execute function public.record_audit();
create trigger trg_sources_audit after insert or update or delete on public.sources for each row execute function public.record_audit();

-- ---------------------------------------------------------------------------
-- Row Level Security: public reads ONLY published; admins do everything.
-- ---------------------------------------------------------------------------
alter table public.user_roles enable row level security;
alter table public.audit_log enable row level security;
alter table public.review_events enable row level security;
alter table public.sources enable row level security;
alter table public.source_links enable row level security;
alter table public.parties enable row level security;
alter table public.politicians enable row level security;
alter table public.bills enable row level security;
alter table public.policies enable row level security;
alter table public.policy_implementations enable row level security;
alter table public.votes enable row level security;

-- Public, read-only access to published content (the published projection).
create policy "published readable by anyone" on public.parties for select using (status = 'published');
create policy "published readable by anyone" on public.politicians for select using (status = 'published');
create policy "published readable by anyone" on public.bills for select using (status = 'published');
create policy "published readable by anyone" on public.policies for select using (status = 'published');
create policy "published readable by anyone" on public.policy_implementations for select using (status = 'published');
create policy "published readable by anyone" on public.votes for select using (status = 'published');
create policy "published readable by anyone" on public.sources for select using (status = 'published');
create policy "published links readable by anyone" on public.source_links for select
  using (exists (select 1 from public.sources s where s.id = source_id and s.status = 'published'));

-- Admins have full control over every content table (draft work + publishing).
create policy "admins manage parties" on public.parties for all using (public.is_admin()) with check (public.is_admin());
create policy "admins manage politicians" on public.politicians for all using (public.is_admin()) with check (public.is_admin());
create policy "admins manage bills" on public.bills for all using (public.is_admin()) with check (public.is_admin());
create policy "admins manage policies" on public.policies for all using (public.is_admin()) with check (public.is_admin());
create policy "admins manage policy_implementations" on public.policy_implementations for all using (public.is_admin()) with check (public.is_admin());
create policy "admins manage votes" on public.votes for all using (public.is_admin()) with check (public.is_admin());
create policy "admins manage sources" on public.sources for all using (public.is_admin()) with check (public.is_admin());
create policy "admins manage source_links" on public.source_links for all using (public.is_admin()) with check (public.is_admin());
create policy "admins manage review_events" on public.review_events for all using (public.is_admin()) with check (public.is_admin());

-- user_roles: a user may read their own role; only admins manage roles.
create policy "read own role" on public.user_roles for select using (user_id = auth.uid() or public.is_admin());
create policy "admins manage roles" on public.user_roles for all using (public.is_admin()) with check (public.is_admin());

-- audit_log is append-only and admin-readable: a select policy only, no update/delete,
-- so history cannot be altered from the app. Inserts happen via the SECURITY DEFINER trigger.
create policy "admins read audit" on public.audit_log for select using (public.is_admin());
