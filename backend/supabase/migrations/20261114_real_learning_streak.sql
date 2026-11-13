alter table public.learner_progress
  add column if not exists activity_dates date[] not null default '{}';

update public.learner_progress progress
set activity_dates = coalesce((
  select array_agg(activity_day order by activity_day)
  from (
    select distinct ((attempt->>'completedAt')::timestamptz at time zone 'UTC')::date as activity_day
    from jsonb_array_elements(progress.attempt_log) attempt
    where attempt->>'completedAt' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T'
  ) days
), '{}'::date[]);
