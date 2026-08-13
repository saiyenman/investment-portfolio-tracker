/**
 * Formatage pour l'affichage.
 *
 * C'est le SEUL endroit où un montant redevient un `number` : `Intl` ne sait
 * pas consommer autre chose. La conversion intervient en toute fin de chaîne,
 * après que tous les calculs ont été faits en Decimal.
 */

const EUR = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const EUR_COMPACT = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

const PCT = new Intl.NumberFormat("fr-FR", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

const QTY = new Intl.NumberFormat("fr-FR", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 6,
});

const PLAIN = new Intl.NumberFormat("fr-FR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 4,
});

export function formatEuro(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  return EUR.format(Number(value));
}

export function formatEuroCompact(value: string | number): string {
  return EUR_COMPACT.format(Number(value));
}

/** Pourcentage déjà exprimé sur 100 (12.5 → « 12,5 % »). */
export function formatPct(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return `${PCT.format(value)} %`;
}

/** Écart en points de pourcentage, toujours signé. */
export function formatPoints(value: number): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${PCT.format(value)} pt`;
}

export function formatSignedEuro(value: string | number): string {
  const n = Number(value);
  return `${n > 0 ? "+" : ""}${EUR.format(n)}`;
}

export function formatQuantity(value: string | number): string {
  return QTY.format(Number(value));
}

/**
 * Nombre brut lisible, sans symbole monétaire — la devise ou le taux est dit à
 * côté. Rend la valeur telle quelle si elle n'est pas un nombre : mieux vaut
 * afficher « abc » qu'un « NaN » sur un écran de patrimoine.
 */
export function formatNumber(value: string | number): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value);
  return PLAIN.format(n);
}

/**
 * Prépare un NUMERIC pour un champ de saisie.
 *
 * Postgres renvoie `numeric(24,8)` sous la forme "10.00000000" : tel quel dans
 * un input, c'est illisible et pénible à corriger. On retire les zéros
 * inutiles et on passe à la virgule, cohérent avec le reste de l'interface —
 * `parseDecimalInput` accepte les deux séparateurs au retour.
 */
export function toDecimalInput(value: string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "";
  const trimmed = value.includes(".") ? value.replace(/\.?0+$/, "") : value;
  return (trimmed === "" ? "0" : trimmed).replace(".", ",");
}

/** Date ISO (YYYY-MM-DD) → « 07/08/2026 ». */
export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const [year, month, day] = value.slice(0, 10).split("-");
  return `${day}/${month}/${year}`;
}

/** Date du jour au format ISO, en heure locale (et non UTC). */
export function todayIso(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

/**
 * Slot de palette → variable CSS. Le thème clair et le thème sombre ont
 * chacun leur valeur, définies dans app/globals.css.
 */
export function colorVar(slot: string | null, fallbackIndex = 0): string {
  const safe = slot ?? `chart-${(fallbackIndex % 8) + 1}`;
  return `var(--${safe})`;
}

export const PALETTE_SLOTS = [
  "chart-1",
  "chart-2",
  "chart-3",
  "chart-4",
  "chart-5",
  "chart-6",
  "chart-7",
  "chart-8",
] as const;
