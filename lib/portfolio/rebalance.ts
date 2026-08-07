import Decimal from "decimal.js";

import type { Breakdown, HoldingInput, NamedRef } from "./types";

/**
 * Rééquilibrage — fonctions pures.
 *
 * L'application ne recommande aucune allocation : elle applique une règle
 * arithmétique de convergence vers les cibles saisies par l'utilisateur.
 */

/** Écart toléré, en points de pourcentage, avant de signaler une dérive. */
export const DEFAULT_BAND_PCT = 5;

export type DriftRow = {
  assetClassId: string;
  name: string;
  color: string | null;
  targetPct: number;
  currentPct: number;
  currentValue: string;
  targetValue: string;
  /** currentPct − targetPct, en points. Négatif = sous-pondéré. */
  gapPct: number;
  /** currentValue − targetValue, en euros. Négatif = à renforcer. */
  gapValue: string;
  status: "under" | "over" | "ok";
};

export type Allocation = {
  assetClassId: string;
  name: string;
  color: string | null;
  amount: string;
  /** Part du versement affectée à cette classe, en pourcentage. */
  sharePct: number;
};

export type ContributionPlan = {
  allocations: Allocation[];
  /** Somme réellement répartie — égale au montant sauf si un plafond bloque. */
  allocated: string;
  /** Reliquat non plaçable, plafonds d'enveloppe saturés. */
  unallocated: string;
};

export type EnvelopeHeadroom = {
  envelopeId: string;
  name: string;
  ceiling: string;
  current: string;
  /** ceiling − current, jamais négatif. */
  headroom: string;
  isFull: boolean;
};

function dec(value: string | number | null | undefined): Decimal {
  if (value === null || value === undefined || value === "") return new Decimal(0);
  const d = new Decimal(value);
  return d.isFinite() ? d : new Decimal(0);
}

function money(d: Decimal): string {
  return d.toFixed(2);
}

/**
 * Somme exacte garantie : on arrondit chaque part à l'inférieur puis on
 * distribue les centimes restants aux plus grosses parties fractionnaires
 * (méthode du plus fort reste). Sans cela, la somme des lignes affichées ne
 * correspondrait pas au montant saisi.
 */
function roundPreservingTotal(raw: Decimal[], total: Decimal): Decimal[] {
  if (raw.length === 0) return [];

  const floored = raw.map((r) => r.toDecimalPlaces(2, Decimal.ROUND_DOWN));
  const distributed = floored.reduce((a, b) => a.plus(b), new Decimal(0));
  const missingCents = total.minus(distributed).times(100).round().toNumber();
  if (missingCents <= 0) return floored;

  const byFraction = raw
    .map((r, index) => ({ index, frac: r.minus(floored[index]) }))
    .sort((a, b) => b.frac.comparedTo(a.frac));

  const result = [...floored];
  for (let i = 0; i < missingCents; i++) {
    const { index } = byFraction[i % byFraction.length];
    result[index] = result[index].plus("0.01");
  }
  return result;
}

/**
 * Compare la répartition actuelle aux cibles.
 *
 * Les classes ciblées mais encore vides sont incluses : c'est précisément
 * celles-là qu'il faut voir pour savoir quoi renforcer.
 */
export function computeDrift(input: {
  byAssetClass: Breakdown[];
  targets: Map<string, number>;
  assetClasses: NamedRef[];
  totalValue: string;
  bandPct?: number;
}): DriftRow[] {
  const { byAssetClass, targets, assetClasses, totalValue } = input;
  const band = input.bandPct ?? DEFAULT_BAND_PCT;
  const total = dec(totalValue);

  const current = new Map(byAssetClass.map((b) => [b.id, b]));
  const relevant = assetClasses.filter(
    (c) => targets.has(c.id) || current.has(c.id),
  );

  return relevant
    .map((cls) => {
      const breakdown = current.get(cls.id);
      const targetPct = targets.get(cls.id) ?? 0;
      const currentValue = dec(breakdown?.value ?? "0");
      const currentPct = breakdown?.weightPct ?? 0;
      const targetValue = total.times(targetPct).dividedBy(100);
      const gapPct = new Decimal(currentPct)
        .minus(targetPct)
        .toDecimalPlaces(2)
        .toNumber();

      return {
        assetClassId: cls.id,
        name: cls.name,
        color: cls.color,
        targetPct,
        currentPct,
        currentValue: money(currentValue),
        targetValue: money(targetValue),
        gapPct,
        gapValue: money(currentValue.minus(targetValue)),
        status: Math.abs(gapPct) <= band ? "ok" : gapPct < 0 ? "under" : "over",
      } satisfies DriftRow;
    })
    .sort((a, b) => a.gapPct - b.gapPct);
}

