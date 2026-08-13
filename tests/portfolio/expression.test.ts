import { describe, expect, it } from "vitest";

import { evaluateAmount } from "@/lib/expression";

/** Raccourci de lecture : la valeur, ou le message d'erreur. */
const value = (raw: string) => evaluateAmount(raw).value;
const error = (raw: string) => evaluateAmount(raw).error;

describe("multiplication", () => {
  it("accepte la notation demandée", () => {
    expect(value("10x12.2")).toBe("122.00");
  });

  it.each(["10*12.2", "10 × 12,2", "10 X 12.2", "10x12,2"])(
    "accepte la variante %s",
    (raw) => {
      expect(value(raw)).toBe("122.00");
    },
  );
});

describe("non-régression du champ actuel", () => {
  it("laisse passer un nombre seul", () => {
    expect(value("5100")).toBe("5100.00");
  });

  it("accepte les séparateurs du clavier français", () => {
    // Espace insécable en séparateur de milliers, virgule décimale.
    expect(value("1 234,56")).toBe("1234.56");
    expect(value("1 234,56")).toBe("1234.56");
    expect(value("1 234,56")).toBe("1234.56");
  });

  it("traite un champ vide comme une absence, pas comme une erreur", () => {
    // Le montant investi est facultatif : vider le champ doit pouvoir
    // s'enregistrer, pas bloquer le formulaire.
    expect(evaluateAmount("")).toEqual({ value: null, error: null });
    expect(evaluateAmount("   ")).toEqual({ value: null, error: null });
  });
});

describe("priorité des opérateurs", () => {
  it("multiplie avant d'additionner", () => {
    // 221 serait le résultat d'une évaluation de gauche à droite.
    expect(value("10x12.2+50")).toBe("172.00");
  });

  it("divise avant de soustraire", () => {
    expect(value("100-60/2")).toBe("70.00");
  });

  it("respecte les parenthèses", () => {
    expect(value("(10+2)x5")).toBe("60.00");
    expect(value("100/(2x5)")).toBe("10.00");
  });
});

describe("exactitude décimale", () => {
  it("ne réintroduit pas l'imprécision flottante", () => {
    // 0.1 + 0.2 vaut 0.30000000000000004 en IEEE 754.
    expect(value("0.1+0.2")).toBe("0.30");
  });

  it("reste exact sur une somme de prix d'achat", () => {
    expect(value("11x181.82")).toBe("2000.02");
  });

  it("arrondit au centime, comme la colonne en base", () => {
    // numeric(18,2) : afficher 33,333333… puis stocker 33,33 mentirait.
    expect(value("100/3")).toBe("33.33");
    expect(value("100/8")).toBe("12.50");
  });
});

describe("refus motivés", () => {
  it("refuse la division par zéro", () => {
    expect(error("10/0")).toMatch(/zéro/i);
  });

  it("refuse un résultat négatif", () => {
    // Un montant investi négatif n'a pas de sens dans ce modèle.
    expect(error("5-10")).toMatch(/négatif/i);
  });

  it.each(["10x", "10+", "abc", "10..2", "1,2,3", "()", "(10+2", "10€"])(
    "refuse « %s »",
    (raw) => {
      const result = evaluateAmount(raw);
      expect(result.value).toBeNull();
      expect(result.error).toBeTruthy();
    },
  );

  it("accepte « 10 12 » comme 1012, contrepartie du séparateur de milliers", () => {
    // Comportement délibéré et non un oubli : accepter l'espace dans
    // « 1 234,56 » et le refuser dans « 10 12 » est impossible, c'est la même
    // chaîne de caractères une fois lue.
    expect(value("10 12")).toBe("1012.00");
  });
});

describe("aucune exécution de code", () => {
  // La chaîne saisie part telle quelle vers une Server Action joignable par un
  // simple POST : l'évaluer comme du JavaScript serait une faille.
  it.each([
    "1;alert(1)",
    "process.exit(0)",
    "require('fs')",
    "constructor.constructor('return 1')()",
    "[].map(x=>x)",
  ])("refuse « %s » comme n'importe quelle syntaxe invalide", (raw) => {
    const result = evaluateAmount(raw);
    expect(result.value).toBeNull();
    expect(result.error).toBeTruthy();
  });
});

describe("entrées non textuelles", () => {
  it("traite une valeur absente comme un champ vide", () => {
    expect(evaluateAmount(null)).toEqual({ value: null, error: null });
    expect(evaluateAmount(undefined)).toEqual({ value: null, error: null });
  });
});
