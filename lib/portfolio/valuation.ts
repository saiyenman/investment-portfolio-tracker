import Decimal from "decimal.js";

import type {
  Breakdown,
  HoldingInput,
  NamedRef,
  PortfolioSummary,
  ValuedHolding,
} from "./types";

/**
 * Moteur de valorisation — fonctions pures, aucun accès base.
 *
 * Toute l'arithmétique monétaire passe par Decimal : un `number` JavaScript ne
 * représente pas exactement 485,20 €, et l'erreur se propage silencieusement
 * dans les totaux et les pourcentages.
 */

/** Au-delà de ce délai, un cours est signalé comme périmé dans l'interface. */
export const STALE_PRICE_DAYS = 90;

const MONEY_DP = 2;

function toDecimal(value: string | null | undefined): Decimal {
  if (value === null || value === undefined || value === "") return new Decimal(0);
  const d = new Decimal(value);
  return d.isFinite() ? d : new Decimal(0);
}

function money(d: Decimal): string {
  return d.toFixed(MONEY_DP);
}

/** Nombre de jours entiers entre deux dates ISO (YYYY-MM-DD). */
export function daysBetween(from: string, to: string): number {
  const a = Date.UTC(
    Number(from.slice(0, 4)),
    Number(from.slice(5, 7)) - 1,
    Number(from.slice(8, 10)),
  );
  const b = Date.UTC(
    Number(to.slice(0, 4)),
    Number(to.slice(5, 7)) - 1,
    Number(to.slice(8, 10)),
  );
  return Math.floor((b - a) / 86_400_000);
}

/**
 * Un cours jamais renseigné n'est pas considéré comme périmé : la ligne vient
 * d'être créée, ou elle est en mode AMOUNT où le « cours » vaut toujours 1.
 */
export function isPriceStale(
  priceUpdatedAt: string | null,
  today: string,
  thresholdDays: number = STALE_PRICE_DAYS,
): boolean {
  if (!priceUpdatedAt) return false;
  return daysBetween(priceUpdatedAt, today) > thresholdDays;
}

/**
 * La formule unique de l'application : quantité × prix unitaire.
 *
 * Signature volontairement structurelle et minimale : toute ligne portant une
 * quantité et un prix convient, y compris celles lues en base sans passer par
 * `computePortfolio`.
 */
export function holdingValue(holding: {
  quantity: string;
  unitPrice: string;
}): string {
  return money(toDecimal(holding.quantity).times(toDecimal(holding.unitPrice)));
}

function buildBreakdown(
  holdings: ValuedHolding[],
  refs: NamedRef[],
  keyOf: (h: ValuedHolding) => string,
  total: Decimal,
): Breakdown[] {
  const totals = new Map<string, { value: Decimal; count: number }>();
  for (const h of holdings) {
    const key = keyOf(h);
    const current = totals.get(key) ?? { value: new Decimal(0), count: 0 };
    totals.set(key, {
      value: current.value.plus(h.value),
      count: current.count + 1,
    });
  }

  return refs
    .map((ref) => {
      const entry = totals.get(ref.id) ?? { value: new Decimal(0), count: 0 };
      return {
        id: ref.id,
        name: ref.name,
        color: ref.color,
        value: money(entry.value),
        weightPct: total.isZero()
          ? 0
          : entry.value.dividedBy(total).times(100).toDecimalPlaces(4).toNumber(),
        holdingCount: entry.count,
      };
    })
    .filter((b) => b.holdingCount > 0)
    .sort((a, b) => new Decimal(b.value).comparedTo(new Decimal(a.value)));
}

/**
 * Calcule l'intégralité du tableau de bord à partir des lignes actives.
 *
 * `today` est un paramètre plutôt qu'un `new Date()` interne : sans cela la
 * détection de péremption des cours serait intestable.
 */
export function computePortfolio(input: {
  holdings: HoldingInput[];
  envelopes: NamedRef[];
  assetClasses: NamedRef[];
  today: string;
  stalePriceDays?: number;
}): PortfolioSummary {
  const { holdings, envelopes, assetClasses, today } = input;
  const stalePriceDays = input.stalePriceDays ?? STALE_PRICE_DAYS;

  const total = holdings.reduce(
    (sum, h) => sum.plus(toDecimal(h.quantity).times(toDecimal(h.unitPrice))),
    new Decimal(0),
  );

  const valued: ValuedHolding[] = holdings.map((h) => {
    const value = toDecimal(h.quantity).times(toDecimal(h.unitPrice));
    const hasCost = h.costBasis !== null && h.costBasis !== undefined;
    const cost = toDecimal(h.costBasis);
    const gain = hasCost ? value.minus(cost) : null;

    return {
      ...h,
      value: money(value),
      weightPct: total.isZero()
        ? 0
        : value.dividedBy(total).times(100).toDecimalPlaces(4).toNumber(),
      gain: gain ? money(gain) : null,
      gainPct:
        gain && cost.greaterThan(0)
          ? gain.dividedBy(cost).times(100).toDecimalPlaces(2).toNumber()
          : null,
      isStalePrice: isPriceStale(h.priceUpdatedAt, today, stalePriceDays),
    };
  });

  const withCost = holdings.filter(
    (h) => h.costBasis !== null && h.costBasis !== undefined,
  );
  const totalCostBasis = withCost.reduce(
    (sum, h) => sum.plus(toDecimal(h.costBasis)),
    new Decimal(0),
  );
  // La plus-value ne porte que sur les lignes dont le coût est renseigné,
  // sinon on comparerait une valeur totale à un coût partiel.
  const valueWithCost = withCost.reduce(
    (sum, h) => sum.plus(toDecimal(h.quantity).times(toDecimal(h.unitPrice))),
    new Decimal(0),
  );
  const totalGain = valueWithCost.minus(totalCostBasis);

  const dates = holdings
    .map((h) => h.priceUpdatedAt)
    .filter((d): d is string => Boolean(d))
    .sort();

  return {
    totalValue: money(total),
    totalCostBasis: money(totalCostBasis),
    holdingsWithoutCostBasis: holdings.length - withCost.length,
    totalGain: money(totalGain),
    totalGainPct: totalCostBasis.greaterThan(0)
      ? totalGain.dividedBy(totalCostBasis).times(100).toDecimalPlaces(2).toNumber()
      : null,
    holdings: valued,
    byAssetClass: buildBreakdown(valued, assetClasses, (h) => h.assetClassId, total),
    byEnvelope: buildBreakdown(valued, envelopes, (h) => h.envelopeId, total),
    oldestPriceDate: dates[0] ?? null,
    staleCount: valued.filter((h) => h.isStalePrice).length,
  };
}
