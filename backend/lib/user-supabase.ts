import { createClient } from '@supabase/supabase-js';

export async function authenticateUser(request: Request) {
  const accessToken = request.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!accessToken) {
    return { client: null, user: null, error: 'Please log in to continue.', status: 401 };
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    return { client: null, user: null, error: 'Authentication is not configured.', status: 500 };
  }

  const client = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { autoRefreshToken: false, persistSession: false }
  });
  const { data, error } = await client.auth.getUser(accessToken);
  if (error || !data.user) {
    return { client: null, user: null, error: 'Your session has expired. Please log in again.', status: 401 };
  }

  return { client, user: data.user, error: null, status: 200 };
}
