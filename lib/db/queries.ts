import "server-only";

import { and, asc, count, eq, inArray, sql } from "drizzle-orm";

import type { HoldingInput, NamedRef } from "@/lib/portfolio/types";

import { getDb } from "./index";
import {
  allocationTargets,
  assetClasses,
  envelopes,
  holdings,
  quotes,
} from "./schema";

/**
 * Toute la couche SQL de l'application vit ici — jamais dans les composants.
 *
 * C'est ce qui rendra la V4 (journal d'opérations) indolore : quand `quantity`
 * passera de colonne saisie à somme calculée, seul ce fichier changera.
 */

// ───────────────────────────────────────────────────────────────── Lectures

export async function listEnvelopes(includeInactive = false) {
  const db = getDb();
  return db
    .select()
    .from(envelopes)
    .where(includeInactive ? undefined : eq(envelopes.isActive, true))
    .orderBy(asc(envelopes.sortOrder), asc(envelopes.name));
}

export async function listAssetClasses(includeInactive = false) {
  const db = getDb();
  return db
    .select()
    .from(assetClasses)
    .where(includeInactive ? undefined : eq(assetClasses.isActive, true))
    .orderBy(asc(assetClasses.sortOrder), asc(assetClasses.name));
}

export async function listHoldings(includeInactive = false) {
  const db = getDb();
  return db
    .select({
      id: holdings.id,
      name: holdings.name,
      isin: holdings.isin,
      quoteSymbol: holdings.quoteSymbol,
      envelopeId: holdings.envelopeId,
      assetClassId: holdings.assetClassId,
      inputMode: holdings.inputMode,
      quantity: holdings.quantity,
      unitPrice: holdings.unitPrice,
      priceUpdatedAt: holdings.priceUpdatedAt,
      costBasis: holdings.costBasis,
      note: holdings.note,
      sortOrder: holdings.sortOrder,
      isActive: holdings.isActive,
      envelopeName: envelopes.name,
      envelopeColor: envelopes.color,
      assetClassName: assetClasses.name,
      assetClassColor: assetClasses.color,
    })
    .from(holdings)
    .innerJoin(envelopes, eq(envelopes.id, holdings.envelopeId))
    .innerJoin(assetClasses, eq(assetClasses.id, holdings.assetClassId))
    .where(includeInactive ? undefined : eq(holdings.isActive, true))
    .orderBy(asc(holdings.sortOrder), asc(holdings.name));
}

export async function listTargets() {
  const db = getDb();
  return db.select().from(allocationTargets);
}

export type HoldingRow = Awaited<ReturnType<typeof listHoldings>>[number];

/**
 * Charge en une passe tout ce dont le moteur a besoin, dans la forme qu'il
 * attend. Les trois requêtes sont indépendantes : on les lance en parallèle.
 */
export async function loadPortfolio() {
  const [envelopeRows, classRows, holdingRows, targetRows] = await Promise.all([
    listEnvelopes(),
    listAssetClasses(),
    listHoldings(),
    listTargets(),
  ]);

  const envelopeRefs: NamedRef[] = envelopeRows.map((e) => ({
    id: e.id,
    name: e.name,
    color: e.color,
    ceilingAmount: e.ceilingAmount,
  }));
  const classRefs: NamedRef[] = classRows.map((c) => ({
    id: c.id,
    name: c.name,
    color: c.color,
  }));
  const holdingInputs: HoldingInput[] = holdingRows.map((h) => ({
    id: h.id,
    name: h.name,
    envelopeId: h.envelopeId,
    assetClassId: h.assetClassId,
    inputMode: h.inputMode === "AMOUNT" ? "AMOUNT" : "QUANTITY",
    quantity: h.quantity,
    unitPrice: h.unitPrice,
    costBasis: h.costBasis,
    priceUpdatedAt: h.priceUpdatedAt,
    isin: h.isin,
    quoteSymbol: h.quoteSymbol,
  }));

  return {
    envelopes: envelopeRefs,
    assetClasses: classRefs,
    holdings: holdingInputs,
    holdingRows,
    /**
     * Les lignes brutes, comme `holdingRows` : la description d'une classe est
     * de la présentation, pas du calcul. La mettre dans NamedRef ferait entrer
     * du texte d'affichage dans les types du moteur, qui n'en a que faire.
     */
    assetClassRows: classRows,
    targets: new Map(targetRows.map((t) => [t.assetClassId, Number(t.targetPct)])),
  };
}

// ───────────────────────────────────────────────────────────────── Écritures

async function nextSortOrder(table: typeof envelopes | typeof assetClasses) {
  const db = getDb();
  const [row] = await db
    .select({ max: sql<number>`coalesce(max(${table.sortOrder}), 0)` })
    .from(table);
  return Number(row?.max ?? 0) + 1;
}

export type EnvelopeInput = {
  name: string;
  color: string | null;
  ceilingAmount: string | null;
};

export async function createEnvelope(input: EnvelopeInput) {
  const db = getDb();
  const [row] = await db
    .insert(envelopes)
    .values({ ...input, sortOrder: await nextSortOrder(envelopes) })
    .returning();
  return row;
}

export async function updateEnvelope(id: string, input: EnvelopeInput) {
  const db = getDb();
  const [row] = await db
    .update(envelopes)
    .set(input)
    .where(eq(envelopes.id, id))
    .returning();
  return row;
}

export type AssetClassInput = {
  name: string;
  color: string | null;
  description: string | null;
};

