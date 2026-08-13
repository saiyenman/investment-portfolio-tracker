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
import { evaluateAmount } from "@/lib/expression";
import { formatEuro, toDecimalInput, todayIso } from "@/lib/format";
import { IDLE } from "@/lib/action-state";
import { notify } from "@/lib/notify";

import { saveHolding } from "./actions";

export type HoldingFormValues = {
  id: string;
  name: string;
  isin: string | null;
  envelopeId: string;
  assetClassId: string;
  quoteSymbol: string | null;
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

  // Montant investi : la saisie peut être un calcul, on en montre le résultat.
  const [costBasis, setCostBasis] = useState(
    toDecimalInput(holding?.costBasis),
  );
  const cost = evaluateAmount(costBasis);
  const costError = cost.error;
  // L'aperçu ne s'affiche que s'il apprend quelque chose : sur « 5100 » il
  // répéterait la saisie.
  const costPreview =
    cost.value !== null && /[+\-/xX×*()]/.test(costBasis)
      ? formatEuro(cost.value)
      : null;

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

        {/*
          Même remède que sur la boîte de dialogue de nomenclature : après
          l'enregistrement, l'action revalide la page, le composant serveur se
          re-rend et passe un nouvel `holding`, alors que la boîte de dialogue
          reste montée. Les `defaultValue` changeraient donc sur des contrôles
          non contrôlés déjà initialisés — d'où le message « changing the
          default value state of an uncontrolled FieldControl ». La clé dérivée
          des valeurs persistées remonte le formulaire avec des valeurs par
          défaut neuves. Dix champs ici, d'où la sérialisation plutôt qu'une
          énumération : oublier un champ ferait réapparaître l'avertissement.
        */}
        <form
          key={holding ? JSON.stringify(holding) : "new"}
          action={formAction}
          className="max-h-[70svh] overflow-y-auto"
        >
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
                Facultatif, pour mémoire. Ce n&apos;est pas lui qui récupère
                les cours — Yahoo n&apos;indexe pas par ISIN.
              </FieldDescription>
            </Field>

            {isAmountMode ? null : (
              <Field>
                <FieldLabel htmlFor={`quoteSymbol-${uid}`}>
                  Symbole Yahoo
                </FieldLabel>
                <Input
                  id={`quoteSymbol-${uid}`}
                  name="quoteSymbol"
                  defaultValue={holding?.quoteSymbol ?? ""}
                  placeholder="NVDA, CSPX.L, WPEA.PA…"
                  maxLength={24}
                  autoComplete="off"
                  className="uppercase"
                />
                <FieldDescription>
                  Renseigné, le cours se met à jour tout seul. Le suffixe de
                  place est souvent obligatoire — « CSPX » est refusé,
                  « CSPX.L » fonctionne. Une cotation en devise étrangère est
                  convertie en euros au taux du jour.
                </FieldDescription>
              </Field>
            )}

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
                  defaultValue={toDecimalInput(holding?.quantity)}
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
                    defaultValue={toDecimalInput(holding?.unitPrice)}
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

            {/*
              Champ contrôlé, contrairement au reste du formulaire : il faut
              relire la saisie à chaque frappe pour en afficher le résultat.
              Le remontage du formulaire par sa `key` réinitialise l'état à la
              valeur persistée, il n'y a donc rien à synchroniser à la main.
            */}
            <Field data-invalid={costError ? true : undefined}>
              <FieldLabel htmlFor={`costBasis-${uid}`}>
                Montant investi (€)
              </FieldLabel>
              <Input
                id={`costBasis-${uid}`}
                name="costBasis"
                inputMode="text"
                value={costBasis}
                onChange={(event) => setCostBasis(event.target.value)}
                placeholder="5100 ou 10x12,20"
                autoComplete="off"
                aria-describedby={`costBasis-hint-${uid}`}
              />
              <FieldDescription id={`costBasis-hint-${uid}`}>
                {costError ? (
                  costError
                ) : (
                  <>
                    Facultatif — sert uniquement à afficher la plus-value. Un
                    calcul est accepté : « 10x12,20 » donne 122 €.
                    {costPreview ? (
                      <>
                        {" "}
                        <span className="font-medium text-foreground tabular-nums">
                          = {costPreview}
                        </span>
                      </>
                    ) : null}
                  </>
                )}
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
