import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";

import {
  allocateContribution,
  computeClassCapacities,
  computeDrift,
  computeEnvelopeHeadroom,
} from "@/lib/portfolio/rebalance";
import { computePortfolio } from "@/lib/portfolio/valuation";
import type { HoldingInput, NamedRef } from "@/lib/portfolio/types";

import { ASSET_CLASSES, ENVELOPES, HOLDINGS, TODAY } from "./fixtures";

const portfolio = computePortfolio({
  holdings: HOLDINGS,
  envelopes: ENVELOPES,
  assetClasses: ASSET_CLASSES,
  today: TODAY,
});

/** Cibles d'exemple, uniquement pour les tests — aucune recommandation. */
const TARGETS = new Map([
  ["cls-equity", 50],
  ["cls-cash", 30],
  ["cls-realestate", 15],
  ["cls-commodity", 5],
]);

const sumOf = (rows: { amount: string }[]) =>
  rows.reduce((total, row) => total.plus(row.amount), new Decimal(0)).toFixed(2);

describe("écarts vs allocation cible", () => {
  const drift = computeDrift({
    byAssetClass: portfolio.byAssetClass,
    targets: TARGETS,
    assetClasses: ASSET_CLASSES,
    totalValue: portfolio.totalValue,
  });

  it("chiffre l'écart en points et en euros", () => {
    const equity = drift.find((row) => row.assetClassId === "cls-equity")!;
    // 6 321,20 / 43 232,20 ≈ 14,62 % pour une cible de 50 %
    expect(equity.currentPct).toBeCloseTo(14.62, 1);
    expect(equity.targetValue).toBe("21616.10"); // 50 % de 43 232,20
    expect(equity.gapValue).toBe("-15294.90");
    expect(equity.status).toBe("under");
  });

  it("classe dans la bande de tolérance ce qui est proche de la cible", () => {
    const commodity = drift.find((row) => row.assetClassId === "cls-commodity")!;
    // 3 286 / 43 232,20 ≈ 7,6 % pour une cible de 5 % → écart 2,6 pt < 5 pt
    expect(commodity.status).toBe("ok");
  });

  it("fait apparaître une classe ciblée mais encore vide", () => {
    // Sans cela, la classe qu'on veut justement commencer à constituer
    // serait invisible dans le tableau des écarts.
    const withCrypto: NamedRef[] = [
      ...ASSET_CLASSES,
      { id: "cls-crypto", name: "Crypto", color: "chart-5" },
    ];
    const rows = computeDrift({
      byAssetClass: portfolio.byAssetClass,
      targets: new Map([...TARGETS, ["cls-crypto", 10]]),
      assetClasses: withCrypto,
      totalValue: portfolio.totalValue,
    });

    const crypto = rows.find((row) => row.assetClassId === "cls-crypto")!;
    expect(crypto.currentValue).toBe("0.00");
    expect(crypto.status).toBe("under");
  });

  it("trie du plus sous-pondéré au plus sur-pondéré", () => {
    expect(drift[0].assetClassId).toBe("cls-equity");
    expect(drift.at(-1)!.assetClassId).toBe("cls-cash");
  });
});

