/**
 * Tri des tableaux, porté par l'URL.
 *
 * Le tri vit dans les paramètres de requête plutôt que dans un état React :
 * les deux écrans concernés sont rendus côté serveur, et l'enregistrement
 * d'un cours y déclenche une revalidation. Un état client devrait survivre à
 * ce cycle ; un paramètre d'URL n'a rien à survivre. Il se partage et se met
 * en favori par-dessus le marché.
 *
 * Fonctions pures, testables sans navigateur.
 */

export type SortDirection = "asc" | "desc";

/** Ce sur quoi on trie réellement : jamais la chaîne affichée. */
export type SortableValue = string | number | null | undefined;

export type SortState<K extends string> = {
  key: K | null;
  direction: SortDirection;
};

/**
 * Comparateur en langue française.
 *
 * `numeric` fait passer « Ligne 9 » avant « Ligne 10 », que l'ordre
 * lexicographique inverserait. `sensitivity: "base"` ignore accents et casse,
 * sans quoi « Épargne » se retrouverait après « Zurich ».
 */
const collator = new Intl.Collator("fr", { numeric: true, sensitivity: "base" });

/** Comparaison de deux valeurs présentes. Les absentes sont traitées avant. */
function compare(a: string | number, b: string | number): number {
  if (typeof a === "number" && typeof b === "number") {
    return a === b ? 0 : a < b ? -1 : 1;
  }
  return collator.compare(String(a), String(b));
}

function isMissing(value: SortableValue): value is null | undefined | "" {
  return value === null || value === undefined || value === "";
}

/**
 * Trie une copie, en conservant l'ordre d'origine à valeur égale.
 *
 * Le tri de JavaScript est stable : deux lignes de même valeur gardent donc
 * l'ordre défini en base, ce qui évite qu'elles ne permutent d'un affichage à
 * l'autre sans raison visible.
 */
export function sortRows<T>(
  rows: T[],
  accessor: (row: T) => SortableValue,
  direction: SortDirection,
): T[] {
  const factor = direction === "desc" ? -1 : 1;
  return [...rows].sort((a, b) => {
    const av = accessor(a);
    const bv = accessor(b);

    // Les absents sont écartés AVANT la multiplication par le sens : une ligne
    // sans plus-value renseignée doit rester en fin de liste dans les deux
    // sens, et non remonter en tête dès qu'on demande l'ordre décroissant.
    const aMissing = isMissing(av);
    const bMissing = isMissing(bv);
    if (aMissing && bMissing) return 0;
    if (aMissing) return 1;
    if (bMissing) return -1;

    return compare(av, bv) * factor;
  });
}

/**
 * Lit l'état de tri depuis les paramètres d'URL.
 *
 * Une clé inconnue est ignorée plutôt que refusée : un lien tapé à la main ou
 * devenu obsolète doit rendre la page dans son ordre par défaut, pas une
 * erreur.
 */
export function parseSort<K extends string>(
  searchParams: Record<string, string | string[] | undefined>,
  allowed: readonly K[],
): SortState<K> {
  const rawKey = first(searchParams.tri);
  const rawDirection = first(searchParams.sens);

  const key = allowed.includes(rawKey as K) ? (rawKey as K) : null;
  const direction: SortDirection = rawDirection === "asc" ? "asc" : "desc";

  return { key, direction };
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Lien d'en-tête de colonne.
 *
 * Un premier clic trie dans le sens le plus utile pour la colonne — décroissant
 * pour des montants, où l'on cherche les plus grosses lignes ; croissant pour
 * du texte, où l'on cherche l'ordre alphabétique. Un second clic inverse.
 */
export function sortHref<K extends string>(
  basePath: string,
  key: K,
  naturalDirection: SortDirection,
  current: SortState<K>,
): string {
  const direction =
    current.key === key
      ? current.direction === "asc"
        ? "desc"
        : "asc"
      : naturalDirection;
  return `${basePath}?tri=${encodeURIComponent(key)}&sens=${direction}`;
}

/** Valeur de `aria-sort` attendue par les lecteurs d'écran sur un `<th>`. */
export function ariaSort<K extends string>(
  key: K,
  current: SortState<K>,
): "ascending" | "descending" | "none" {
  if (current.key !== key) return "none";
  return current.direction === "asc" ? "ascending" : "descending";
}
