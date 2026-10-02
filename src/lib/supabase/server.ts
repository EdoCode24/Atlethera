import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { requireSupabaseEnv } from "./env";

/**
 * A Supabase client for one server request, acting as the signed-in user (RLS applies).
 * Server Components can't set cookies; the proxy refreshes the session instead, so a failed
 * set here is ignored.
 */
export async function createSupabaseServer() {
  const { url, key } = requireSupabaseEnv();
  const store = await cookies();
  return createServerClient(url, key, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          for (const { name, value, options } of list) store.set(name, value, options);
        } catch {
          // Called from a Server Component: the proxy keeps the session fresh.
        }
      },
    },
  });
}

/** The verified user id and email of the request, or null. Uses the JWT's claims, not getSession(). */
export async function currentUser(): Promise<{ id: string; email: string | null } | null> {
  const supabase = await createSupabaseServer();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return null;
  return { id: claims.sub, email: typeof claims.email === "string" ? claims.email : null };
}
