create table if not exists public.learner_progress (
  user_id uuid primary key references auth.users(id) on delete cascade,
  language text not null default 'python' check (language in ('python','javascript','cpp')),
  current_challenge_id text default 'reverse-string',
  completed_challenges text[] not null default '{}',
  total_xp integer not null default 0,
  level integer not null default 1,
  streak integer not null default 0,
  pace text not null default 'steady' check (pace in ('fast','steady','needs_support')),
  concept_mastery jsonb not null default '{}'::jsonb,
  attempt_log jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.learner_progress enable row level security;
drop policy if exists "learner progress owner access" on public.learner_progress;
create policy "learner progress owner access" on public.learner_progress
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
