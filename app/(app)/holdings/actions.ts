"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  createHolding,
  deleteHolding,
  setHoldingActive,
  updateHolding,
  updateHoldingValue,
} from "@/lib/db/queries";
import { evaluateAmount } from "@/lib/expression";
import {
  BASE_CURRENCY,
  INPUT_CURRENCIES,
  convertAmount,
} from "@/lib/portfolio/quotes";
import { loadInputRates } from "@/lib/quotes/rates";
import {
  parseDecimalInput,
  parseIsoDate,
  parseOptionalText,
  parseQuoteSymbol,
} from "@/lib/parse";
import { actionFailure, actionSuccess, type ActionState } from "@/lib/action-state";
import { getCurrentUser } from "@/lib/supabase/server";



async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw new Error("Non authentifié.");
}

function revalidateEverything() {
  revalidatePath("/", "layout");
}

const holdingSchema = z.object({
  id: z.uuid().optional(),
  name: z
    .string()
    .trim()
    .min(1, "Le nom du support est obligatoire.")
    .max(120, "Le nom ne doit pas dépasser 120 caractères."),
  envelopeId: z.uuid("Enveloppe invalide."),
  assetClassId: z.uuid("Classe d'actifs invalide."),
  inputMode: z.enum(["QUANTITY", "AMOUNT"]),
  // Devise de saisie du montant investi, jamais stockée : elle ne sert qu'à
  // ramener le montant en euros. Validée ici pour qu'un POST direct portant un
  // code inconnu soit refusé avant tout appel réseau.
  costCurrency: z.enum(INPUT_CURRENCIES).default(BASE_CURRENCY),
});

export async function saveHolding(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireUser();

  const rawId = formData.get("id");
  const parsed = holdingSchema.safeParse({
    id: typeof rawId === "string" && rawId !== "" ? rawId : undefined,
    name: formData.get("name"),
    envelopeId: formData.get("envelopeId"),
    assetClassId: formData.get("assetClassId"),
    inputMode: formData.get("inputMode"),
    // `null` ne déclencherait pas le défaut zod, contrairement à `undefined`.
    costCurrency: formData.get("costCurrency") ?? undefined,
  });
  if (!parsed.success) {
    return actionFailure(parsed.error.issues[0]!.message);
  }

  const isAmountMode = parsed.data.inputMode === "AMOUNT";

  // En mode AMOUNT le champ « quantité » porte des euros et le prix est figé
  // à 1 : la formule valeur = quantité × prix reste vraie sans cas particulier.
  const quantity = parseDecimalInput(formData.get("quantity")) ?? "0";
  const unitPrice = isAmountMode
    ? "1"
    : parseDecimalInput(formData.get("unitPrice"));

  if (unitPrice === null) {
    return actionFailure("Le cours unitaire est invalide.");
  }
  if (!isAmountMode && Number(unitPrice) === 0 && Number(quantity) > 0) {
    return actionFailure(
      "Un cours à zéro avec une quantité non nulle donnerait une valeur nulle. " +
        "Renseignez le cours, ou passez la ligne en saisie par montant.",
    );
  }

  // Le montant investi accepte une expression — « 11x181,82 ». Le serveur
  // refait le calcul plutôt que de faire confiance à celui du navigateur :
  // cette action est joignable par un POST direct, sans passer par le
  // formulaire.
  const costBasis = evaluateAmount(formData.get("costBasis"));
  if (costBasis.error) {
    return actionFailure(`Montant investi : ${costBasis.error}`);
  }

  // Saisi en devise étrangère, le montant est converti puis stocké en euros :
  // la base est mono-devise, et la plus-value compare ce coût à une valeur
  // elle-même déjà convertie. Le serveur refait la conversion plutôt que de
  // faire confiance à l'aperçu du navigateur — même raison que pour le calcul.
  // Le taux sort du même cache, il est donc identique à celui affiché tant que
  // le quart d'heure n'a pas tourné.
  const { costCurrency } = parsed.data;
  let costBasisEur = costBasis.value;
  if (costBasisEur !== null && costCurrency !== BASE_CURRENCY) {
    const rates = await loadInputRates();
    const converted = convertAmount(
      costBasisEur,
      costCurrency,
      rates[costCurrency] ?? null,
    );
    if (converted.error !== null) {
      return actionFailure(
        `Le taux ${costCurrency} → ${BASE_CURRENCY} est indisponible pour l'instant. ` +
          "Réessayez, ou saisissez le montant investi en euros.",
      );
    }
    costBasisEur = converted.amount;
  }

  const payload = {
    name: parsed.data.name,
    isin: parseOptionalText(formData.get("isin"), 12),
    // Un symbole n'a de sens qu'en mode parts × cours : en mode montant le
    // cours vaut 1 par construction, et rien ne doit venir l'écraser.
    quoteSymbol: isAmountMode
      ? null
      : parseQuoteSymbol(formData.get("quoteSymbol")),
    envelopeId: parsed.data.envelopeId,
    assetClassId: parsed.data.assetClassId,
    inputMode: parsed.data.inputMode,
    quantity,
    unitPrice,
    priceUpdatedAt: parseIsoDate(formData.get("priceUpdatedAt")),
    costBasis: costBasisEur,
    note: parseOptionalText(formData.get("note")),
  };

  try {
    if (parsed.data.id) {
      await updateHolding(parsed.data.id, payload);
    } else {
      await createHolding(payload);
    }
  } catch (error) {
    if (isUniqueViolation(error)) {
      return actionFailure("Cette enveloppe contient déjà une ligne portant ce nom.");
    }
    throw error;
  }

  revalidateEverything();
  return actionSuccess();
}

/**
 * Mise à jour de la seule valeur d'une ligne, depuis le tableau de bord.
 * Le mode détermine la colonne écrite : cours en QUANTITY, montant en AMOUNT.
 */
export async function saveHoldingValue(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireUser();

  const id = formData.get("id");
  const inputMode = formData.get("inputMode") === "AMOUNT" ? "AMOUNT" : "QUANTITY";
  const value = parseDecimalInput(formData.get("value"));
  const priceUpdatedAt =
    parseIsoDate(formData.get("priceUpdatedAt")) ??
    new Date().toISOString().slice(0, 10);

  if (typeof id !== "string" || id === "") return actionFailure("Ligne introuvable.");
  if (value === null) return actionFailure("Valeur invalide.");

  await updateHoldingValue(id, inputMode, value, priceUpdatedAt);
  revalidateEverything();
  return actionSuccess();
}

export async function toggleHoldingActive(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireUser();

  const id = formData.get("id");
  if (typeof id !== "string" || id === "") return actionFailure("Ligne introuvable.");

  await setHoldingActive(id, formData.get("isActive") === "true");
  revalidateEverything();
  return actionSuccess();
}

/**
 * Suppression définitive — réservée aux lignes créées par erreur.
 * La désactivation reste la voie normale : elle préserve l'historique pour la
 * future courbe de performance.
 */
export async function removeHolding(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireUser();

  const id = formData.get("id");
  if (typeof id !== "string" || id === "") return actionFailure("Ligne introuvable.");

  await deleteHolding(id);
  revalidateEverything();
  return actionSuccess();
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "23505"
  );
}
