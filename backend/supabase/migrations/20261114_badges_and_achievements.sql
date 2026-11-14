-- Badges catalog and user achievements
create table if not exists public.badges (
  id text primary key,
  title text not null,
  description text not null
);

create table if not exists public.user_badges (
  user_id uuid not null references auth.users(id) on delete cascade,
  badge_id text not null references public.badges(id),
  earned_at timestamptz not null default now(),
  primary key(user_id, badge_id)
);

alter table public.badges enable row level security;
alter table public.user_badges enable row level security;

drop policy if exists "badge catalog readable" on public.badges;
create policy "badge catalog readable" on public.badges for select using (true);

drop policy if exists "badge owner access" on public.user_badges;
create policy "badge owner access" on public.user_badges for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

insert into public.badges (id, title, description) values
  ('first-steps', 'First steps', 'Completed your first coding exercise'),
  ('on-a-roll', 'On a roll', 'Achieved a learning streak of at least 1 day'),
  ('bug-whisperer', 'Bug whisperer', 'Fixed an error and completed an exercise'),
  ('next-up', 'Next up', 'Reached 100 or more total XP')
on conflict (id) do update set
  title = excluded.title,
  description = excluded.description;
