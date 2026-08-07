import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Client Supabase côté serveur — utilisé uniquement pour l'authentification.
 * Les données du portefeuille passent par Drizzle (lib/db), pas par PostgREST.
 *
 * `cookies()` est asynchrone depuis Next.js 16 : l'accès synchrone, toléré en
 * 15, a été supprimé.
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Appelé depuis un Server Component, où l'écriture de cookie est
            // interdite. Le rafraîchissement de session est assuré par
            // proxy.ts, donc l'ignorer ici est sans conséquence.
          }
        },
      },
    },
  );
}

/**
 * Utilisateur courant, ou null.
 *
 * `getUser()` et non `getSession()` : seul le premier revalide le jeton auprès
 * de Supabase. `getSession()` fait confiance au cookie, qui peut être forgé.
 */
export async function getCurrentUser() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}
