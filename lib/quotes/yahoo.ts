import "server-only";

import YahooFinance from "yahoo-finance2";

/**
 * Le seul fichier de l'application qui parle à Yahoo Finance.
 *
 * API non officielle : elle exige des cookies et un jeton obtenus côté
 * serveur, et sa disponibilité n'est garantie par personne. D'où deux règles
 * ici : rien ne sort de ce module qui ne soit une donnée brute — aucune
 * décision, aucune conversion, c'est le rôle de `lib/portfolio/quotes.ts` —
 * et aucune exception ne le traverse. Une panne de Yahoo doit dégrader la
 * fraîcheur des cours, jamais la disponibilité de l'application.
 */

const yahooFinance = new YahooFinance({
  // Yahoo limite les requêtes trop rapprochées. Un portefeuille personnel
  // n'a de toute façon qu'une poignée de symboles.
  queue: { concurrency: 2, interval: 250 },
});

export type RawQuote = {
  symbol: string;
  /** Cours en `currency`, en chaîne : la convention monétaire du projet. */
  price: string;
  currency: string;
  /** Horodatage du cours chez Yahoo, ISO. */
  marketTime: string | null;
  shortName: string | null;
};

export type FetchOutcome = {
  quotes: RawQuote[];
  /** Message lisible si l'appel a échoué, null sinon. */
  error: string | null;
};

function asIsoString(value: unknown): string | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    // Yahoo renvoie parfois un epoch en secondes plutôt qu'une Date.
    return new Date(value * 1000).toISOString();
  }
  return null;
}

/**
 * Récupère les cours de plusieurs symboles en un seul appel réseau.
 *
 * Les symboles sans cours exploitable sont simplement absents du résultat :
 * un titre retiré de la cote ou un symbole mal saisi sont des conditions de
 * fonctionnement normales, pas des erreurs. L'appelant constate l'absence.
 */
export async function fetchQuotes(symbols: string[]): Promise<FetchOutcome> {
  if (symbols.length === 0) return { quotes: [], error: null };

  try {
    const results = await yahooFinance.quote(symbols);
    const rows = Array.isArray(results) ? results : [results];

    const quotes: RawQuote[] = [];
    for (const row of rows) {
      if (!row?.symbol) continue;
      const price = row.regularMarketPrice;
      if (typeof price !== "number" || !Number.isFinite(price)) continue;
      if (!row.currency) continue;

      quotes.push({
        symbol: row.symbol,
        price: String(price),
        currency: row.currency,
        marketTime: asIsoString(row.regularMarketTime),
        shortName: row.shortName ?? row.longName ?? null,
      });
    }

    return { quotes, error: null };
  } catch (error) {
    // Erreur réseau, réponse inattendue, échec de validation du schéma : tout
    // remonte sous la même forme, et rien n'est relancé.
    const message =
      error instanceof Error ? error.message : "Erreur inconnue côté Yahoo.";
    return { quotes: [], error: message };
  }
}
