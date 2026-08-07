"use client";

import { useActionState, useEffect, useRef } from "react";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { IDLE } from "@/lib/action-state";
import { notify } from "@/lib/notify";

import { toggleActive } from "./actions";

/**
 * Activation / désactivation logique.
 *
 * L'action peut refuser (classe encore utilisée) : le refus arrive en toast,
 * avec sa raison, plutôt qu'en erreur silencieuse.
 */
export function ToggleActive({
  scope,
  id,
  isActive,
}: {
  scope: "envelope" | "assetClass";
  id: string;
  isActive: boolean;
}) {
  const [state, formAction, pending] = useActionState(toggleActive, IDLE);
  const handledAt = useRef(0);

  useEffect(() => {
    if (state.at === handledAt.current) return;
    handledAt.current = state.at;
    if (state.error) notify.error(state.error);
    else if (state.ok) notify.success(isActive ? "Désactivé." : "Réactivé.");
  }, [state, isActive]);

  return (
    <form action={formAction}>
      <input type="hidden" name="scope" value={scope} />
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="isActive" value={String(!isActive)} />
      <Button type="submit" variant="ghost" size="sm" disabled={pending}>
        {pending ? <Spinner data-icon="inline-start" /> : null}
        {isActive ? "Désactiver" : "Réactiver"}
      </Button>
    </form>
  );
}
