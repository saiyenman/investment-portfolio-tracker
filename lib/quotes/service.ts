import "server-only";

import { readQuotes, upsertQuotes } from "@/lib/db/queries";
import { rateSymbolFor, type StoredQuote } from "@/lib/portfolio/quotes";

import { fetchQuotes } from "./yahoo";

/**
 * Cotations : cache et repli.
 *
 * La table `quotes` porte les deux rôles. Cache d'abord : Yahoo n'est rappelé
 * que si la ligne dépasse le délai ci-dessous, ce qui garantit l'espacement
 * quel que soit le nombre d'instances qui servent l'application — un cache en
 * mémoire ne le garantirait que par instance. Repli ensuite : quand Yahoo ne
 * répond pas, la dernière valeur connue reste disponible, avec son heure,
 * plutôt que de laisser un écran vide.
 */

/** Espacement minimal entre deux appels pour un même symbole. */
export const QUOTE_TTL_MINUTES = 15;

/** Plancher du rafraîchissement manuel — évite le martèlement au clic. */
const FORCED_FLOOR_MINUTES = 1;

export type QuotesResult = {
  quotes: Map<string, StoredQuote>;
  /** Message d'erreur du dernier appel, null si tout s'est bien passé. */
  error: string | null;
  /** Vrai si Yahoo a réellement été appelé pendant ce chargement. */
  refreshed: boolean;
};

type QuoteRow = Awaited<ReturnType<typeof readQuotes>>[number];

function toStored(row: QuoteRow): StoredQuote {
  return {
    symbol: row.symbol,
    price: row.price,
    currency: row.currency,
    marketTime: row.marketTime ? row.marketTime.toISOString() : null,
    fetchedAt: row.fetchedAt.toISOString(),
  };
}

function isExpired(row: QuoteRow, maxAgeMinutes: number): boolean {
  const ageMs = Date.now() - row.fetchedAt.getTime();
  return ageMs > maxAgeMinutes * 60_000;
}

/**
 * Charge les cotations demandées, en n'appelant Yahoo que si nécessaire.
 *
 * Deux passes sont nécessaires : les devises ne sont connues qu'une fois les
 * cours reçus, et c'est d'elles que dépendent les taux de change à demander.
 * La seconde passe n'a donc lieu que si une devise étrangère apparaît.
 */
export async function getQuotes(
  symbols: string[],
  options: { force?: boolean } = {},
): Promise<QuotesResult> {
  const wanted = [...new Set(symbols.map((s) => s.trim()).filter(Boolean))];
  if (wanted.length === 0) {
    return { quotes: new Map(), error: null, refreshed: false };
  }

  const maxAge = options.force ? FORCED_FLOOR_MINUTES : QUOTE_TTL_MINUTES;
  const cache = new Map<string, StoredQuote>();
  let error: string | null = null;
  let refreshed = false;

  // ─── Passe 1 : les cours
  const stored = await readQuotes(wanted);
  const bySymbol = new Map(stored.map((row) => [row.symbol, row]));
  for (const row of stored) cache.set(row.symbol, toStored(row));

  const missing = wanted.filter((symbol) => {
    const row = bySymbol.get(symbol);
    return !row || isExpired(row, maxAge);
  });

  if (missing.length > 0) {
    const outcome = await fetchQuotes(missing);
    error = outcome.error;
    refreshed = outcome.quotes.length > 0;
    await persist(outcome.quotes, cache);
  }

  // ─── Passe 2 : les taux de change qu'appellent les devises reçues
  const rateSymbols = new Set<string>();
  for (const symbol of wanted) {
    const quote = cache.get(symbol);
    if (!quote) continue;
    const currency = normalizeForRate(quote.currency);
    if (currency === null) continue;
    rateSymbols.add(rateSymbolFor(currency));
  }

  if (rateSymbols.size > 0) {
    const rateList = [...rateSymbols];
    const storedRates = await readQuotes(rateList);
    const rateBySymbol = new Map(storedRates.map((row) => [row.symbol, row]));
    for (const row of storedRates) cache.set(row.symbol, toStored(row));

    const missingRates = rateList.filter((symbol) => {
      const row = rateBySymbol.get(symbol);
      return !row || isExpired(row, maxAge);
    });

    if (missingRates.length > 0) {
      const outcome = await fetchQuotes(missingRates);
      // Ne masque pas une erreur de la première passe.
      error = error ?? outcome.error;
      refreshed = refreshed || outcome.quotes.length > 0;
      await persist(outcome.quotes, cache);
    }
  }

  return { quotes: cache, error, refreshed };
}

async function persist(
  rows: Awaited<ReturnType<typeof fetchQuotes>>["quotes"],
  cache: Map<string, StoredQuote>,
) {
  if (rows.length === 0) return;

  await upsertQuotes(
    rows.map((row) => ({
      symbol: row.symbol,
      price: row.price,
      currency: row.currency,
      marketTime: row.marketTime ? new Date(row.marketTime) : null,
      shortName: row.shortName,
    })),
  );

  const now = new Date().toISOString();
  for (const row of rows) {
    cache.set(row.symbol, {
      symbol: row.symbol,
      price: row.price,
      currency: row.currency,
      marketTime: row.marketTime,
      fetchedAt: now,
    });
  }
}

/**
 * Devise nécessitant un taux, ou null si la cotation est déjà en euros.
 *
 * « GBp » — des pence — est ramené à « GBP » : c'est la livre qu'il faut
 * convertir, la sous-unité étant traitée dans `convertQuote`.
 */
function normalizeForRate(currency: string): string | null {
  const code = currency.trim() === "GBp" ? "GBP" : currency.trim().toUpperCase();
  return code === "EUR" ? null : code;
}
