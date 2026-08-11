import Decimal from "decimal.js";

/**
 * Application des cours de marché aux lignes de portefeuille.
 *
 * Fonctions pures, aucun accès base ni réseau : c'est ici que vit la justesse
 * du chiffre, donc c'est ici que portent les tests. Le module qui parle à
 * Yahoo ne fait que rapporter des données brutes ; il ne décide rien.
 *
 * Le portefeuille est tenu en euros. Une cotation dans une autre devise est
 * convertie avant d'entrer dans le moteur de valorisation, jamais après :
 * `computePortfolio` ne doit jamais voir un dollar.
 */

/** Devise de tenue du portefeuille. Tout est ramené à celle-ci. */
export const BASE_CURRENCY = "EUR";

/**
 * Le minimum qu'une ligne doit porter pour recevoir un cours.
 *
 * Type structurel plutôt que `HoldingInput` : les lignes lues en base pour
 * `/holdings` n'ont pas la même forme que celles données au moteur, et les
 * deux écrans doivent afficher la même valeur. La généricité garantit que
 * l'appelant récupère son propre type, enrichi et non appauvri.
 */
export type QuotableHolding = {
  id: string;
  inputMode: string;
  unitPrice: string;
  priceUpdatedAt: string | null;
  quoteSymbol?: string | null;
};

export type StoredQuote = {
  symbol: string;
  /** Cours dans `currency`, en représentation exacte. */
  price: string;
  currency: string;
  /** Horodatage du cours chez Yahoo, ISO. Null si non renvoyé. */
  marketTime: string | null;
  /** Horodatage de notre appel, ISO — sert à mesurer la fraîcheur. */
  fetchedAt: string;
};

export type AppliedQuote = {
  symbol: string;
  /** Cours converti en euros — celui qui compte dans les totaux. */
  price: string;
  /** Cours tel que coté, avant conversion. */
  sourcePrice: string;
  sourceCurrency: string;
  /** Taux appliqué, null si la cotation était déjà en euros. */
  rate: string | null;
  /** Symbole du taux utilisé, pour que l'écran puisse le nommer. */
  rateSymbol: string | null;
  asOf: string;
};

export type RejectionReason =
  | "no-quote"
  | "invalid-price"
  | "missing-rate"
  | "invalid-rate";

export type RejectedQuote = {
  symbol: string;
  reason: RejectionReason;
  /** Devise reçue — renseignée dès que la cotation est arrivée. */
  currency: string | null;
};

export type QuoteApplication<T> = {
  holdings: T[];
  /** Clé : identifiant de ligne. */
  applied: Map<string, AppliedQuote>;
  rejected: Map<string, RejectedQuote>;
};

/**
 * Symbole Yahoo du taux de change vers l'euro.
 *
 * Convention Yahoo : « USDEUR=X » vaut le nombre d'euros pour un dollar
 * (~0,87), donc le cours se multiplie par ce taux. « EURUSD=X » est l'inverse
 * (~1,15) et donnerait un patrimoine surévalué de 30 %.
 */
export function rateSymbolFor(currency: string): string {
  return `${normalizeCurrency(currency)}${BASE_CURRENCY}=X`;
}

/**
 * Le LSE cote certains titres en pence sous le code « GBp », minuscule
 * significative. Sans cette normalisation la ligne vaudrait cent fois son
 * prix, et le code devise ne correspondrait à aucun taux de change.
 */
function normalizeCurrency(currency: string): string {
  return currency.trim().toUpperCase();
}

function isPence(currency: string): boolean {
  return currency.trim() === "GBp";
}

function toPositiveDecimal(value: string | null | undefined): Decimal | null {
  if (value === null || value === undefined || value === "") return null;
  let d: Decimal;
  try {
    d = new Decimal(value);
  } catch {
    return null;
  }
  if (!d.isFinite() || d.lessThanOrEqualTo(0)) return null;
  return d;
}

/** Date ISO (YYYY-MM-DD) portée par une cotation. */
function quoteDate(quote: StoredQuote): string {
  return (quote.marketTime ?? quote.fetchedAt).slice(0, 10);
}

