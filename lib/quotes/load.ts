import "server-only";

import { listAssetClasses, listEnvelopes, listHoldings, loadPortfolio } from "@/lib/db/queries";
import { applyQuotes, quotableSymbols } from "@/lib/portfolio/quotes";

import { getQuotes } from "./service";

/**
 * Chargement du portefeuille, cours de marché appliqués.
 *
 * Point d'entrée unique des écrans : le tableau de bord, le rééquilibrage et
 * la liste des lignes doivent afficher la même valeur pour un même support.
 * Les faire converger ici est la seule façon de garantir qu'ils ne divergent
 * pas — c'est déjà arrivé sur la nomenclature, dupliquée puis désynchronisée.
 */

export async function loadPortfolioWithQuotes() {
  const data = await loadPortfolio();
  const { quotes, error } = await getQuotes(quotableSymbols(data.holdings));
  const { holdings, applied, rejected } = applyQuotes(data.holdings, quotes);

  return {
    ...data,
    holdings,
    quoteApplied: applied,
    quoteRejected: rejected,
    quoteError: error,
  };
}

/**
 * Même superposition pour l'écran de gestion des lignes, qui lit des lignes
 * brutes plutôt que les entrées du moteur.
 */
export async function listHoldingsWithQuotes(includeInactive = false) {
  const [rows, envelopes, assetClasses] = await Promise.all([
    listHoldings(includeInactive),
    listEnvelopes(),
    listAssetClasses(),
  ]);

  const { quotes, error } = await getQuotes(quotableSymbols(rows));
  const { holdings, applied, rejected } = applyQuotes(rows, quotes);

  return {
    holdings,
    envelopes,
    assetClasses,
    quoteApplied: applied,
    quoteRejected: rejected,
    quoteError: error,
  };
}
