"use client";

import { useActionState, useEffect, useRef, useState } from "react";

import { ColorPicker } from "@/components/color-picker";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { IDLE } from "@/lib/action-state";
import { notify } from "@/lib/notify";

import { saveAssetClass, saveEnvelope } from "./actions";

type Kind = "envelope" | "assetClass";

type Item = {
  id: string;
  name: string;
  color: string | null;
  ceilingAmount?: string | null;
};

const LABELS: Record<Kind, { singular: string; create: string }> = {
  envelope: { singular: "enveloppe", create: "Nouvelle enveloppe" },
  assetClass: { singular: "classe d'actifs", create: "Nouvelle classe" },
};

export function NomenclatureDialog({
  kind,
  item,
  children,
  variant = "outline",
  size = "sm",
}: {
  kind: Kind;
  item?: Item;
  children: React.ReactNode;
  variant?: React.ComponentProps<typeof Button>["variant"];
  size?: React.ComponentProps<typeof Button>["size"];
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(
    kind === "envelope" ? saveEnvelope : saveAssetClass,
    IDLE,
  );
  const handledAt = useRef(0);
  const labels = LABELS[kind];
  const isEdit = Boolean(item);

  useEffect(() => {
    if (state.ok && state.at !== handledAt.current) {
      handledAt.current = state.at;
      setOpen(false);
      notify.success(isEdit ? "Modifications enregistrées." : "Création effectuée.");
    }
  }, [state, isEdit]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant={variant} size={size} />}>
        {children}
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEdit ? `Modifier « ${item!.name} »` : labels.create}
          </DialogTitle>
          <DialogDescription>
            {kind === "envelope"
              ? "Une enveloppe fiscale : PEA, Assurance-Vie, CTO, PER…"
              : "Une nature de risque : Actions, Immobilier, Crypto…"}
          </DialogDescription>
        </DialogHeader>

        <form action={formAction}>
          <FieldGroup>
            {state.error ? (
              <Alert variant="destructive">
                <AlertDescription>{state.error}</AlertDescription>
              </Alert>
            ) : null}

            <input type="hidden" name="id" value={item?.id ?? ""} />

            <Field data-invalid={state.error ? true : undefined}>
              <FieldLabel htmlFor={`name-${kind}-${item?.id ?? "new"}`}>
                Nom
              </FieldLabel>
              <Input
                id={`name-${kind}-${item?.id ?? "new"}`}
                name="name"
                defaultValue={item?.name}
                required
                maxLength={80}
                autoComplete="off"
              />
            </Field>

            {kind === "envelope" ? (
              <Field>
                <FieldLabel htmlFor={`ceiling-${item?.id ?? "new"}`}>
                  Plafond réglementaire (€)
                </FieldLabel>
                <Input
                  id={`ceiling-${item?.id ?? "new"}`}
                  name="ceilingAmount"
                  inputMode="decimal"
                  defaultValue={item?.ceilingAmount ?? ""}
                  placeholder="22950"
                  autoComplete="off"
                />
                <FieldDescription>
                  Facultatif. Renseigné, il affiche la marge restante et écrête
                  les propositions de versement.
                </FieldDescription>
              </Field>
            ) : null}

            <Field>
              <FieldLabel>Couleur</FieldLabel>
              <ColorPicker name="color" defaultValue={item?.color} />
              <FieldDescription>
                Huit teintes validées pour rester distinguables, y compris en
                cas de daltonisme et en thème sombre.
              </FieldDescription>
            </Field>

            <DialogFooter>
              <Button type="submit" disabled={pending}>
                {pending ? <Spinner data-icon="inline-start" /> : null}
                {isEdit ? "Enregistrer" : "Créer"}
              </Button>
            </DialogFooter>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  );
}
