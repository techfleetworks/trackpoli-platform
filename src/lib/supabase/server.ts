import { createServerClient } from "@supabase/ssr";

// The one server-side Supabase client for reading PUBLISHED, public data (no
// session). Public pages read the published projection, never draft tables
// (decisions.md). A session-aware server client is added when auth lands.
export function getSupabaseServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      "Supabase server env is not set: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are required.",
    );
  }
  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return [];
      },
      setAll() {
        // No session cookies on the public read client; nothing to persist.
      },
    },
  });
}
