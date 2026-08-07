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
import { parseDecimalInput, parseIsoDate, parseOptionalText } from "@/lib/parse";
import { getCurrentUser } from "@/lib/supabase/server";

export type ActionState = { error: string | null; ok: boolean; at: number };
export const IDLE: ActionState = { error: null, ok: false, at: 0 };

const success = (): ActionState => ({ error: null, ok: true, at: Date.now() });
const failure = (error: string): ActionState => ({
  error,
  ok: false,
  at: Date.now(),
});

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
  });
  if (!parsed.success) {
    return failure(parsed.error.issues[0]!.message);
  }

  const isAmountMode = parsed.data.inputMode === "AMOUNT";

  // En mode AMOUNT le champ « quantité » porte des euros et le prix est figé
  // à 1 : la formule valeur = quantité × prix reste vraie sans cas particulier.
  const quantity = parseDecimalInput(formData.get("quantity")) ?? "0";
  const unitPrice = isAmountMode
    ? "1"
    : parseDecimalInput(formData.get("unitPrice"));

  if (unitPrice === null) {
    return failure("Le cours unitaire est invalide.");
  }
  if (!isAmountMode && Number(unitPrice) === 0 && Number(quantity) > 0) {
    return failure(
      "Un cours à zéro avec une quantité non nulle donnerait une valeur nulle. " +
        "Renseignez le cours, ou passez la ligne en saisie par montant.",
    );
  }

  const payload = {
    name: parsed.data.name,
    isin: parseOptionalText(formData.get("isin"), 12),
    envelopeId: parsed.data.envelopeId,
    assetClassId: parsed.data.assetClassId,
    inputMode: parsed.data.inputMode,
    quantity,
    unitPrice,
    priceUpdatedAt: parseIsoDate(formData.get("priceUpdatedAt")),
    costBasis: parseDecimalInput(formData.get("costBasis")),
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
      return failure("Cette enveloppe contient déjà une ligne portant ce nom.");
    }
    throw error;
  }

  revalidateEverything();
  return success();
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

  if (typeof id !== "string" || id === "") return failure("Ligne introuvable.");
  if (value === null) return failure("Valeur invalide.");

  await updateHoldingValue(id, inputMode, value, priceUpdatedAt);
  revalidateEverything();
  return success();
}

export async function toggleHoldingActive(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireUser();

  const id = formData.get("id");
  if (typeof id !== "string" || id === "") return failure("Ligne introuvable.");

  await setHoldingActive(id, formData.get("isActive") === "true");
  revalidateEverything();
  return success();
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
  if (typeof id !== "string" || id === "") return failure("Ligne introuvable.");

  await deleteHolding(id);
  revalidateEverything();
  return success();
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "23505"
  );
}
