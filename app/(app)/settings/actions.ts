"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  countActiveHoldings,
  createAssetClass,
  createEnvelope,
  setAssetClassActive,
  setEnvelopeActive,
  updateAssetClass,
  updateEnvelope,
} from "@/lib/db/queries";
import { actionFailure, actionSuccess, type ActionState } from "@/lib/action-state";
import { getCurrentUser } from "@/lib/supabase/server";




/**
 * Les Server Actions sont joignables par une requête POST directe, pas
 * seulement via l'interface : chacune vérifie donc l'authentification.
 */
async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw new Error("Non authentifié.");
}

/** Une modification de nomenclature change tous les écrans, pas seulement /settings. */
function revalidateEverything() {
  revalidatePath("/", "layout");
}

const nameSchema = z
  .string()
  .trim()
  .min(1, "Le nom est obligatoire.")
  .max(80, "Le nom ne doit pas dépasser 80 caractères.");

const colorSchema = z
  .string()
  .regex(/^chart-[1-8]$/, "Couleur invalide.")
  .nullable();

/** "" → null ; « 22 950,50 » → "22950.50". */
function parseAmount(raw: FormDataEntryValue | null): string | null {
  if (typeof raw !== "string") return null;
  const cleaned = raw.trim().replace(/\s/g, "").replace(",", ".");
  if (cleaned === "") return null;
  const value = Number(cleaned);
  if (!Number.isFinite(value) || value < 0) return null;
  return cleaned;
}

const envelopeSchema = z.object({
  id: z.uuid().optional(),
  name: nameSchema,
  color: colorSchema,
});

export async function saveEnvelope(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireUser();

  const rawId = formData.get("id");
  const parsed = envelopeSchema.safeParse({
    id: typeof rawId === "string" && rawId !== "" ? rawId : undefined,
    name: formData.get("name"),
    color: formData.get("color") || null,
  });
  if (!parsed.success) {
    return actionFailure(parsed.error.issues[0]!.message);
  }

  const payload = {
    name: parsed.data.name,
    color: parsed.data.color,
    ceilingAmount: parseAmount(formData.get("ceilingAmount")),
  };

  try {
    if (parsed.data.id) {
      await updateEnvelope(parsed.data.id, payload);
    } else {
      await createEnvelope(payload);
    }
  } catch (error) {
    if (isUniqueViolation(error)) {
      return actionFailure("Une enveloppe porte déjà ce nom.");
    }
    throw error;
  }

  revalidateEverything();
  return actionSuccess();
}

const assetClassSchema = z.object({
  id: z.uuid().optional(),
  name: nameSchema,
  color: colorSchema,
});

export async function saveAssetClass(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireUser();

  const rawId = formData.get("id");
  const parsed = assetClassSchema.safeParse({
    id: typeof rawId === "string" && rawId !== "" ? rawId : undefined,
    name: formData.get("name"),
    color: formData.get("color") || null,
  });
  if (!parsed.success) {
    return actionFailure(parsed.error.issues[0]!.message);
  }

  const payload = { name: parsed.data.name, color: parsed.data.color };

  try {
    if (parsed.data.id) {
      await updateAssetClass(parsed.data.id, payload);
    } else {
      await createAssetClass(payload);
    }
  } catch (error) {
    if (isUniqueViolation(error)) {
      return actionFailure("Une classe d'actifs porte déjà ce nom.");
    }
    throw error;
  }

  revalidateEverything();
  return actionSuccess();
}

/**
 * Désactivation refusée tant que des lignes actives s'y rattachent.
 *
 * Sans ce garde-fou, désactiver « Actions » ferait disparaître les ETF du
 * tableau de bord sans que le total ne le signale : le patrimoine semblerait
 * avoir fondu.
 */
export async function toggleActive(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireUser();

  const scope = formData.get("scope");
  const id = formData.get("id");
  const nextActive = formData.get("isActive") === "true";

  if (typeof id !== "string" || (scope !== "envelope" && scope !== "assetClass")) {
    return actionFailure("Requête invalide.");
  }

  if (!nextActive) {
    const used = await countActiveHoldings(scope, id);
    if (used > 0) {
      const what = scope === "envelope" ? "cette enveloppe" : "cette classe";
      const plural = used > 1;
      return actionFailure(
        `Impossible de désactiver ${what} : ${used} ligne${plural ? "s" : ""} ` +
          `active${plural ? "s" : ""} y ${plural ? "sont" : "est"} ` +
          `rattachée${plural ? "s" : ""}. Réaffectez-les ou désactivez-les d'abord.`,
      );
    }
  }

  if (scope === "envelope") {
    await setEnvelopeActive(id, nextActive);
  } else {
    await setAssetClassActive(id, nextActive);
  }

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
