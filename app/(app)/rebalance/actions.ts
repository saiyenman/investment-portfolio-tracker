"use server";

import Decimal from "decimal.js";
import { revalidatePath } from "next/cache";

import { listAssetClasses, replaceTargets } from "@/lib/db/queries";
import { parseDecimalInput } from "@/lib/parse";
import { getCurrentUser } from "@/lib/supabase/server";

export type ActionState = { error: string | null; ok: boolean; at: number };
export const IDLE: ActionState = { error: null, ok: false, at: 0 };

const success = (): ActionState => ({ error: null, ok: true, at: Date.now() });
const failure = (error: string): ActionState => ({
  error,
  ok: false,
  at: Date.now(),
});

/**
 * Enregistre l'allocation cible.
 *
 * Une allocation est un tout : elle doit totaliser 100 %. Accepter 90 %
 * produirait des propositions de versement systématiquement sous-dimensionnées,
 * sans que rien ne le signale.
 */
export async function saveTargets(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) throw new Error("Non authentifié.");

  const assetClasses = await listAssetClasses();
  const entries: { assetClassId: string; targetPct: string }[] = [];
  let total = new Decimal(0);

  for (const assetClass of assetClasses) {
    const raw = formData.get(`target-${assetClass.id}`);
    const parsed = parseDecimalInput(raw);
    if (parsed === null) continue;

    const pct = new Decimal(parsed);
    if (pct.greaterThan(100)) {
      return failure(`« ${assetClass.name} » dépasse 100 %.`);
    }
    total = total.plus(pct);
    // Les classes à 0 ne sont pas stockées : une cible nulle et une absence de
    // cible se comportent de la même façon.
    if (pct.greaterThan(0)) {
      entries.push({
        assetClassId: assetClass.id,
        targetPct: pct.toFixed(3),
      });
    }
  }

  if (entries.length > 0 && !total.toDecimalPlaces(2).equals(100)) {
    return failure(
      `La somme des cibles fait ${total.toDecimalPlaces(2).toString()} % au lieu de 100 %.`,
    );
  }

  await replaceTargets(entries);
  revalidatePath("/", "layout");
  return success();
}
