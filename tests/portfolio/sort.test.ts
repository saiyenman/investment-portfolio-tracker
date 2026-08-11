import { describe, expect, it } from "vitest";

import { ariaSort, parseSort, sortHref, sortRows } from "@/lib/sort";

type Row = { name: string; value: number | null };

const ROWS: Row[] = [
  { name: "BNP Paribas Easy S&P 500", value: 17816 },
  { name: "Amundi Physical Gold", value: 292.64 },
  { name: "Compte Courant", value: null },
  { name: "AMUNDI PEA MONDE", value: 6240 },
];

const byValue = (r: Row) => r.value;

describe("tri numérique", () => {
  it("range les montants par valeur, pas par texte", () => {
    // « 17 816 » commence par 1 et « 6 240 » par 6 : une comparaison de
    // chaînes les inverserait.
    const sorted = sortRows(ROWS, byValue, "desc").map((r) => r.value);
    expect(sorted).toEqual([17816, 6240, 292.64, null]);
  });

  it("inverse le sens sans déplacer les valeurs absentes", () => {
    // Le point décisif : une ligne sans valeur ne doit pas remonter en tête
    // parce qu'on a demandé l'ordre croissant.
    const sorted = sortRows(ROWS, byValue, "asc").map((r) => r.value);
    expect(sorted).toEqual([292.64, 6240, 17816, null]);
  });
});

describe("tri textuel", () => {
  it("ignore la casse et les accents", () => {
    const rows = [{ name: "Zurich" }, { name: "Épargne" }, { name: "action" }];
    const sorted = sortRows(rows, (r) => r.name, "asc").map((r) => r.name);
    expect(sorted).toEqual(["action", "Épargne", "Zurich"]);
  });

  it("compare les nombres inclus dans le texte comme des nombres", () => {
    const rows = [{ name: "Ligne 10" }, { name: "Ligne 9" }];
    const sorted = sortRows(rows, (r) => r.name, "asc").map((r) => r.name);
    expect(sorted).toEqual(["Ligne 9", "Ligne 10"]);
  });
});

describe("stabilité", () => {
  it("conserve l'ordre d'origine à valeur égale", () => {
    const rows = [
      { name: "premier", value: 10 },
      { name: "deuxième", value: 10 },
      { name: "troisième", value: 10 },
    ];
    const sorted = sortRows(rows, byValue, "desc").map((r) => r.name);
    expect(sorted).toEqual(["premier", "deuxième", "troisième"]);
  });

  it("ne modifie pas le tableau reçu", () => {
    const original = [...ROWS];
    sortRows(ROWS, byValue, "asc");
    expect(ROWS).toEqual(original);
  });
});

describe("lecture des paramètres d'URL", () => {
  const KEYS = ["support", "valeur"] as const;

  it("retient une clé connue et son sens", () => {
    expect(parseSort({ tri: "valeur", sens: "asc" }, KEYS)).toEqual({
      key: "valeur",
      direction: "asc",
    });
  });

  it("ignore une clé inconnue plutôt que d'échouer", () => {
    // Un lien tapé à la main ou devenu obsolète doit rendre la page dans son
    // ordre par défaut, pas une erreur.
    expect(parseSort({ tri: "colonne-supprimée" }, KEYS).key).toBeNull();
  });

  it("retombe sur décroissant quand le sens est absent ou farfelu", () => {
    expect(parseSort({ tri: "valeur" }, KEYS).direction).toBe("desc");
    expect(parseSort({ tri: "valeur", sens: "n'importe quoi" }, KEYS).direction).toBe(
      "desc",
    );
  });

  it("ne retient que la première occurrence d'un paramètre répété", () => {
    expect(parseSort({ tri: ["valeur", "support"] }, KEYS).key).toBe("valeur");
  });
});

describe("lien d'en-tête", () => {
  const state = { key: "valeur" as const, direction: "desc" as const };

  it("inverse le sens sur la colonne déjà active", () => {
    expect(sortHref("/", "valeur", "desc", state)).toBe("/?tri=valeur&sens=asc");
  });

  it("applique le sens naturel sur une autre colonne", () => {
    // Premier clic : décroissant sur un montant, croissant sur du texte.
    expect(sortHref("/", "support", "asc", state)).toBe(
      "/?tri=support&sens=asc",
    );
  });

  it("annonce l'état courant aux lecteurs d'écran", () => {
    expect(ariaSort("valeur", state)).toBe("descending");
    expect(ariaSort("support", state)).toBe("none");
  });
});
