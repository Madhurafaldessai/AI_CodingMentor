import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const browserSupabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

export async function fetchWithUserSession(input: RequestInfo | URL, init: RequestInit = {}) {
  if (!browserSupabase) {
    throw new Error('Authentication is not configured. Please contact support.');
  }

  const { data, error } = await browserSupabase.auth.getSession();
  if (error) throw new Error(error.message);

  const accessToken = data.session?.access_token;
  if (!accessToken) throw new Error('Please log in to continue.');

  const headers = new Headers(init.headers);
  headers.set('Authorization', 'Bearer ' + accessToken);

  return fetch(input, { ...init, headers });
}
