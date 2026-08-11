"use client";

import { RefreshCwIcon, TriangleAlertIcon } from "lucide-react";
import { useActionState, useEffect, useRef } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { IDLE } from "@/lib/action-state";
import { notify } from "@/lib/notify";
import type { RejectedQuote } from "@/lib/portfolio/quotes";

import { refreshQuotes } from "./quotes-actions";

const REASON_LABEL: Record<RejectedQuote["reason"], string> = {
  "no-quote": "symbole inconnu de Yahoo, ou sans cours publié",
  "invalid-price": "cours renvoyé inexploitable",
  "missing-rate": "taux de change indisponible",
  "invalid-rate": "taux de change inexploitable",
};

/**
 * Signalement des cours qui n'ont pas pu être appliqués.
 *
 * Le principe : une valeur fausse est pire qu'une valeur ancienne. Quand un
 * cours est refusé, la ligne garde celui qui a été saisi à la main, et l'écran
 * le dit — sinon le patrimoine afficherait un chiffre issu d'une donnée
 * douteuse sans que rien ne le laisse voir.
 */
export function QuoteAlert({
  error,
  rejected,
}: {
  error: string | null;
  rejected: RejectedQuote[];
}) {
  if (!error && rejected.length === 0) return null;

  return (
    <Alert>
      <TriangleAlertIcon />
      <AlertTitle>
        {rejected.length > 0
          ? `${rejected.length} cours non appliqué${rejected.length > 1 ? "s" : ""}`
          : "Cours indisponibles"}
      </AlertTitle>
      <AlertDescription>
        {rejected.length > 0 ? (
          <>
            Ces lignes gardent le cours saisi à la main :{" "}
            {rejected
              .map((r) => `${r.symbol} (${REASON_LABEL[r.reason]})`)
              .join(", ")}
            .
          </>
        ) : (
          "Les dernières valeurs connues sont affichées."
        )}
        {error ? <> Yahoo n&apos;a pas répondu : {error}</> : null}
      </AlertDescription>
    </Alert>
  );
}

export function RefreshQuotesButton() {
  const [state, formAction, pending] = useActionState(refreshQuotes, IDLE);
  const handledAt = useRef(0);

  useEffect(() => {
    if (state.at === handledAt.current) return;
    handledAt.current = state.at;
    if (state.error) notify.error(state.error);
    else if (state.ok) notify.success("Cours actualisés.");
  }, [state]);

  return (
    <form action={formAction}>
      <Button type="submit" variant="outline" size="sm" disabled={pending}>
        {pending ? (
          <Spinner data-icon="inline-start" />
        ) : (
          <RefreshCwIcon data-icon="inline-start" />
        )}
        Actualiser les cours
      </Button>
    </form>
  );
}