/**
 * Capacité d'accueil d'une classe, imposée par les plafonds d'enveloppe.
 *
 * Une classe n'est plafonnée que si TOUTES ses lignes vivent dans des
 * enveloppes plafonnées. Dès qu'une seule enveloppe est sans plafond, la
 * capacité est illimitée — cas courant : les liquidités, plafonnées sur le
 * Livret A mais libres sur le fonds euro.
 *
 * Limite connue : si deux classes plafonnées partagent la même enveloppe, les
 * capacités se recouvrent et la somme proposée peut dépasser le plafond réel.
 * Configuration rare, non traitée en V1.
 */
export function computeClassCapacities(input: {
  holdings: HoldingInput[];
  envelopes: NamedRef[];
  byEnvelope: Breakdown[];
}): Map<string, Decimal | null> {
  const { holdings, envelopes, byEnvelope } = input;
  const envelopeById = new Map(envelopes.map((e) => [e.id, e]));
  const valueByEnvelope = new Map(byEnvelope.map((b) => [b.id, dec(b.value)]));

  const headroomOf = (envelopeId: string): Decimal | null => {
    const envelope = envelopeById.get(envelopeId);
    if (!envelope?.ceilingAmount) return null; // pas de plafond → illimité
    const used = valueByEnvelope.get(envelopeId) ?? new Decimal(0);
    return Decimal.max(dec(envelope.ceilingAmount).minus(used), 0);
  };

  const capacities = new Map<string, Decimal | null>();
  for (const holding of holdings) {
    const headroom = headroomOf(holding.envelopeId);
    if (!capacities.has(holding.assetClassId)) {
      capacities.set(holding.assetClassId, headroom);
      continue;
    }
    const known = capacities.get(holding.assetClassId)!;
    // null (illimité) est absorbant : une seule enveloppe libre suffit.
    if (known === null || headroom === null) {
      capacities.set(holding.assetClassId, null);
    } else {
      capacities.set(holding.assetClassId, known.plus(headroom));
    }
  }
  return capacities;
}

/** Marge restante sous le plafond de chaque enveloppe — purement informatif. */
export function computeEnvelopeHeadroom(input: {
  envelopes: NamedRef[];
  byEnvelope: Breakdown[];
}): EnvelopeHeadroom[] {
  const valueByEnvelope = new Map(input.byEnvelope.map((b) => [b.id, dec(b.value)]));

  return input.envelopes
    .filter((e) => Boolean(e.ceilingAmount))
    .map((e) => {
      const ceiling = dec(e.ceilingAmount);
      const current = valueByEnvelope.get(e.id) ?? new Decimal(0);
      const headroom = Decimal.max(ceiling.minus(current), 0);
      return {
        envelopeId: e.id,
        name: e.name,
        ceiling: money(ceiling),
        current: money(current),
        headroom: money(headroom),
        isFull: headroom.lessThanOrEqualTo(0),
      };
    });
}

/**
 * Répartit un versement pour rapprocher le portefeuille de ses cibles, sans
 * rien vendre — donc sans déclencher de fiscalité.
 *
 * Règle : on vise la composition du patrimoine APRÈS versement, et on comble
 * en priorité les classes les plus en retard sur cette cible. Si toutes les
 * classes sont déjà au-dessus de leur cible, plus aucun déficit n'existe et le
 * versement est réparti au prorata des cibles elles-mêmes.
 */
