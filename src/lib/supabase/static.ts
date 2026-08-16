import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Supabase client for public, read-only data in Server Components.
 *
 * The cookie-aware client in `./server` calls `cookies()`, which opts the
 * whole route out of static rendering — every visit then hits the database
 * before the first byte. None of the data behind the map, the landing page
 * or the sources page is user-specific: it is public-read under RLS and
 * changes only when the monthly ingest runs. Reading it without cookies
 * lets those routes be prerendered and revalidated on a timer instead.
 *
 * Use `./server` instead whenever a request's session actually matters
 * (Server Actions, anything authenticated).
 */
export function createStaticClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
