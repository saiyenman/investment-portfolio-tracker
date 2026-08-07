"use client";

import Decimal from "decimal.js";
import { useActionState, useEffect, useRef, useState } from "react";

import { ColorDot } from "@/components/color-picker";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { IDLE } from "@/lib/action-state";
import { notify } from "@/lib/notify";
import { cn } from "@/lib/utils";

import { saveTargets } from "./actions";

type ClassOption = { id: string; name: string; color: string | null };

export function TargetsForm({
  assetClasses,
  targets,
}: {
  assetClasses: ClassOption[];
  targets: Record<string, number>;
}) {
  const [state, formAction, pending] = useActionState(saveTargets, IDLE);
  const handledAt = useRef(0);

  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      assetClasses.map((c) => [c.id, targets[c.id] ? String(targets[c.id]) : ""]),
    ),
  );

  useEffect(() => {
    if (state.at === handledAt.current) return;
    handledAt.current = state.at;
    if (state.error) notify.error(state.error);
    else if (state.ok) notify.success("Allocation cible enregistrée.");
  }, [state]);

  // Total calculé en Decimal : 33,33 + 33,33 + 33,34 doit faire exactement 100.
  const total = Object.values(values).reduce((sum, raw) => {
    const cleaned = raw.trim().replace(",", ".");
    if (cleaned === "" || !/^\d+(\.\d+)?$/.test(cleaned)) return sum;
    return sum.plus(cleaned);
  }, new Decimal(0));

  const isComplete = total.toDecimalPlaces(2).equals(100);
  const isEmpty = total.isZero();

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {state.error ? (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="flex flex-col gap-2">
        {assetClasses.map((assetClass) => (
          <div
            key={assetClass.id}
            className="flex items-center justify-between gap-3"
          >
            <label
              htmlFor={`target-${assetClass.id}`}
              className="flex min-w-0 items-center gap-2 text-sm"
            >
              <ColorDot slot={assetClass.color} />
              <span className="truncate">{assetClass.name}</span>
            </label>
            <div className="flex shrink-0 items-center gap-1">
              <Input
                id={`target-${assetClass.id}`}
                name={`target-${assetClass.id}`}
                inputMode="decimal"
                value={values[assetClass.id] ?? ""}
                onChange={(event) =>
                  setValues((previous) => ({
                    ...previous,
                    [assetClass.id]: event.target.value,
                  }))
                }
                placeholder="0"
                className="h-9 w-20 text-right tabular-nums"
              />
              <span className="text-sm text-muted-foreground">%</span>
            </div>
          </div>
        ))}
      </div>

      <div
        className={cn(
          "flex items-center justify-between border-t pt-3 text-sm",
          !isEmpty && !isComplete && "text-destructive",
        )}
        aria-live="polite"
      >
        <span className="font-medium">Total</span>
        <span className="tabular-nums font-medium">
          {total.toDecimalPlaces(2).toString()} %
          {!isEmpty && !isComplete ? " — doit faire 100 %" : ""}
        </span>
      </div>

      <Button type="submit" disabled={pending || (!isEmpty && !isComplete)}>
        {pending ? <Spinner data-icon="inline-start" /> : null}
        Enregistrer l&apos;allocation cible
      </Button>
    </form>
  );
}