export async function createAssetClass(input: AssetClassInput) {
  const db = getDb();
  const [row] = await db
    .insert(assetClasses)
    .values({ ...input, sortOrder: await nextSortOrder(assetClasses) })
    .returning();
  return row;
}

export async function updateAssetClass(id: string, input: AssetClassInput) {
  const db = getDb();
  const [row] = await db
    .update(assetClasses)
    .set(input)
    .where(eq(assetClasses.id, id))
    .returning();
  return row;
}

/**
 * Nombre de lignes ACTIVES rattachées — sert à refuser une désactivation qui
 * ferait disparaître des lignes du tableau de bord sans prévenir.
 */
export async function countActiveHoldings(
  scope: "envelope" | "assetClass",
  id: string,
) {
  const db = getDb();
  const [row] = await db
    .select({ total: count() })
    .from(holdings)
    .where(
      and(
        eq(holdings.isActive, true),
        scope === "envelope"
          ? eq(holdings.envelopeId, id)
          : eq(holdings.assetClassId, id),
      ),
    );
  return Number(row?.total ?? 0);
}

export async function setEnvelopeActive(id: string, isActive: boolean) {
  const db = getDb();
  await db.update(envelopes).set({ isActive }).where(eq(envelopes.id, id));
}

export async function setAssetClassActive(id: string, isActive: boolean) {
  const db = getDb();
  await db.update(assetClasses).set({ isActive }).where(eq(assetClasses.id, id));
}

// ─────────────────────────────────────────────────────────── Cotations

export async function readQuotes(symbols: string[]) {
  if (symbols.length === 0) return [];
  const db = getDb();
  return db.select().from(quotes).where(inArray(quotes.symbol, symbols));
}

export type QuoteWriteInput = {
  symbol: string;
  price: string;
  currency: string;
  marketTime: Date | null;
  shortName: string | null;
};

/**
 * Écrase la cotation de chaque symbole.
 *
 * `fetched_at` est réécrit à chaque passage, y compris quand le cours n'a pas
 * bougé : c'est lui qui porte le délai de péremption, pas le cours.
 *
 * Il est daté par `now()` côté Postgres, jamais par l'horloge de
 * l'application : la fraîcheur est ensuite comparée à cette même horloge. Les
 * dater séparément a déjà produit un âge négatif de trois secondes ; un
 * décalage de quelques minutes fausserait le délai de rafraîchissement.
 */
export async function upsertQuotes(rows: QuoteWriteInput[]) {
  if (rows.length === 0) return;
  const db = getDb();
  await db
    .insert(quotes)
    .values(rows)
    .onConflictDoUpdate({
      target: quotes.symbol,
      set: {
        price: sql`excluded.price`,
        currency: sql`excluded.currency`,
        marketTime: sql`excluded.market_time`,
        shortName: sql`excluded.short_name`,
        fetchedAt: sql`now()`,
      },
    });
}

export type HoldingWriteInput = {
  name: string;
  isin: string | null;
  quoteSymbol: string | null;
  envelopeId: string;
  assetClassId: string;
  inputMode: "QUANTITY" | "AMOUNT";
  quantity: string;
  unitPrice: string;
  priceUpdatedAt: string | null;
  costBasis: string | null;
  note: string | null;
};

export async function createHolding(input: HoldingWriteInput) {
  const db = getDb();
  const [row] = await db
    .select({ max: sql<number>`coalesce(max(${holdings.sortOrder}), 0)` })
    .from(holdings);
  const [created] = await db
    .insert(holdings)
    .values({ ...input, sortOrder: Number(row?.max ?? 0) + 1 })
    .returning();
  return created;
}

export async function updateHolding(id: string, input: HoldingWriteInput) {
  const db = getDb();
  const [row] = await db
    .update(holdings)
    .set(input)
    .where(eq(holdings.id, id))
    .returning();
  return row;
}

export async function setHoldingActive(id: string, isActive: boolean) {
  const db = getDb();
  await db.update(holdings).set({ isActive }).where(eq(holdings.id, id));
}

export async function deleteHolding(id: string) {
  const db = getDb();
  await db.delete(holdings).where(eq(holdings.id, id));
}

/**
 * Met à jour la seule valeur d'une ligne, depuis le tableau de bord.
 *
 * La colonne visée dépend du mode : en QUANTITY c'est le cours, en AMOUNT
 * c'est la quantité — qui porte des euros, le cours restant figé à 1. Écrire
 * un montant dans `unit_price` d'une ligne AMOUNT multiplierait la valeur par
 * elle-même.
 */
export async function updateHoldingValue(
  id: string,
  inputMode: "QUANTITY" | "AMOUNT",
  value: string,
  priceUpdatedAt: string,
) {
  const db = getDb();
  await db
    .update(holdings)
    .set(
      inputMode === "AMOUNT"
        ? { quantity: value, unitPrice: "1", priceUpdatedAt }
        : { unitPrice: value, priceUpdatedAt },
    )
    .where(eq(holdings.id, id));
}

/**
 * Remplace l'intégralité des cibles : une allocation est un tout cohérent
 * (somme à 100 %), pas une collection de lignes indépendantes.
 */
export async function replaceTargets(
  entries: { assetClassId: string; targetPct: string }[],
) {
  const db = getDb();
  await db.transaction(async (tx) => {
    await tx.delete(allocationTargets);
    if (entries.length > 0) {
      await tx.insert(allocationTargets).values(entries);
    }
  });
}
