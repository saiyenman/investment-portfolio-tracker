import { LogOutIcon } from "lucide-react";
import { redirect } from "next/navigation";

import { AppNav } from "@/components/app-nav";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/toast";
import { getCurrentUser } from "@/lib/supabase/server";

import { signOut } from "../login/actions";

/**
 * Garde d'authentification de second niveau.
 *
 * `proxy.ts` protège déjà ces routes, mais un Server Component reste
 * atteignable par d'autres chemins (Server Actions notamment) : vérifier ici
 * aussi coûte une requête déjà en cache et ferme le contournement.
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <Toaster>
      <div className="flex min-h-svh flex-col">
        <header className="border-b">
          <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-3">
            <AppNav />
            <form action={signOut}>
              <Button type="submit" variant="ghost" size="sm">
                <LogOutIcon data-icon="inline-start" />
                <span className="hidden sm:inline">Déconnexion</span>
              </Button>
            </form>
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
          {children}
        </main>
      </div>
    </Toaster>
  );
}
