import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";

import {
  applyQuotes,
  quotableSymbols,
  rateSymbolFor,
  type StoredQuote,
} from "@/lib/portfolio/quotes";
import type { HoldingInput } from "@/lib/portfolio/types";
import { computePortfolio } from "@/lib/portfolio/valuation";

import { ASSET_CLASSES, ENVELOPES, HOLDINGS, TODAY } from "./fixtures";

function quote(
  symbol: string,
  price: string,
  currency: string,
  marketTime = "2026-08-11T14:00:00.000Z",
): StoredQuote {
  return {
    symbol,
    price,
    currency,
    marketTime,
    fetchedAt: "2026-08-11T14:05:00.000Z",
  };
}

function map(...entries: StoredQuote[]): Map<string, StoredQuote> {
  return new Map(entries.map((q) => [q.symbol, q]));
}

/** Ligne cotée en dollars, calquée sur le NVDA réellement détenu. */
const NVDA: HoldingInput = {
  id: "h-nvda",
  name: "NVDA",
  envelopeId: "env-pea",
  assetClassId: "cls-equity",
  inputMode: "QUANTITY",
  quantity: "11",
  unitPrice: "223.80",
  costBasis: "2000.00",
  priceUpdatedAt: "2026-08-08",
  quoteSymbol: "NVDA",
};

/** Ligne cotée en euros. */
const WORLD: HoldingInput = { ...HOLDINGS[2], quoteSymbol: "WPEA.PA" };

describe("symbole du taux de change", () => {
  it("va vers l'euro, pas depuis l'euro", () => {
    // Le sens compte : USDEUR=X vaut ~0,87 et EURUSD=X ~1,15. Se tromper
    // surévaluerait le patrimoine de 30 %.
    expect(rateSymbolFor("USD")).toBe("USDEUR=X");
    expect(rateSymbolFor("gbp")).toBe("GBPEUR=X");
  });
});

describe("sélection des symboles à interroger", () => {
  it("ne retient que les lignes cotées, sans doublon", () => {
    const holdings = [WORLD, NVDA, { ...NVDA, id: "h-nvda-cto" }, HOLDINGS[0]];
    expect(quotableSymbols(holdings).sort()).toEqual(["NVDA", "WPEA.PA"]);
  });

  it("ignore une ligne en mode montant même si elle porte un symbole", () => {
    const livret = { ...HOLDINGS[0], quoteSymbol: "NVDA" };
    expect(quotableSymbols([livret])).toEqual([]);
  });
});

describe("application d'une cotation en euros", () => {
  it("remplace le cours et la date, sans taux de change", () => {
    const { holdings, applied, rejected } = applyQuotes(
      [WORLD],
      map(quote("WPEA.PA", "6.24", "EUR")),
    );

    expect(rejected.size).toBe(0);
    expect(holdings[0].unitPrice).toBe("6.24000000");
    expect(holdings[0].priceUpdatedAt).toBe("2026-08-11");

    const detail = applied.get(WORLD.id)!;
    expect(detail.rate).toBeNull();
    expect(detail.sourceCurrency).toBe("EUR");
  });
});

describe("conversion d'une cotation en devise étrangère", () => {
  it("multiplie par le taux vers l'euro", () => {
    const { holdings, applied } = applyQuotes(
      [NVDA],
      map(quote("NVDA", "219.68", "USD"), quote("USDEUR=X", "0.8661", "EUR")),
    );

    // 219,68 × 0,8661 = 190,26... — vérifié en Decimal, pas en flottant.
    const expected = new Decimal("219.68").times("0.8661");
    expect(holdings[0].unitPrice).toBe(expected.toFixed(8));

    const detail = applied.get(NVDA.id)!;
    expect(detail.sourcePrice).toBe("219.68");
    expect(detail.sourceCurrency).toBe("USD");
    expect(detail.rate).toBe("0.8661");
    expect(detail.rateSymbol).toBe("USDEUR=X");
  });

  it("fait baisser la valeur d'une ligne saisie en dollars", () => {
    // Le défaut que la conversion corrige : 11 × 223,80 comptés comme des
    // euros valaient 2 461,80 €, alors que la ligne vaut ~2 093 €.
    const before = new Decimal(NVDA.quantity).times(NVDA.unitPrice);
    const { holdings } = applyQuotes(
      [NVDA],
      map(quote("NVDA", "219.68", "USD"), quote("USDEUR=X", "0.8661", "EUR")),
    );
    const after = new Decimal(holdings[0].quantity).times(holdings[0].unitPrice);

    expect(after.lessThan(before)).toBe(true);
    expect(after.toFixed(2)).toBe("2092.91");
  });

  it("retient la plus ancienne des deux dates, cours ou taux", () => {
    const { applied } = applyQuotes(
      [NVDA],
      map(
        quote("NVDA", "219.68", "USD", "2026-08-11T14:00:00.000Z"),
        quote("USDEUR=X", "0.8661", "EUR", "2026-08-09T14:00:00.000Z"),
      ),
    );
    expect(applied.get(NVDA.id)!.asOf).toBe("2026-08-09");
  });

  it("traite les pence du LSE comme des centièmes de livre", () => {
    // « GBp » n'est pas une devise mais une sous-unité : sans division par
    // 100 la ligne vaudrait cent fois son prix.
    const line = { ...NVDA, quoteSymbol: "VOD.L" };
    const { holdings } = applyQuotes(
      [line],
      map(quote("VOD.L", "8000", "GBp"), quote("GBPEUR=X", "1.15", "EUR")),
    );
    // 8000 pence = 80 GBP → 92 EUR
    expect(new Decimal(holdings[0].unitPrice).toFixed(2)).toBe("92.00");
  });
});

