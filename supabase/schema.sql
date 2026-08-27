-- Rent a Mind — demo schema (prefix ram_)
-- Run in Supabase SQL Editor. Service-role access only from the Next.js server;
-- RLS enabled with no policies so anon/authenticated clients cannot touch rows.

create extension if not exists pgcrypto;

create table if not exists ram_listings (
  id uuid primary key default gen_random_uuid(),
  mind_id uuid,                        -- real HelloMinds mindId when live, null for seeded demo minds
  mind_name text not null,
  steward_email text not null,
  steward_name text not null default 'Anonymous Steward',
  title text not null,
  tagline text not null default '',
  description text not null default '',
  category text not null default 'Experts',
  tags text[] not null default '{}',
  emoji text not null default 'brain',
  label text not null default '',      -- e.g. 'PARODY', 'INFO ONLY'
  sample_qa jsonb not null default '[]',
  rate_cognition_per_day numeric not null default 100,
  min_days int not null default 1,
  max_concurrent int not null default 3,
  training_score int not null default 0,
  rating numeric not null default 0,
  rating_count int not null default 0,
  is_seeded boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists ram_rentals (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references ram_listings(id),
  renter_email text not null,
  days int not null,
  starts_at timestamptz not null default now(),
  ends_at timestamptz not null,
  status text not null default 'active',       -- active | expired | ended
  cognition_funded numeric not null default 0,
  cognition_used numeric not null default 0,
  usage_settled_at timestamptz,
  circle_added boolean not null default false, -- true when the renter email was really added to the Mind's circle
  created_at timestamptz not null default now()
);

create table if not exists ram_points_events (
  id uuid primary key default gen_random_uuid(),
  subject_email text not null,
  subject_name text,
  role text not null,                          -- steward | renter
  event_type text not null,                    -- training | rental_supply | renter_usage | bonus | seed
  points numeric not null,
  meta jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists ram_ratings (
  id uuid primary key default gen_random_uuid(),
  rental_id uuid references ram_rentals(id),
  listing_id uuid not null references ram_listings(id),
  stars int not null check (stars between 1 and 5),
  comment text,
  created_at timestamptz not null default now()
);

create index if not exists ram_rentals_listing_idx on ram_rentals(listing_id);
create index if not exists ram_rentals_renter_idx on ram_rentals(renter_email);
create index if not exists ram_points_subject_idx on ram_points_events(subject_email);

-- Lock tables down: server uses service_role (bypasses RLS); no anon access.
alter table ram_listings enable row level security;
alter table ram_rentals enable row level security;
alter table ram_points_events enable row level security;
alter table ram_ratings enable row level security;

-- v2: proxied rental sessions + renter cognition wallets
create table if not exists ram_wallets (
  email text primary key,
  cognition numeric not null default 1000,   -- Season 0 free starting balance
  created_at timestamptz not null default now()
);
alter table ram_wallets enable row level security;

alter table ram_rentals add column if not exists conversation_alias text;
alter table ram_rentals add column if not exists messages_used int not null default 0;
alter table ram_rentals add column if not exists cognition_spent numeric not null default 0;

alter table ram_listings add column if not exists price_per_message numeric not null default 10;
alter table ram_listings add column if not exists service_dna_sent_at timestamptz;

-- Training Studio v2: auto-study loop (no examiner)
-- (ram_training_sessions dropped; plans gained study columns)
-- alter table ram_training_plans add column study_frequency_hours int not null default 24;
-- alter table ram_training_plans add column next_study_at timestamptz;
-- alter table ram_training_plans add column study_cycles int not null default 0;
-- alter table ram_training_plans add column is_studying boolean not null default true;
create table if not exists ram_study_log (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references ram_training_plans(id) on delete cascade,
  topic text not null,
  directive text not null,
  fingerprint text,
  reply text,
  sent_at timestamptz not null default now()
);
alter table ram_study_log enable row level security;

-- Multi-trainer: users sign in with their own Builder key
create table if not exists ram_users (
  human_id text primary key,
  email text unique not null,
  builder_key text not null,          -- AES-GCM encrypted at rest
  display_name text,
  created_at timestamptz not null default now(),
  last_login_at timestamptz
);
alter table ram_users enable row level security;
-- alter table ram_training_plans add column owner_email text;
-- alter table ram_listings add column owner_human_id text;

-- Proof-of-cognition wallets
-- alter table ram_wallets add column real_cognition numeric;
-- alter table ram_wallets add column allowance numeric;
-- alter table ram_wallets add column spent numeric not null default 0;
-- alter table ram_wallets add column synced_at timestamptz;

-- Ratings: one per rental
create unique index if not exists ram_ratings_rental_uidx on ram_ratings(rental_id);