describe("répartition d'un versement", () => {
  it("répartit exactement le montant saisi, au centime près", () => {
    const plan = allocateContribution({
      byAssetClass: portfolio.byAssetClass,
      targets: TARGETS,
      assetClasses: ASSET_CLASSES,
      totalValue: portfolio.totalValue,
      amount: "500",
    });

    expect(sumOf(plan.allocations)).toBe("500.00");
    expect(plan.allocated).toBe("500.00");
    expect(plan.unallocated).toBe("0.00");
  });

  it("dirige le versement vers les classes en retard", () => {
    const plan = allocateContribution({
      byAssetClass: portfolio.byAssetClass,
      targets: TARGETS,
      assetClasses: ASSET_CLASSES,
      totalValue: portfolio.totalValue,
      amount: "500",
    });

    const ids = plan.allocations.map((a) => a.assetClassId);
    expect(ids).toContain("cls-equity");
    expect(ids).toContain("cls-realestate");
    // Liquidités et matières premières sont déjà au-dessus de leur cible.
    expect(ids).not.toContain("cls-cash");
    expect(ids).not.toContain("cls-commodity");
  });

  it("rapproche effectivement le portefeuille de ses cibles", () => {
    const before = computeDrift({
      byAssetClass: portfolio.byAssetClass,
      targets: TARGETS,
      assetClasses: ASSET_CLASSES,
      totalValue: portfolio.totalValue,
    });
    const plan = allocateContribution({
      byAssetClass: portfolio.byAssetClass,
      targets: TARGETS,
      assetClasses: ASSET_CLASSES,
      totalValue: portfolio.totalValue,
      amount: "5000",
    });

    // On applique le plan puis on recalcule l'écart de la classe la plus en retard.
    const applied = portfolio.byAssetClass.map((b) => {
      const extra = plan.allocations.find((a) => a.assetClassId === b.id);
      return {
        ...b,
        value: new Decimal(b.value).plus(extra?.amount ?? 0).toFixed(2),
      };
    });
    const newTotal = new Decimal(portfolio.totalValue).plus("5000").toFixed(2);
    const after = computeDrift({
      byAssetClass: applied.map((b) => ({
        ...b,
        weightPct: new Decimal(b.value)
          .dividedBy(newTotal)
          .times(100)
          .toDecimalPlaces(4)
          .toNumber(),
      })),
      targets: TARGETS,
      assetClasses: ASSET_CLASSES,
      totalValue: newTotal,
    });

    const gapBefore = Math.abs(
      before.find((r) => r.assetClassId === "cls-equity")!.gapPct,
    );
    const gapAfter = Math.abs(
      after.find((r) => r.assetClassId === "cls-equity")!.gapPct,
    );
    expect(gapAfter).toBeLessThan(gapBefore);
  });

  it("distribue le centime résiduel plutôt que de le perdre", () => {
    // 1 000 € sur trois classes à parts égales : 333,333… chacune.
    const classes: NamedRef[] = [
      { id: "a", name: "A", color: null },
      { id: "b", name: "B", color: null },
      { id: "c", name: "C", color: null },
    ];
    const plan = allocateContribution({
      byAssetClass: [],
      targets: new Map([
        ["a", 100 / 3],
        ["b", 100 / 3],
        ["c", 100 / 3],
      ]),
      assetClasses: classes,
      totalValue: "0",
      amount: "1000",
    });

    expect(sumOf(plan.allocations)).toBe("1000.00");
    expect(plan.allocations).toHaveLength(3);
  });

  it("bascule au prorata des cibles quand plus aucune classe n'est en retard", () => {
    const classes: NamedRef[] = [
      { id: "cash", name: "Liquidités", color: null },
      { id: "equity", name: "Actions", color: null },
    ];
    const plan = allocateContribution({
      byAssetClass: [
        { id: "cash", name: "Liquidités", color: null, value: "600.00", weightPct: 60, holdingCount: 1 },
        { id: "equity", name: "Actions", color: null, value: "400.00", weightPct: 40, holdingCount: 1 },
      ],
      // Cibles volontairement inférieures à 100 % pour qu'aucun déficit n'existe.
      targets: new Map([
        ["cash", 50],
        ["equity", 30],
      ]),
      assetClasses: classes,
      totalValue: "1000",
      amount: "100",
    });

    const byId = new Map(plan.allocations.map((a) => [a.assetClassId, a.amount]));
    expect(byId.get("cash")).toBe("62.50"); // 100 × 50/80
    expect(byId.get("equity")).toBe("37.50"); // 100 × 30/80
    expect(sumOf(plan.allocations)).toBe("100.00");
    // Aucun montant négatif, quelle que soit la sur-pondération.
    for (const allocation of plan.allocations) {
      expect(new Decimal(allocation.amount).isNegative()).toBe(false);
    }
  });

  it("ne propose rien pour un montant nul ou négatif", () => {
    for (const amount of ["0", "-100"]) {
      const plan = allocateContribution({
        byAssetClass: portfolio.byAssetClass,
        targets: TARGETS,
        assetClasses: ASSET_CLASSES,
        totalValue: portfolio.totalValue,
        amount,
      });
      expect(plan.allocations).toEqual([]);
      expect(plan.allocated).toBe("0.00");
    }
  });

  it("ne propose rien tant qu'aucune cible n'est définie", () => {
    const plan = allocateContribution({
      byAssetClass: portfolio.byAssetClass,
      targets: new Map(),
      assetClasses: ASSET_CLASSES,
      totalValue: portfolio.totalValue,
      amount: "500",
    });
    expect(plan.allocations).toEqual([]);
    expect(plan.unallocated).toBe("500.00");
  });
});