/**
 * Convertit une cotation en euros.
 *
 * Retourne le détail plutôt que le seul montant : un écran de patrimoine doit
 * pouvoir montrer d'où sort un chiffre converti, sinon il n'est pas
 * vérifiable.
 */
export function convertQuote(
  quote: StoredQuote,
  quotes: Map<string, StoredQuote>,
): AppliedQuote | RejectedQuote {
  const rawPrice = toPositiveDecimal(quote.price);
  if (rawPrice === null) {
    return { symbol: quote.symbol, reason: "invalid-price", currency: quote.currency };
  }

  // Les pence d'abord : « GBp » n'est pas une devise, c'est une sous-unité.
  const pence = isPence(quote.currency);
  const price = pence ? rawPrice.dividedBy(100) : rawPrice;
  const currency = pence ? "GBP" : normalizeCurrency(quote.currency);

  if (currency === BASE_CURRENCY) {
    return {
      symbol: quote.symbol,
      price: price.toFixed(8),
      sourcePrice: quote.price,
      sourceCurrency: quote.currency,
      rate: null,
      rateSymbol: null,
      asOf: quoteDate(quote),
    };
  }

  const rateSymbol = rateSymbolFor(currency);
  const rateQuote = quotes.get(rateSymbol);
  if (!rateQuote) {
    return { symbol: quote.symbol, reason: "missing-rate", currency };
  }

  const rate = toPositiveDecimal(rateQuote.price);
  if (rate === null) {
    return { symbol: quote.symbol, reason: "invalid-rate", currency };
  }

  return {
    symbol: quote.symbol,
    price: price.times(rate).toFixed(8),
    sourcePrice: quote.price,
    sourceCurrency: quote.currency,
    rate: rateQuote.price,
    rateSymbol,
    // Le cours et le taux peuvent dater d'instants différents ; on retient le
    // plus ancien des deux, qui borne la fraîcheur de la valeur affichée.
    asOf:
      quoteDate(quote) < quoteDate(rateQuote)
        ? quoteDate(quote)
        : quoteDate(rateQuote),
  };
}

function isRejection(
  value: AppliedQuote | RejectedQuote,
): value is RejectedQuote {
  return "reason" in value;
}

/**
 * Superpose les cotations disponibles aux lignes de portefeuille.
 *
 * Ne modifie rien en place : renvoie un nouveau tableau, que l'appelant passe
 * tel quel à `computePortfolio`. Le moteur de valorisation reste ainsi pur et
 * ignorant du réseau.
 */
export function applyQuotes<T extends QuotableHolding>(
  holdings: T[],
  quotes: Map<string, StoredQuote>,
): QuoteApplication<T> {
  const applied = new Map<string, AppliedQuote>();
  const rejected = new Map<string, RejectedQuote>();

  const next = holdings.map((holding) => {
    const symbol = holding.quoteSymbol?.trim();
    if (!symbol) return holding;

    // En mode AMOUNT le « cours » vaut toujours 1 et la quantité porte des
    // euros : y écrire un cours de marché multiplierait le solde par lui-même.
    // Une ligne de fonds euro à 2 623,91 € deviendrait plusieurs millions.
    if (holding.inputMode === "AMOUNT") return holding;

    const quote = quotes.get(symbol);
    if (!quote) {
      rejected.set(holding.id, { symbol, reason: "no-quote", currency: null });
      return holding;
    }

    const result = convertQuote(quote, quotes);
    if (isRejection(result)) {
      rejected.set(holding.id, result);
      return holding;
    }

    applied.set(holding.id, result);
    return { ...holding, unitPrice: result.price, priceUpdatedAt: result.asOf };
  });

  return { holdings: next, applied, rejected };
}

/**
 * Symboles à demander à Yahoo : ceux des lignes réellement cotées.
 *
 * Dédoublonnés — le même ETF dans deux enveloppes ne justifie pas deux appels.
 */
export function quotableSymbols(holdings: QuotableHolding[]): string[] {
  const symbols = new Set<string>();
  for (const holding of holdings) {
    const symbol = holding.quoteSymbol?.trim();
    if (symbol && holding.inputMode !== "AMOUNT") symbols.add(symbol);
  }
  return [...symbols];
}
