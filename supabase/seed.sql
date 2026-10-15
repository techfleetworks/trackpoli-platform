-- TrackPoli SEED: EXAMPLE DATA ONLY, for local development and demos.
-- These are obviously-fake placeholders, NOT real politicians. Real records are
-- sourced in Phase 2 (CSV import, then AI-assisted population) and each must carry
-- a real source and pass human review before being set to 'published'.
--
-- This seed demonstrates the vertical slice end to end:
--   a published party + a published politician + the source backing a claim,
--   plus one DRAFT politician that the public read model (RLS) must NOT expose.

-- A published party.
insert into public.parties (id, name, abbreviation, registration_status, level, ideology, status, published_at)
values ('00000000-0000-0000-0000-0000000000a1',
        'Example Progressive Party (SAMPLE)', 'EPP', 'registered', 'federal',
        'Sample centre-left platform for demo purposes', 'published', now());

-- A published politician, linked to the party.
insert into public.politicians (id, full_name, preferred_name, office_title, level, constituency, party_id, biography, status, published_at)
values ('00000000-0000-0000-0000-0000000000b1',
        'Example Representative A (SAMPLE)', 'Rep. A', 'Member, House of Representatives',
        'federal', 'Sample Constituency 1', '00000000-0000-0000-0000-0000000000a1',
        'Placeholder biography for a sample representative used in local development.',
        'published', now());

-- A published source, and the claim it supports on the politician.
insert into public.sources (id, source_name, original_url, source_type, document_title, publication_date, last_verified_at, status, published_at)
values ('00000000-0000-0000-0000-0000000000c1',
        'Official Gazette (SAMPLE)', 'https://example.org/sample-gazette',
        'official_document', 'Sample inauguration record', date '2023-06-01', now(), 'published', now());

insert into public.source_links (source_id, subject_type, subject_id, claim, passage)
values ('00000000-0000-0000-0000-0000000000c1', 'politician',
        '00000000-0000-0000-0000-0000000000b1',
        'Holds the office of Member, House of Representatives since 2023.',
        'Sample passage naming the office and start date.');

-- A DRAFT politician: NOT published, so the public read model (RLS) must hide it.
-- Use this to confirm anonymous reads return the published rows above but not this one.
insert into public.politicians (id, full_name, office_title, level, status)
values ('00000000-0000-0000-0000-0000000000b2',
        'Example Draft Politician (SAMPLE)', 'Senator', 'federal', 'draft');