describe("plafonds d'enveloppe", () => {
  it("laisse une classe illimitée dès qu'une de ses enveloppes est sans plafond", () => {
    const capacities = computeClassCapacities({
      holdings: HOLDINGS,
      envelopes: ENVELOPES,
      byEnvelope: portfolio.byEnvelope,
    });
    // Les liquidités sont plafonnées sur le Livret A mais libres sur le fonds
    // euro : la capacité doit rester illimitée.
    expect(capacities.get("cls-cash")).toBeNull();
    expect(capacities.get("cls-equity")).toBeNull();
  });

  it("écrête le versement et signale le reliquat quand le plafond mord", () => {
    // Classe dont l'unique ligne vit dans une enveloppe plafonnée.
    const envelopes: NamedRef[] = [
      { id: "env-livret", name: "Livret A", color: null, ceilingAmount: "22950.00" },
    ];
    const classes: NamedRef[] = [{ id: "cash", name: "Liquidités", color: null }];
    const holdings: HoldingInput[] = [
      {
        id: "h",
        name: "Livret A",
        envelopeId: "env-livret",
        assetClassId: "cash",
        inputMode: "AMOUNT",
        quantity: "8400",
        unitPrice: "1",
        costBasis: null,
        priceUpdatedAt: null,
      },
    ];
    const local = computePortfolio({
      holdings,
      envelopes,
      assetClasses: classes,
      today: TODAY,
    });
    const capacities = computeClassCapacities({
      holdings,
      envelopes,
      byEnvelope: local.byEnvelope,
    });

    expect(capacities.get("cash")?.toFixed(2)).toBe("14550.00"); // 22 950 − 8 400

    const plan = allocateContribution({
      byAssetClass: local.byAssetClass,
      targets: new Map([["cash", 100]]),
      assetClasses: classes,
      totalValue: local.totalValue,
      amount: "20000",
      capacities,
    });

    expect(plan.allocated).toBe("14550.00");
    expect(plan.unallocated).toBe("5450.00");
    expect(sumOf(plan.allocations)).toBe("14550.00");
  });

  it("chiffre la marge restante sous chaque plafond", () => {
    const headroom = computeEnvelopeHeadroom({
      envelopes: ENVELOPES,
      byEnvelope: portfolio.byEnvelope,
    });

    // Seul le Livret A a un plafond.
    expect(headroom).toHaveLength(1);
    expect(headroom[0].name).toBe("Livret A");
    expect(headroom[0].headroom).toBe("14550.00");
    expect(headroom[0].isFull).toBe(false);
  });

  it("ne rend jamais une marge négative sur une enveloppe dépassée", () => {
    const headroom = computeEnvelopeHeadroom({
      envelopes: ENVELOPES,
      byEnvelope: [
        { id: "env-livret", name: "Livret A", color: null, value: "30000.00", weightPct: 100, holdingCount: 1 },
      ],
    });
    expect(headroom[0].headroom).toBe("0.00");
    expect(headroom[0].isFull).toBe(true);
  });
});
