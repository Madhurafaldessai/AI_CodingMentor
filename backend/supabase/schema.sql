create extension if not exists pgcrypto;
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique, language text check (language in ('python','javascript','cpp')),
  experience_level text default 'beginner', explain_style text default 'step_by_step',
  style_scores jsonb not null default '{}'::jsonb, pace text default 'steady',
  theme_preference text default 'system', total_xp integer not null default 0,
  created_at timestamptz not null default now()
);
create table if not exists public.challenges (
  id text primary key, title text not null, difficulty text not null,
  tags text[] not null default '{}', languages text[] not null default '{}',
  public_data jsonb not null
);
create table if not exists public.challenge_solutions (
  challenge_id text primary key references public.challenges(id) on delete cascade,
  solution_by_language jsonb not null
);
create table if not exists public.attempts (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  challenge_id text not null references public.challenges(id), language text not null,
  passed boolean not null, attempts integer not null default 1, time_spent_sec integer not null default 0,
  hints_used integer[] not null default '{}', error_categories text[] not null default '{}', created_at timestamptz not null default now()
);
create table if not exists public.concept_mastery (
  user_id uuid not null references auth.users(id) on delete cascade, concept_tag text not null,
  score numeric not null default 40 check (score between 0 and 100), updated_at timestamptz not null default now(),
  primary key(user_id,concept_tag)
);
create table if not exists public.mentor_events (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  challenge_id text references public.challenges(id), style text, hint_level integer check (hint_level between 1 and 4),
  helpful boolean, message text, created_at timestamptz not null default now()
);
create table if not exists public.quests (id text primary key, title text not null, target integer not null, reward_xp integer not null default 0);
create table if not exists public.badges (id text primary key, title text not null, description text not null);
create table if not exists public.user_badges (
  user_id uuid not null references auth.users(id) on delete cascade, badge_id text not null references public.badges(id),
  earned_at timestamptz not null default now(), primary key(user_id,badge_id)
);
alter table public.challenge_solutions enable row level security;
alter table public.profiles enable row level security;
alter table public.attempts enable row level security;
alter table public.concept_mastery enable row level security;
alter table public.mentor_events enable row level security;
alter table public.user_badges enable row level security;
create policy "profile owner access" on public.profiles for all using (auth.uid()=id) with check (auth.uid()=id);
create policy "attempt owner access" on public.attempts for all using (auth.uid()=user_id) with check (auth.uid()=user_id);
create policy "mastery owner access" on public.concept_mastery for all using (auth.uid()=user_id) with check (auth.uid()=user_id);
create policy "mentor owner access" on public.mentor_events for all using (auth.uid()=user_id) with check (auth.uid()=user_id);
create policy "badge owner access" on public.user_badges for all using (auth.uid()=user_id) with check (auth.uid()=user_id);
create policy "challenge catalog readable" on public.challenges for select using (true);
create policy "quest catalog readable" on public.quests for select using (true);
create policy "badge catalog readable" on public.badges for select using (true);
