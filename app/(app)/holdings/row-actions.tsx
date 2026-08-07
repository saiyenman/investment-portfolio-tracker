"use client";

import { Trash2Icon } from "lucide-react";
import { useActionState, useEffect, useRef, useState } from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { IDLE } from "@/lib/action-state";
import { notify } from "@/lib/notify";

import { removeHolding, toggleHoldingActive } from "./actions";

/** Notifie une seule fois par résultat, grâce à l'horodatage de l'état. */
function useActionToast(
  state: { error: string | null; ok: boolean; at: number },
  successMessage: string,
) {
  const handledAt = useRef(0);
  useEffect(() => {
    if (state.at === handledAt.current) return;
    handledAt.current = state.at;
    if (state.error) notify.error(state.error);
    else if (state.ok) notify.success(successMessage);
  }, [state, successMessage]);
}

export function ToggleHolding({
  id,
  isActive,
}: {
  id: string;
  isActive: boolean;
}) {
  const [state, formAction, pending] = useActionState(toggleHoldingActive, IDLE);
  useActionToast(state, isActive ? "Ligne désactivée." : "Ligne réactivée.");

  return (
    <form action={formAction}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="isActive" value={String(!isActive)} />
      <Button type="submit" variant="ghost" size="sm" disabled={pending}>
        {pending ? <Spinner data-icon="inline-start" /> : null}
        {isActive ? "Désactiver" : "Réactiver"}
      </Button>
    </form>
  );
}

export function DeleteHolding({ id, name }: { id: string; name: string }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(removeHolding, IDLE);
  useActionToast(state, "Ligne supprimée.");

  // Contrôlé, comme les autres boîtes de dialogue : en non contrôlé, la
  // confirmation resterait ouverte après la suppression, au-dessus d'une ligne
  // qui n'existe plus.
  const handledAt = useRef(0);
  useEffect(() => {
    if (state.ok && state.at !== handledAt.current) {
      handledAt.current = state.at;
      setOpen(false);
    }
  }, [state]);

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger
        render={<Button variant="ghost" size="sm" aria-label={`Supprimer ${name}`} />}
      >
        <Trash2Icon className="text-destructive" />
      </AlertDialogTrigger>

      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Supprimer « {name} » ?</AlertDialogTitle>
          <AlertDialogDescription>
            La suppression est définitive. Pour retirer simplement la ligne du
            tableau de bord tout en gardant sa trace, préférez « Désactiver ».
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Annuler</AlertDialogCancel>
          <form action={formAction}>
            <input type="hidden" name="id" value={id} />
            <AlertDialogAction
              render={
                <Button type="submit" variant="destructive" disabled={pending} />
              }
            >
              {pending ? <Spinner data-icon="inline-start" /> : null}
              Supprimer définitivement
            </AlertDialogAction>
          </form>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
