import Decimal from "decimal.js";

/**
 * Évaluation d'une petite expression arithmétique saisie au clavier.
 *
 * On connaît rarement un montant investi directement : on connaît des parts et
 * un prix d'achat. Taper « 10x12,2 » évite la calculatrice, l'arrondi de tête
 * et la recopie.
 *
 * Deux règles non négociables.
 *
 * Pas d'`eval` ni de `new Function`. La chaîne saisie part telle quelle vers
 * une Server Action, joignable par un simple POST : l'évaluer comme du
 * JavaScript serait de l'exécution de code arbitraire côté serveur, sans même
 * passer par l'interface. D'où cet analyseur écrit à la main, qui ne reconnaît
 * que des nombres, quatre opérateurs et des parenthèses.
 *
 * Pas de flottant. « 0.1 + 0.2 » vaut 0,30000000000000004 en arithmétique
 * IEEE 754 ; tout le projet passe par Decimal pour cette raison, et un champ
 * monétaire n'allait pas faire exception.
 */

export type AmountResult =
  | { value: string; error: null }
  | { value: null; error: string | null };

/**
 * Multiplication : « x » et « × » sont ce qu'on écrit naturellement, et la
 * majuscule arrive dès qu'on tape vite ou depuis un téléphone.
 */
const MULTIPLY = /[xX×*]/;
const DIGIT = /[0-9]/;

/**
 * Tous les espaces, y compris les fines et insécables que le clavier français
 * produit en séparateur de milliers : `\s` couvre la catégorie Unicode Zs,
 * donc U+00A0 et U+202F entre autres. Les retirer d'emblée fait fonctionner
 * « 1 000 x 2 » exactement comme « 1000x2 ».
 *
 * Contrepartie assumée : « 10 12 » vaut donc 1012 et non une erreur. On ne
 * peut pas accepter l'espace comme séparateur de milliers et le refuser entre
 * deux nombres — c'est la même chaîne de caractères.
 */
const SPACES = /\s/g;

type Token =
  | { kind: "number"; value: Decimal }
  | { kind: "op"; value: "+" | "-" | "*" | "/" }
  | { kind: "paren"; value: "(" | ")" };

class SyntaxError_ extends Error {}

function fail(message: string): never {
  throw new SyntaxError_(message);
}

/**
 * Découpe la chaîne en jetons.
 *
 * Les espaces sont retirés en amont, ce qui fait fonctionner « 1 000 x 2 »
 * comme « 1000x2 » : le clavier français produit des espaces fines et
 * insécables en séparateur de milliers sans prévenir.
 */
function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < input.length) {
    const char = input[i]!;

    if (DIGIT.test(char) || char === "." || char === ",") {
      let raw = "";
      let seenSeparator = false;
      while (i < input.length) {
        const c = input[i]!;
        if (DIGIT.test(c)) {
          raw += c;
        } else if (c === "." || c === ",") {
          // « 10..2 » ou « 1,2,3 » : deux séparateurs dans un même nombre.
          if (seenSeparator) fail("Nombre mal formé.");
          seenSeparator = true;
          raw += ".";
        } else {
          break;
        }
        i += 1;
      }
      if (raw === "." || raw === "") fail("Nombre mal formé.");
      tokens.push({ kind: "number", value: new Decimal(raw) });
      continue;
    }

    if (char === "+" || char === "-") {
      tokens.push({ kind: "op", value: char });
    } else if (MULTIPLY.test(char)) {
      tokens.push({ kind: "op", value: "*" });
    } else if (char === "/" || char === "÷") {
      tokens.push({ kind: "op", value: "/" });
    } else if (char === "(" || char === ")") {
      tokens.push({ kind: "paren", value: char });
    } else {
      fail(`Caractère non reconnu : « ${char} ».`);
    }
    i += 1;
  }

  return tokens;
}

/**
 * Descente récursive sur `expression → terme → facteur`.
 *
 * La priorité des opérateurs sort de la structure des trois fonctions, sans
 * table ni pile : une multiplication est consommée par `terme`, donc avant que
 * `expression` ne voie l'addition qui l'entoure.
 */
class Parser {
  private position = 0;

  constructor(private readonly tokens: Token[]) {}

  parse(): Decimal {
    const value = this.expression();
    if (this.position < this.tokens.length) fail("Expression incomplète.");
    return value;
  }

  private peek(): Token | undefined {
    return this.tokens[this.position];
  }

  private expression(): Decimal {
    let left = this.term();
    for (;;) {
      const token = this.peek();
      if (token?.kind !== "op" || (token.value !== "+" && token.value !== "-")) {
        return left;
      }
      this.position += 1;
      const right = this.term();
      left = token.value === "+" ? left.plus(right) : left.minus(right);
    }
  }

  private term(): Decimal {
    let left = this.factor();
    for (;;) {
      const token = this.peek();
      if (token?.kind !== "op" || (token.value !== "*" && token.value !== "/")) {
        return left;
      }
      this.position += 1;
      const right = this.factor();
      if (token.value === "/") {
        if (right.isZero()) fail("Division par zéro.");
        left = left.dividedBy(right);
      } else {
        left = left.times(right);
      }
    }
  }

  private factor(): Decimal {
    const token = this.peek();
    if (token === undefined) fail("Expression incomplète.");

    // Signe unaire : « -5 » se parse, et se fait refuser plus loin sur le
    // résultat négatif — le message y est bien plus clair qu'ici.
    if (token.kind === "op" && (token.value === "+" || token.value === "-")) {
      this.position += 1;
      const value = this.factor();
      return token.value === "-" ? value.negated() : value;
    }

    if (token.kind === "number") {
      this.position += 1;
      return token.value;
    }

    if (token.kind === "paren" && token.value === "(") {
      this.position += 1;
      const value = this.expression();
      const closing = this.peek();
      if (closing?.kind !== "paren" || closing.value !== ")") {
        fail("Parenthèse non fermée.");
      }
      this.position += 1;
      return value;
    }

    fail("Expression incomplète.");
  }
}

/**
 * Évalue un montant en euros.
 *
 * Chaîne vide → valeur nulle SANS erreur : le champ est facultatif, et un
 * champ vidé volontairement ne doit pas bloquer l'enregistrement.
 */
export function evaluateAmount(raw: unknown): AmountResult {
  if (typeof raw !== "string") return { value: null, error: null };

  const cleaned = raw.replace(SPACES, "");
  if (cleaned === "") return { value: null, error: null };

  let result: Decimal;
  try {
    result = new Parser(tokenize(cleaned)).parse();
  } catch (error) {
    if (error instanceof SyntaxError_) return { value: null, error: error.message };
    throw error;
  }

  if (!result.isFinite()) return { value: null, error: "Résultat non calculable." };
  if (result.isNegative()) {
    return { value: null, error: "Un montant investi ne peut pas être négatif." };
  }

  // Arrondi à deux décimales : la colonne est numeric(18,2). Sans cela
  // « 100/3 » afficherait 33,333333… en aperçu là où la base stockerait 33,33.
  return { value: result.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2), error: null };
}
