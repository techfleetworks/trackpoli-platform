import { createClient } from "@supabase/supabase-js";

// SERVER ONLY. Uses the service-role key, which BYPASSES Row Level Security.
// Never import this from client code or a component; it is for the admin data
// pipeline (import, AI population, review, publish) running on the server.
export function getSupabaseAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error(
      "Supabase admin env is not set: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required (server-only).",
    );
  }
  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
