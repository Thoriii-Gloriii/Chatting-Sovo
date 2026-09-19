import { createClient } from '@supabase/supabase-js';
import config from '../../supabase-config.json';

// Note: the anon/publishable key is meant to be public — it's the client-side
// key Supabase's own docs say is safe to ship in a bundle. Actual data access
// control lives in Postgres Row Level Security (RLS) policies (see
// supabase/schema.sql), not in keeping this key secret. This mirrors how
// firebase-applet-config.json committed a real Firebase apiKey for the same
// reason.
export const supabase = createClient(config.url, config.anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});
