/**
 * Types du moteur de calcul.
 *
 * Volontairement structurels et minimaux : le moteur ne dépend pas de Drizzle
 * ni de la base. Les lignes lues en base satisfont ces types, mais un test
 * peut en fabriquer à la main sans toucher à Postgres.
 *
 * Convention monétaire : les montants circulent en `string` (représentation
 * exacte, comme les NUMERIC de Postgres) et ne sont convertis en `number` que
 * pour les pourcentages, qui sont de l'affichage.
 */

export type InputMode = "QUANTITY" | "AMOUNT";

export type HoldingInput = {
  id: string;
  name: string;
  envelopeId: string;
  assetClassId: string;
  inputMode: InputMode;
  /** Nombre de parts, ou montant en euros si inputMode vaut AMOUNT. */
  quantity: string;
  /** Cours unitaire, figé à "1" en mode AMOUNT. */
  unitPrice: string;
  /** Montant investi, facultatif — sert à afficher la plus-value. */
  costBasis: string | null;
  /** Date du cours au format YYYY-MM-DD. */
  priceUpdatedAt: string | null;
  isin?: string | null;
};

export type NamedRef = {
  id: string;
  name: string;
  /** Slot de la palette catégorielle : "chart-1" … "chart-8". */
  color: string | null;
  ceilingAmount?: string | null;
};

export type ValuedHolding = HoldingInput & {
  /** quantity × unitPrice, en euros. */
  value: string;
  /** Part du patrimoine total, en pourcentage (0–100). */
  weightPct: number;
  /** value − costBasis, ou null si le montant investi n'est pas renseigné. */
  gain: string | null;
  gainPct: number | null;
  /** Vrai si le cours dépasse le seuil de fraîcheur. */
  isStalePrice: boolean;
};

export type Breakdown = {
  id: string;
  name: string;
  color: string | null;
  value: string;
  weightPct: number;
  holdingCount: number;
};

export type PortfolioSummary = {
  totalValue: string;
  /** Somme des montants investis renseignés — partiel si certains manquent. */
  totalCostBasis: string;
  /** Nombre de lignes sans montant investi : rend la plus-value partielle. */
  holdingsWithoutCostBasis: number;
  totalGain: string;
  totalGainPct: number | null;
  holdings: ValuedHolding[];
  byAssetClass: Breakdown[];
  byEnvelope: Breakdown[];
  /** Date du cours le plus ancien, tous supports confondus. */
  oldestPriceDate: string | null;
  staleCount: number;
};
