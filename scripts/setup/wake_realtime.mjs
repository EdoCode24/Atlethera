// A new Supabase project's Realtime service creates its tables (realtime.messages) only when a
// client first connects. This opens one private channel for a few seconds to trigger that; the
// join itself is refused (there is no user), which is fine.
// Used by apply_migrations.py. Usage: node scripts/setup/wake_realtime.mjs
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = Object.fromEntries(
  readFileSync(new URL("../../.env.local", import.meta.url), "utf8")
    .split(/\r?\n/)
    .filter((line) => line.trim() && !line.trim().startsWith("#") && line.includes("="))
    .map((line) => {
      const at = line.indexOf("=");
      return [line.slice(0, at).trim(), line.slice(at + 1).trim().replace(/^["']|["']$/g, "")];
    }),
);

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
supabase.channel("setup", { config: { private: true } }).subscribe();
setTimeout(async () => {
  await supabase.removeAllChannels();
  process.exit(0);
}, 12000);
