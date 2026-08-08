"use client";

import { CheckIcon } from "lucide-react";
import { useActionState, useEffect, useRef } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { todayIso } from "@/lib/format";
import { IDLE } from "@/lib/action-state";
import { notify } from "@/lib/notify";

import { saveHoldingValue } from "./holdings/actions";

/**
 * Mise à jour de la valeur d'une ligne directement depuis le tableau de bord.
 *
 * Rafraîchir six valeurs ne doit pas obliger à ouvrir six fois la boîte de
 * dialogue d'édition complète. `inputMode` est transmis pour que l'action
 * écrive dans la bonne colonne : le cours en mode parts, le montant en mode
 * euros.
 */
export function QuickPriceForm({
  id,
  inputMode,
  label,
  defaultValue,
}: {
  id: string;
  inputMode: "QUANTITY" | "AMOUNT";
  label: string;
  defaultValue: string;
}) {
  const [state, formAction, pending] = useActionState(saveHoldingValue, IDLE);
  const handledAt = useRef(0);

  useEffect(() => {
    if (state.at === handledAt.current) return;
    handledAt.current = state.at;
    if (state.error) notify.error(state.error);
    else if (state.ok) notify.success("Valeur mise à jour.");
  }, [state]);

  return (
    <form action={formAction} className="flex items-center justify-end gap-1">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="inputMode" value={inputMode} />
      <input type="hidden" name="priceUpdatedAt" value={todayIso()} />
      {/*
        Même raison que dans les boîtes de dialogue : après l'enregistrement, la
        page est revalidée et la valeur persistée redescend normalisée
        (« 485,20 » saisi devient « 485,2 »), alors que ce champ non contrôlé
        reste monté. La clé le remonte sur la valeur réellement en base, ce qui
        évite l'avertissement et montre au passage ce qui a été enregistré. En
        cas d'échec, `defaultValue` ne bouge pas : la saisie est conservée.
      */}
      <Input
        key={defaultValue}
        name="value"
        defaultValue={defaultValue}
        inputMode="decimal"
        aria-label={label}
        className="h-8 w-24 text-right tabular-nums"
      />
      <Button
        type="submit"
        variant="ghost"
        size="sm"
        disabled={pending}
        aria-label="Enregistrer la valeur"
      >
        {pending ? <Spinner /> : <CheckIcon />}
      </Button>
    </form>
  );
}
