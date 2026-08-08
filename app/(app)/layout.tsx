import { LogOutIcon } from "lucide-react";
import { redirect } from "next/navigation";

import { AppNav } from "@/components/app-nav";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/toast";
import { getCurrentUser } from "@/lib/supabase/server";

import { signOut } from "../login/actions";

/**
 * Ces pages lisent le portefeuille en direct : elles n'ont aucun sens
 * pré-rendues. Sans cette déclaration, `next build` tente de les générer et
 * ouvre une connexion base depuis chacun de ses neuf workers — ce qui a fait
 * dépasser 60 secondes à /settings avant d'être réessayé.
 */
export const dynamic = "force-dynamic";

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
            <div className="flex items-center gap-1">
              <ThemeToggle />
              <form action={signOut}>
                {/*
                  `aria-label` porté en permanence : sous md le libellé visible
                  disparaît et le bouton se retrouverait réduit à une icône,
                  sans nom accessible. Même texte que le libellé visible, donc
                  aucune divergence entre ce qui s'affiche et ce qui s'annonce.
                */}
                <Button
                  type="submit"
                  variant="ghost"
                  size="sm"
                  aria-label="Déconnexion"
                >
                  <LogOutIcon data-icon="inline-start" />
                  {/*
                    md et non sm : à 640 px exactement, les quatre libellés de
                    navigation viennent d'apparaître et ce mot de plus fait
                    déborder l'en-tête de 16 px, donc toute la page.
                  */}
                  <span className="hidden md:inline">Déconnexion</span>
                </Button>
              </form>
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
          {children}
        </main>
      </div>
    </Toaster>
  );
}
