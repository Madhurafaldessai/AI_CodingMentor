# ByteBloom

A coding learning app with an adaptive challenge workspace and a progressive AI mentor named Bloom.

## Accounts and saved progress

The app uses Supabase email/password authentication. To allow immediate sign-in after registration, enable the Email provider and disable email confirmation in the Supabase authentication settings. Set the local and deployed `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` values; never expose a service-role key in the browser.

The base database is defined in `backend/supabase/schema.sql`. For an existing installation, run `backend/supabase/migrations/20261113_learner_progress.sql` in the Supabase SQL Editor to enable per-user challenge progress and resume behavior.
