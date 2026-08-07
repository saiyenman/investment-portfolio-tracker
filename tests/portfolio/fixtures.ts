import type { HoldingInput, NamedRef } from "@/lib/portfolio/types";

/**
 * Portefeuille de référence — reprend la nomenclature seedée, avec des
 * montants ronds vérifiables à la main.
 *
 *   Livret A            8 400,00   (AMOUNT)
 *   Fonds Euro         22 300,00   (AMOUNT)
 *   ETF MSCI World      5 822,40   (12 × 485,20)
 *   ETF S&P 500           498,80   (8 × 62,35)
 *   Amundi Gold ETC     3 286,00   (40 × 82,15)
 *   SCPI                2 925,00   (15 × 195,00)
 *   ───────────────────────────
 *   TOTAL              43 232,20
 */
export const TOTAL = "43232.20";

export const ENVELOPES: NamedRef[] = [
  { id: "env-livret", name: "Livret A", color: "chart-1", ceilingAmount: "22950.00" },
  { id: "env-pea", name: "PEA", color: "chart-2", ceilingAmount: null },
  { id: "env-av", name: "Assurance-Vie", color: "chart-3", ceilingAmount: null },
];

export const ASSET_CLASSES: NamedRef[] = [
  { id: "cls-cash", name: "Liquidités / Sécurisé", color: "chart-1" },
  { id: "cls-equity", name: "Actions", color: "chart-2" },
  { id: "cls-realestate", name: "Immobilier", color: "chart-3" },
  { id: "cls-commodity", name: "Matières premières", color: "chart-4" },
];

export const HOLDINGS: HoldingInput[] = [
  {
    id: "h-livret",
    name: "Livret A",
    envelopeId: "env-livret",
    assetClassId: "cls-cash",
    inputMode: "AMOUNT",
    quantity: "8400",
    unitPrice: "1",
    costBasis: null,
    priceUpdatedAt: null,
  },
  {
    id: "h-fondseuro",
    name: "Fonds Euro Nouvelle Génération",
    envelopeId: "env-av",
    assetClassId: "cls-cash",
    inputMode: "AMOUNT",
    quantity: "22300",
    unitPrice: "1",
    costBasis: null,
    priceUpdatedAt: null,
  },
  {
    id: "h-world",
    name: "ETF MSCI World",
    envelopeId: "env-pea",
    assetClassId: "cls-equity",
    inputMode: "QUANTITY",
    quantity: "12",
    unitPrice: "485.20",
    costBasis: "5100.00",
    priceUpdatedAt: "2026-08-05",
  },
  {
    id: "h-sp500",
    name: "ETF S&P 500",
    envelopeId: "env-pea",
    assetClassId: "cls-equity",
    inputMode: "QUANTITY",
    quantity: "8",
    unitPrice: "62.35",
    costBasis: "450.00",
    priceUpdatedAt: "2026-08-05",
  },
  {
    id: "h-gold",
    name: "Amundi Physical Gold ETC C",
    envelopeId: "env-av",
    assetClassId: "cls-commodity",
    inputMode: "QUANTITY",
    quantity: "40",
    unitPrice: "82.15",
    costBasis: "3000.00",
    priceUpdatedAt: "2026-08-05",
    isin: "FR0013416716",
  },
  {
    id: "h-scpi",
    name: "SCPI",
    envelopeId: "env-av",
    assetClassId: "cls-realestate",
    inputMode: "QUANTITY",
    quantity: "15",
    unitPrice: "195.00",
    costBasis: "3000.00",
    // Cours ancien : sert à vérifier la détection de péremption.
    priceUpdatedAt: "2026-01-15",
  },
];

export const TODAY = "2026-08-07";
