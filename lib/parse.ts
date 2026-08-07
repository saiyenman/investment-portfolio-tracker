/**
 * Lecture des nombres saisis au clavier.
 *
 * On reste en `string` de bout en bout : passer par `Number` ici réintroduirait
 * l'imprécision flottante que tout le moteur s'applique à éviter. La chaîne
 * retournée est directement consommable par Postgres (NUMERIC) et Decimal.
 */

/** Espaces fines et insécables : le clavier français en produit sans prévenir. */
const SPACES = /[\s  ]/g;

/**
 * « 1 234,56 » → "1234.56". Retourne null si vide ou mal formé.
 * N'accepte que des valeurs positives ou nulles : ni quantité, ni prix, ni
 * montant investi n'a de sens en négatif dans ce modèle.
 */
export function parseDecimalInput(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const cleaned = raw.trim().replace(SPACES, "").replace(",", ".");
  if (cleaned === "") return null;
  if (!/^\d+(\.\d+)?$/.test(cleaned)) return null;
  return cleaned;
}

/** Champ texte optionnel : chaîne vide → null, pour ne pas stocker "". */
export function parseOptionalText(raw: unknown, maxLength = 500): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  return trimmed.slice(0, maxLength);
}

/** Date ISO stricte (YYYY-MM-DD), telle que produite par <input type="date">. */
export function parseIsoDate(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null;
  return trimmed;
}
