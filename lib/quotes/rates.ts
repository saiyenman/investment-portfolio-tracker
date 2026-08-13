import "server-only";

import {
  BASE_CURRENCY,
  INPUT_CURRENCIES,
  rateSymbolFor,
} from "@/lib/portfolio/quotes";

import { getQuotes } from "./service";

/**
 * Taux de change des devises de saisie.
 *
 * Même source et même cache que les cours : le taux affiché dans le formulaire
 * et celui appliqué à l'enregistrement sont donc le même tant que le quart
 * d'heure n'a pas tourné. Passer un symbole `=X` à `getQuotes` ne déclenche
 * pas de seconde passe — Yahoo renvoie « USDEUR=X » libellé en EUR, que
 * `normalizeForRate` écarte.
 */

/** { USD: "0.8661", GBP: "1.1503", … } — devise absente si le taux manque. */
export async function loadInputRates(): Promise<Record<string, string>> {
  const currencies = INPUT_CURRENCIES.filter((c) => c !== BASE_CURRENCY);
  const { quotes } = await getQuotes(currencies.map(rateSymbolFor));

  const rates: Record<string, string> = {};
  for (const currency of currencies) {
    const quote = quotes.get(rateSymbolFor(currency));
    if (quote) rates[currency] = quote.price;
  }
  return rates;
}
