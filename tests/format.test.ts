import { describe, expect, it } from "vitest";

import { toDecimalInput } from "@/lib/format";
import { parseDecimalInput } from "@/lib/parse";

describe("préparation d'un NUMERIC pour la saisie", () => {
  it("retire les zéros de remplissage de Postgres", () => {
    // numeric(24,8) revient toujours avec ses huit décimales.
    expect(toDecimalInput("10.00000000")).toBe("10");
    expect(toDecimalInput("200.00000000")).toBe("200");
    expect(toDecimalInput("3000.00000000")).toBe("3000");
  });

  it("conserve les décimales significatives, en virgule", () => {
    expect(toDecimalInput("485.20000000")).toBe("485,2");
    expect(toDecimalInput("82.15000000")).toBe("82,15");
  });

  it("ne tronque pas un entier se terminant par zéro", () => {
    // Le piège : une regex trop gourmande transformerait "100" en "1".
    expect(toDecimalInput("100")).toBe("100");
    expect(toDecimalInput("1000")).toBe("1000");
    expect(toDecimalInput("22950.00")).toBe("22950");
  });

  it("gère le zéro et l'absence de valeur", () => {
    expect(toDecimalInput("0.00000000")).toBe("0");
    expect(toDecimalInput(null)).toBe("");
    expect(toDecimalInput("")).toBe("");
  });

  it("fait un aller-retour sans perte avec la lecture de saisie", () => {
    // Ce que l'on affiche doit être relisible tel quel : sinon rouvrir une
    // ligne et enregistrer sans rien changer altérerait la valeur.
    for (const stored of ["10.00000000", "485.20000000", "0.00000000", "3000.00000000"]) {
      const shown = toDecimalInput(stored);
      expect(Number(parseDecimalInput(shown))).toBe(Number(stored));
    }
  });
});
