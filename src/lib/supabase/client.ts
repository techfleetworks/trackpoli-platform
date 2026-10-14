import { createBrowserClient } from "@supabase/ssr";

// The one browser-side Supabase client. Uses the anon key (safe to expose ONLY
// because Row Level Security must be enabled on every table). Env is read lazily so
// a build with no env configured still succeeds; a real call fails loudly.
export function getSupabaseBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      "Supabase browser env is not set: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are required.",
    );
  }
  return createBrowserClient(url, anonKey);
}
