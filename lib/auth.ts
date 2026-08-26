import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { STEWARD_EMAIL } from "./minds";

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/** Cookie-bridged Supabase client for Server Components and Route Handlers. */
export async function supaServer() {
  const store = await cookies();
  return createServerClient(URL_, ANON, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          list.forEach(({ name, value, options }) => store.set(name, value, options));
        } catch {
          // Server Components can't write cookies; middleware handles refresh.
        }
      },
    },
  });
}

/** The signed-in user's email (lowercased), or null. */
export async function getSessionEmail(): Promise<string | null> {
  try {
    const supa = await supaServer();
    const { data } = await supa.auth.getUser();
    return data.user?.email?.toLowerCase() ?? null;
  } catch {
    return null;
  }
}

export function isTrainer(email: string | null): boolean {
  return !!email && email.toLowerCase() === STEWARD_EMAIL.toLowerCase();
}

/** Admin auth client (service role) — used by the login API, never in pages. */
export function supaAdmin() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(URL_, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
