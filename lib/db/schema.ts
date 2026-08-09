import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * Modèle V1 — 4 tables.
 *
 * Principe directeur : la répartition actuelle du patrimoine ne dépend pas de
 * l'historique des transactions, seulement de ce qui est détenu aujourd'hui.
 * On stocke donc des POSITIONS, pas un journal d'opérations.
 *
 * Une seule formule de valorisation dans tout le code : quantity × unitPrice.
 */

/** Niveau 1 — enveloppes fiscales (PEA, Assurance-Vie, Livret A, CTO, PER…). */
export const envelopes = pgTable("envelopes", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(),
  /** Couleur du segment dans les graphiques (hex). */
  color: text("color"),
  /** Plafond réglementaire éventuel — écrête les propositions de versement. */
  ceilingAmount: numeric("ceiling_amount", { precision: 18, scale: 2 }),
  sortOrder: integer("sort_order").notNull().default(0),
  /** Suppression logique : jamais de DELETE, pour ne pas trouer l'historique. */
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/** Niveau 2 — classes d'actifs (Actions, Immobilier, Or, Liquidités…). */
export const assetClasses = pgTable("asset_classes", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(),
  color: text("color"),
  /**
   * À quoi correspond cette classe. Portée par la ligne et non par une table
   * de correspondance dans le code : la nomenclature est dynamique, une classe
   * créée depuis /settings n'aurait sinon aucune explication, et un renommage
   * ferait disparaître celle d'une classe existante.
   */
  description: text("description"),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/**
 * Niveau 3 — lignes de portefeuille (un support DANS une enveloppe).
 *
 * Le même ETF détenu en PEA et en Assurance-Vie donne deux lignes : pas de
 * table de jonction, aucune ambiguïté sur la répartition.
 */
export const holdings = pgTable(
  "holdings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    envelopeId: uuid("envelope_id")
      .notNull()
      .references(() => envelopes.id, { onDelete: "restrict" }),
    assetClassId: uuid("asset_class_id")
      .notNull()
      .references(() => assetClasses.id, { onDelete: "restrict" }),

    name: text("name").notNull(),
    isin: text("isin"),

    /**
     * QUANTITY → on saisit des parts et un cours (ETF, SCPI, ETC Or).
     * AMOUNT   → on saisit un montant en euros ; unitPrice est figé à 1
     *            (Livret A, Fonds Euro). Le calcul reste identique.
     */
    inputMode: text("input_mode").notNull().default("QUANTITY"),
    quantity: numeric("quantity", { precision: 24, scale: 8 })
      .notNull()
      .default("0"),
    unitPrice: numeric("unit_price", { precision: 20, scale: 8 })
      .notNull()
      .default("1"),
    /** Fraîcheur du cours — au-delà du seuil, l'UI affiche une alerte. */
    priceUpdatedAt: date("price_updated_at"),

    /** Montant investi, facultatif : sert à afficher la plus-value. */
    costBasis: numeric("cost_basis", { precision: 18, scale: 2 }),
    note: text("note"),

    sortOrder: integer("sort_order").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    check("holdings_input_mode_check", sql`${t.inputMode} in ('QUANTITY', 'AMOUNT')`),
    check("holdings_quantity_positive", sql`${t.quantity} >= 0`),
    check("holdings_unit_price_positive", sql`${t.unitPrice} >= 0`),
    unique("holdings_envelope_name_unique").on(t.envelopeId, t.name),
  ],
);

/** Allocation cible par classe d'actifs — la référence du rééquilibrage. */
export const allocationTargets = pgTable(
  "allocation_targets",
  {
    assetClassId: uuid("asset_class_id")
      .primaryKey()
      .references(() => assetClasses.id, { onDelete: "cascade" }),
    targetPct: numeric("target_pct", { precision: 6, scale: 3 }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    check(
      "allocation_targets_pct_range",
      sql`${t.targetPct} >= 0 and ${t.targetPct} <= 100`,
    ),
  ],
);

export type Envelope = typeof envelopes.$inferSelect;
export type AssetClass = typeof assetClasses.$inferSelect;
export type Holding = typeof holdings.$inferSelect;
export type AllocationTarget = typeof allocationTargets.$inferSelect;

export type NewEnvelope = typeof envelopes.$inferInsert;
export type NewAssetClass = typeof assetClasses.$inferInsert;
export type NewHolding = typeof holdings.$inferInsert;