describe("refus d'appliquer une cotation douteuse", () => {
  it("conserve le cours saisi quand le taux manque", () => {
    const { holdings, applied, rejected } = applyQuotes(
      [NVDA],
      map(quote("NVDA", "219.68", "USD")),
    );

    expect(applied.size).toBe(0);
    expect(holdings[0].unitPrice).toBe("223.80");
    expect(rejected.get(NVDA.id)).toMatchObject({
      reason: "missing-rate",
      currency: "USD",
    });
  });

  it("signale une ligne dont la cotation n'est pas revenue", () => {
    const { holdings, rejected } = applyQuotes([NVDA], map());
    expect(holdings[0].unitPrice).toBe("223.80");
    expect(rejected.get(NVDA.id)).toMatchObject({ reason: "no-quote" });
  });

  it.each([
    ["zéro", "0"],
    ["négatif", "-12.5"],
    ["non numérique", "n/a"],
  ])("refuse un prix %s", (_label, price) => {
    const { holdings, rejected } = applyQuotes(
      [WORLD],
      map(quote("WPEA.PA", price, "EUR")),
    );
    expect(holdings[0].unitPrice).toBe("485.20");
    expect(rejected.get(WORLD.id)!.reason).toBe("invalid-price");
  });

  it("refuse un taux de change nul", () => {
    const { holdings, rejected } = applyQuotes(
      [NVDA],
      map(quote("NVDA", "219.68", "USD"), quote("USDEUR=X", "0", "EUR")),
    );
    expect(holdings[0].unitPrice).toBe("223.80");
    expect(rejected.get(NVDA.id)!.reason).toBe("invalid-rate");
  });
});

describe("lignes hors périmètre", () => {
  it("laisse intacte une ligne sans symbole", () => {
    const { holdings, applied, rejected } = applyQuotes(
      [HOLDINGS[5]],
      map(quote("SCPI", "999", "EUR")),
    );
    expect(holdings[0]).toBe(HOLDINGS[5]);
    expect(applied.size + rejected.size).toBe(0);
  });

  it("laisse intacte une ligne en mode montant portant un symbole", () => {
    // Le garde-fou décisif : écrire un cours sur un Livret A multiplierait le
    // solde par lui-même — 8 400 € deviendraient 1,8 million.
    const livret = { ...HOLDINGS[0], quoteSymbol: "NVDA" };
    const { holdings, rejected } = applyQuotes(
      [livret],
      map(quote("NVDA", "219.68", "USD"), quote("USDEUR=X", "0.8661", "EUR")),
    );
    expect(holdings[0].unitPrice).toBe("1");
    expect(holdings[0].quantity).toBe("8400");
    expect(rejected.size).toBe(0);
  });
});

describe("enchaînement avec le moteur de valorisation", () => {
  it("garde des poids qui totalisent exactement 100 %", () => {
    const holdings = HOLDINGS.map((h) =>
      h.id === "h-world" ? { ...h, quoteSymbol: "WPEA.PA" } : h,
    );
    const applied = applyQuotes(
      holdings,
      map(quote("WPEA.PA", "500.00", "EUR")),
    );

    const summary = computePortfolio({
      holdings: applied.holdings,
      envelopes: ENVELOPES,
      assetClasses: ASSET_CLASSES,
      today: TODAY,
    });

    const total = summary.byAssetClass.reduce(
      (sum, b) => sum.plus(b.weightPct),
      new Decimal(0),
    );
    expect(total.toDecimalPlaces(2).toNumber()).toBe(100);
    // 12 × 500 remplace 12 × 485,20 : le total a bougé.
    expect(summary.totalValue).toBe("43409.80");
  });
});
