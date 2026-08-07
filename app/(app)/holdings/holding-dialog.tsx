"use client";

import { useActionState, useEffect, useRef, useState } from "react";

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
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { todayIso } from "@/lib/format";
import { notify } from "@/lib/notify";

import { IDLE, saveHolding } from "./actions";

export type HoldingFormValues = {
  id: string;
  name: string;
  isin: string | null;
  envelopeId: string;
  assetClassId: string;
  inputMode: string;
  quantity: string;
  unitPrice: string;
  priceUpdatedAt: string | null;
  costBasis: string | null;
  note: string | null;
};

type Option = { id: string; name: string };

export function HoldingDialog({
  holding,
  envelopes,
  assetClasses,
  children,
  variant = "outline",
  size = "sm",
}: {
  holding?: HoldingFormValues;
  envelopes: Option[];
  assetClasses: Option[];
  children: React.ReactNode;
  variant?: React.ComponentProps<typeof Button>["variant"];
  size?: React.ComponentProps<typeof Button>["size"];
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(saveHolding, IDLE);
  const handledAt = useRef(0);

  // Pilote l'affichage du formulaire : en mode montant, le cours n'a pas de
  // sens (il vaut toujours 1) et le champ quantité devient un montant en euros.
  const [inputMode, setInputMode] = useState(
    holding?.inputMode === "AMOUNT" ? "AMOUNT" : "QUANTITY",
  );
  const isAmountMode = inputMode === "AMOUNT";
  const isEdit = Boolean(holding);
  const uid = holding?.id ?? "new";

  useEffect(() => {
    if (state.ok && state.at !== handledAt.current) {
      handledAt.current = state.at;
      setOpen(false);
      notify.success(isEdit ? "Ligne mise à jour." : "Ligne créée.");
    }
  }, [state, isEdit]);

  const envelopeItems = envelopes.map((e) => ({ value: e.id, label: e.name }));
  const classItems = assetClasses.map((c) => ({ value: c.id, label: c.name }));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant={variant} size={size} />}>
        {children}
      </DialogTrigger>

      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? `Modifier « ${holding!.name} »` : "Nouvelle ligne"}
          </DialogTitle>
          <DialogDescription>
            Un support détenu dans une enveloppe. Le même ETF en PEA et en
            Assurance-Vie fait deux lignes distinctes.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="max-h-[70svh] overflow-y-auto">
          <FieldGroup>
            {state.error ? (
              <Alert variant="destructive">
                <AlertDescription>{state.error}</AlertDescription>
              </Alert>
            ) : null}

            <input type="hidden" name="id" value={holding?.id ?? ""} />
            <input type="hidden" name="inputMode" value={inputMode} />

            <Field>
              <FieldLabel htmlFor={`name-${uid}`}>Nom du support</FieldLabel>
              <Input
                id={`name-${uid}`}
                name="name"
                defaultValue={holding?.name}
                placeholder="ETF MSCI World"
                required
                maxLength={120}
                autoComplete="off"
              />
            </Field>

            <Field>
              <FieldLabel htmlFor={`isin-${uid}`}>ISIN</FieldLabel>
              <Input
                id={`isin-${uid}`}
                name="isin"
                defaultValue={holding?.isin ?? ""}
                placeholder="FR0013416716"
                maxLength={12}
                autoComplete="off"
              />
              <FieldDescription>
                Facultatif. Servira à récupérer les cours automatiquement.
              </FieldDescription>
            </Field>

            <Field>
              <FieldLabel>Enveloppe</FieldLabel>
              <Select
                name="envelopeId"
                items={envelopeItems}
                defaultValue={holding?.envelopeId ?? envelopes[0]?.id}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {envelopes.map((envelope) => (
                      <SelectItem key={envelope.id} value={envelope.id}>
                        {envelope.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>

            <Field>
              <FieldLabel>Classe d&apos;actifs</FieldLabel>
              <Select
                name="assetClassId"
                items={classItems}
                defaultValue={holding?.assetClassId ?? assetClasses[0]?.id}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {assetClasses.map((assetClass) => (
                      <SelectItem key={assetClass.id} value={assetClass.id}>
                        {assetClass.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>

            <Field>
              <FieldLabel>Mode de saisie</FieldLabel>
              <ToggleGroup
                value={[inputMode]}
                onValueChange={(value) => {
                  const next = value[0];
                  if (next) setInputMode(next);
                }}
                variant="outline"
              >
                <ToggleGroupItem value="QUANTITY">
                  Parts × cours
                </ToggleGroupItem>
                <ToggleGroupItem value="AMOUNT">Montant en €</ToggleGroupItem>
              </ToggleGroup>
              <FieldDescription>
                {isAmountMode
                  ? "Pour un Livret A ou un fonds euro : vous saisissez directement le solde."
                  : "Pour un ETF, une SCPI ou un ETC : quantité de parts et cours unitaire."}
              </FieldDescription>
            </Field>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor={`quantity-${uid}`}>
                  {isAmountMode ? "Montant (€)" : "Quantité de parts"}
                </FieldLabel>
                <Input
                  id={`quantity-${uid}`}
                  name="quantity"
                  inputMode="decimal"
                  defaultValue={holding?.quantity ?? ""}
                  placeholder={isAmountMode ? "8400" : "12"}
                  autoComplete="off"
                />
              </Field>

              {isAmountMode ? null : (
                <Field>
                  <FieldLabel htmlFor={`unitPrice-${uid}`}>
                    Cours unitaire (€)
                  </FieldLabel>
                  <Input
                    id={`unitPrice-${uid}`}
                    name="unitPrice"
                    inputMode="decimal"
                    defaultValue={holding?.unitPrice ?? ""}
                    placeholder="485,20"
                    autoComplete="off"
                  />
                </Field>
              )}
            </div>

            <Field>
              <FieldLabel htmlFor={`priceUpdatedAt-${uid}`}>
                Date de la valeur
              </FieldLabel>
              <Input
                id={`priceUpdatedAt-${uid}`}
                name="priceUpdatedAt"
                type="date"
                defaultValue={holding?.priceUpdatedAt ?? todayIso()}
              />
              <FieldDescription>
                Au-delà de 90 jours, la ligne est signalée comme à rafraîchir.
              </FieldDescription>
            </Field>

            <Field>
              <FieldLabel htmlFor={`costBasis-${uid}`}>
                Montant investi (€)
              </FieldLabel>
              <Input
                id={`costBasis-${uid}`}
                name="costBasis"
                inputMode="decimal"
                defaultValue={holding?.costBasis ?? ""}
                placeholder="5100"
                autoComplete="off"
              />
              <FieldDescription>
                Facultatif — sert uniquement à afficher la plus-value.
              </FieldDescription>
            </Field>

            <Field>
              <FieldLabel htmlFor={`note-${uid}`}>Note</FieldLabel>
              <Textarea
                id={`note-${uid}`}
                name="note"
                rows={2}
                defaultValue={holding?.note ?? ""}
                placeholder="SCPI : saisir la valeur de retrait, pas le prix de souscription."
              />
            </Field>

            <DialogFooter>
              <Button type="submit" disabled={pending}>
                {pending ? <Spinner data-icon="inline-start" /> : null}
                {isEdit ? "Enregistrer" : "Créer la ligne"}
              </Button>
            </DialogFooter>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  );
}
