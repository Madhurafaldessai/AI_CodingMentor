alter table public.learner_progress
  add column if not exists lesson_progress jsonb not null default '{}'::jsonb;
