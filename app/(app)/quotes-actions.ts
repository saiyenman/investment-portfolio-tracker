"use server";

import { revalidatePath } from "next/cache";

import { listHoldings } from "@/lib/db/queries";
import { quotableSymbols } from "@/lib/portfolio/quotes";
import { getQuotes } from "@/lib/quotes/service";
import { actionFailure, actionSuccess, type ActionState } from "@/lib/action-state";
import { getCurrentUser } from "@/lib/supabase/server";

async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw new Error("Non authentifié.");
}

/**
 * Rafraîchissement manuel des cours.
 *
 * Les écrans se contentent normalement du cache de quinze minutes ; ce bouton
 * sert quand on veut la valeur de l'instant. Le plancher d'une minute côté
 * service empêche que des clics répétés ne déclenchent autant d'appels.
 */
export async function refreshQuotes(
  _previous: ActionState,
  _formData: FormData,
): Promise<ActionState> {
  await requireUser();

  const holdings = await listHoldings();
  const symbols = quotableSymbols(holdings);
  if (symbols.length === 0) {
    return actionFailure("Aucune ligne ne suit un symbole de cotation.");
  }

  const { error } = await getQuotes(symbols, { force: true });
  revalidatePath("/", "layout");

  // Une panne de Yahoo n'est pas un échec de l'action : les valeurs de repli
  // restent affichées. On le dit, sans faire croire à une mise à jour.
  if (error) {
    return actionFailure(`Yahoo n'a pas répondu : ${error}`);
  }
  return actionSuccess();
}
