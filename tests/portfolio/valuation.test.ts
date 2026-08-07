import { describe, expect, it } from "vitest";

import {
  computePortfolio,
  holdingValue,
  isPriceStale,
} from "@/lib/portfolio/valuation";

import { ASSET_CLASSES, ENVELOPES, HOLDINGS, TODAY, TOTAL } from "./fixtures";

const summary = () =>
  computePortfolio({
    holdings: HOLDINGS,
    envelopes: ENVELOPES,
    assetClasses: ASSET_CLASSES,
    today: TODAY,
  });

describe("valorisation d'une ligne", () => {
  it("multiplie quantité et prix unitaire", () => {
    expect(holdingValue(HOLDINGS[2])).toBe("5822.40"); // 12 × 485,20
    expect(holdingValue(HOLDINGS[4])).toBe("3286.00"); // 40 × 82,15
  });

  it("rend le montant saisi tel quel en mode AMOUNT", () => {
    // Le prix est figé à 1 : la valeur DOIT être exactement le montant saisi,
    // sans quoi le Livret A serait faussé par un arrondi.
    expect(holdingValue(HOLDINGS[0])).toBe("8400.00");
    expect(holdingValue(HOLDINGS[1])).toBe("22300.00");
  });

  it("reste exact sur un prix à décimales — pas d'arithmétique flottante", () => {
    // 0.1 + 0.2 en flottant donne 0.30000000000000004 ; ici on veut 3 × 0,1.
    const value = holdingValue({
      ...HOLDINGS[2],
      quantity: "3",
      unitPrice: "0.1",
    });
    expect(value).toBe("0.30");
  });
});

describe("agrégation du portefeuille", () => {
  it("totalise le patrimoine", () => {
    expect(summary().totalValue).toBe(TOTAL);
  });

  it("répartit par classe d'actifs sans rien perdre", () => {
    const { byAssetClass } = summary();
    const byId = new Map(byAssetClass.map((b) => [b.id, b.value]));

    expect(byId.get("cls-cash")).toBe("30700.00"); // 8 400 + 22 300
    expect(byId.get("cls-equity")).toBe("6321.20"); // 5 822,40 + 498,80
    expect(byId.get("cls-commodity")).toBe("3286.00");
    expect(byId.get("cls-realestate")).toBe("2925.00");
  });

  it("répartit par enveloppe sans rien perdre", () => {
    const { byEnvelope } = summary();
    const byId = new Map(byEnvelope.map((b) => [b.id, b.value]));

    expect(byId.get("env-livret")).toBe("8400.00");
    expect(byId.get("env-pea")).toBe("6321.20");
    expect(byId.get("env-av")).toBe("28511.00"); // 22 300 + 3 286 + 2 925
  });

  it("fait des poids qui totalisent 100 %", () => {
    const { byAssetClass, byEnvelope, holdings } = summary();
    const sum = (rows: { weightPct: number }[]) =>
      rows.reduce((total, row) => total + row.weightPct, 0);

    expect(sum(byAssetClass)).toBeCloseTo(100, 3);
    expect(sum(byEnvelope)).toBeCloseTo(100, 3);
    expect(sum(holdings)).toBeCloseTo(100, 3);
  });

  it("écarte les classes et enveloppes sans aucune ligne", () => {
    const withUnused = computePortfolio({
      holdings: HOLDINGS,
      envelopes: [...ENVELOPES, { id: "env-cto", name: "CTO", color: "chart-4" }],
      assetClasses: ASSET_CLASSES,
      today: TODAY,
    });
    expect(withUnused.byEnvelope.map((b) => b.id)).not.toContain("env-cto");
  });

  it("calcule la plus-value sur les seules lignes dont le coût est connu", () => {
    const { totalCostBasis, totalGain, holdingsWithoutCostBasis } = summary();
    // 5 100 + 450 + 3 000 + 3 000 = 11 550 investis
    expect(totalCostBasis).toBe("11550.00");
    // valeur correspondante : 5 822,40 + 498,80 + 3 286 + 2 925 = 12 532,20
    expect(totalGain).toBe("982.20");
    // Livret A et Fonds Euro n'ont pas de coût : la plus-value est partielle.
    expect(holdingsWithoutCostBasis).toBe(2);
  });
});

describe("portefeuille vide", () => {
  it("ne divise pas par zéro", () => {
    const result = computePortfolio({
      holdings: [],
      envelopes: ENVELOPES,
      assetClasses: ASSET_CLASSES,
      today: TODAY,
    });

    expect(result.totalValue).toBe("0.00");
    expect(result.totalGainPct).toBeNull();
    expect(result.byAssetClass).toEqual([]);
    expect(result.holdings).toEqual([]);
  });

  it("donne un poids nul, pas NaN, quand toutes les lignes valent zéro", () => {
    const result = computePortfolio({
      holdings: HOLDINGS.map((h) => ({ ...h, quantity: "0" })),
      envelopes: ENVELOPES,
      assetClasses: ASSET_CLASSES,
      today: TODAY,
    });

    expect(result.totalValue).toBe("0.00");
    for (const holding of result.holdings) {
      expect(Number.isNaN(holding.weightPct)).toBe(false);
      expect(holding.weightPct).toBe(0);
    }
  });
});

describe("fraîcheur des cours", () => {
  it("signale un cours plus vieux que le seuil", () => {
    expect(isPriceStale("2026-01-15", TODAY)).toBe(true);
    expect(isPriceStale("2026-08-05", TODAY)).toBe(false);
  });

  it("ne signale rien quand aucun cours n'a jamais été saisi", () => {
    // Une ligne fraîchement créée ne doit pas s'afficher en alerte.
    expect(isPriceStale(null, TODAY)).toBe(false);
  });

  it("compte les lignes périmées et retient le cours le plus ancien", () => {
    const result = summary();
    expect(result.staleCount).toBe(1); // la SCPI
    expect(result.oldestPriceDate).toBe("2026-01-15");
    expect(result.holdings.find((h) => h.id === "h-scpi")?.isStalePrice).toBe(true);
  });

  it("bascule pile au franchissement du seuil", () => {
    expect(isPriceStale("2026-01-01", "2026-03-31", 89)).toBe(false); // 89 jours
    expect(isPriceStale("2026-01-01", "2026-04-01", 89)).toBe(true); // 90 jours
  });
});
