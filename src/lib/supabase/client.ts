"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseEnv } from "./env";

let client: SupabaseClient | null = null;

/** The browser's Supabase client, made on first use (never at import, so builds need no keys). */
export function getSupabase(): SupabaseClient {
  if (!client) {
    const { url, key } = requireSupabaseEnv();
    client = createBrowserClient(url, key);
  }
  return client;
}