export function allocateContribution(input: {
  byAssetClass: Breakdown[];
  targets: Map<string, number>;
  assetClasses: NamedRef[];
  totalValue: string;
  amount: string;
  capacities?: Map<string, Decimal | null>;
}): ContributionPlan {
  const { byAssetClass, targets, assetClasses, totalValue, capacities } = input;
  const amount = dec(input.amount);
  const total = dec(totalValue);

  const empty: ContributionPlan = {
    allocations: [],
    allocated: money(new Decimal(0)),
    unallocated: money(amount),
  };
  if (amount.lessThanOrEqualTo(0)) {
    return { ...empty, unallocated: money(new Decimal(0)) };
  }

  const targeted = assetClasses.filter((c) => (targets.get(c.id) ?? 0) > 0);
  if (targeted.length === 0) return empty;

  const currentValue = new Map(byAssetClass.map((b) => [b.id, dec(b.value)]));
  const projected = total.plus(amount);

  // Poids de répartition : le retard sur la cible post-versement.
  const weights = new Map<string, Decimal>();
  for (const cls of targeted) {
    const targetValue = projected.times(targets.get(cls.id)!).dividedBy(100);
    const gap = targetValue.minus(currentValue.get(cls.id) ?? new Decimal(0));
    weights.set(cls.id, Decimal.max(gap, 0));
  }
  const totalDeficit = [...weights.values()].reduce(
    (a, b) => a.plus(b),
    new Decimal(0),
  );
  if (totalDeficit.isZero()) {
    // Déjà au-dessus des cibles partout : prorata des cibles.
    for (const cls of targeted) {
      weights.set(cls.id, new Decimal(targets.get(cls.id)!));
    }
  }

  // Remplissage progressif : on sature les classes plafonnées et on
  // redistribue leur surplus aux autres, jusqu'à épuisement du montant.
  const allocated = new Map<string, Decimal>(
    targeted.map((c) => [c.id, new Decimal(0)]),
  );
  const active = new Set(targeted.map((c) => c.id));
  let remaining = amount;

  for (let guard = 0; guard < 50 && remaining.greaterThan(0) && active.size > 0; guard++) {
    const activeWeight = [...active].reduce(
      (sum, id) => sum.plus(weights.get(id) ?? new Decimal(0)),
      new Decimal(0),
    );
    const shareOf = (id: string) =>
      activeWeight.isZero()
        ? remaining.dividedBy(active.size)
        : remaining.times(weights.get(id) ?? new Decimal(0)).dividedBy(activeWeight);

    let saturated = false;
    for (const id of [...active]) {
      const capacity = capacities?.get(id);
      if (capacity === null || capacity === undefined) continue;
      const wanted = allocated.get(id)!.plus(shareOf(id));
      if (wanted.greaterThan(capacity)) {
        remaining = remaining.minus(capacity.minus(allocated.get(id)!));
        allocated.set(id, capacity);
        active.delete(id);
        saturated = true;
      }
    }

    if (!saturated) {
      for (const id of active) {
        allocated.set(id, allocated.get(id)!.plus(shareOf(id)));
      }
      remaining = new Decimal(0);
    }
  }

  const distributable = amount.minus(remaining);
  const ids = targeted.map((c) => c.id);
  const rounded = roundPreservingTotal(
    ids.map((id) => allocated.get(id)!),
    distributable,
  );

  const allocations: Allocation[] = targeted
    .map((cls, index) => ({
      assetClassId: cls.id,
      name: cls.name,
      color: cls.color,
      amount: money(rounded[index]),
      sharePct: amount.isZero()
        ? 0
        : rounded[index].dividedBy(amount).times(100).toDecimalPlaces(2).toNumber(),
    }))
    .filter((a) => new Decimal(a.amount).greaterThan(0))
    .sort((a, b) => new Decimal(b.amount).comparedTo(new Decimal(a.amount)));

  return {
    allocations,
    allocated: money(distributable),
    unallocated: money(remaining),
  };
}
