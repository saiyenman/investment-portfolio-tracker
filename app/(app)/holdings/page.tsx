import { PlusIcon, WalletIcon } from "lucide-react";
import type { Metadata } from "next";

import { ColorDot } from "@/components/color-picker";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { QuoteBadge } from "@/components/quoted-price";
import { type HoldingRow } from "@/lib/db/queries";
import { formatDate, formatEuro, formatQuantity, todayIso } from "@/lib/format";
import { holdingValue, isPriceStale } from "@/lib/portfolio/valuation";
import { listHoldingsWithQuotes } from "@/lib/quotes/load";
import { cn } from "@/lib/utils";

import { HoldingDialog } from "./holding-dialog";
import { DeleteHolding, ToggleHolding } from "./row-actions";

export const metadata: Metadata = { title: "Mes lignes — Suivi de patrimoine" };

type Option = { id: string; name: string };

/** Nom du support et ses signaux : ISIN, désactivation, cours périmé. */
function HoldingIdentity({
  holding,
  today,
}: {
  holding: HoldingRow;
  today: string;
}) {
  const stale = isPriceStale(holding.priceUpdatedAt, today);

  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <span className="font-medium">{holding.name}</span>
      <span className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        {holding.quoteSymbol ? (
          <QuoteBadge symbol={holding.quoteSymbol} />
        ) : null}
        {holding.isin ? (
          <span className="tabular-nums">{holding.isin}</span>
        ) : null}
        {!holding.isActive ? (
          <Badge variant="outline">Désactivée</Badge>
        ) : null}
        {stale ? (
          <Badge variant="outline">
            Valeur du {formatDate(holding.priceUpdatedAt)}
          </Badge>
        ) : null}
      </span>
    </div>
  );
}

function HoldingActions({
  holding,
  envelopes,
  assetClasses,
}: {
  holding: HoldingRow;
  envelopes: Option[];
  assetClasses: Option[];
}) {
  return (
    <>
      <HoldingDialog
        holding={holding}
        envelopes={envelopes}
        assetClasses={assetClasses}
        variant="ghost"
      >
        Modifier
      </HoldingDialog>
      <ToggleHolding id={holding.id} isActive={holding.isActive} />
      <DeleteHolding id={holding.id} name={holding.name} />
    </>
  );
}

export default async function HoldingsPage() {
  // Cours appliqués ici aussi : une même ligne ne peut pas valoir deux
  // montants différents selon l'écran qu'on regarde.
  const { holdings, envelopes, assetClasses } =
    await listHoldingsWithQuotes(true);
  const today = todayIso();
  const canCreate = envelopes.length > 0 && assetClasses.length > 0;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Mes lignes</h1>
          <p className="text-sm text-muted-foreground">
            Ce que vous détenez aujourd&apos;hui. La valeur d&apos;une ligne est
            toujours quantité × cours — en mode montant, le cours vaut 1.
          </p>
        </div>
        {canCreate ? (
          <HoldingDialog envelopes={envelopes} assetClasses={assetClasses}>
            <PlusIcon data-icon="inline-start" />
            Nouvelle ligne
          </HoldingDialog>
        ) : null}
      </header>

      {holdings.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <WalletIcon />
            </EmptyMedia>
            <EmptyTitle>Aucune ligne pour l&apos;instant</EmptyTitle>
            <EmptyDescription>
              {canCreate
                ? "Créez une première ligne pour voir apparaître la répartition de votre patrimoine."
                : "Créez d'abord une enveloppe et une classe d'actifs dans les Réglages."}
            </EmptyDescription>
          </EmptyHeader>
          {canCreate ? (
            <EmptyContent>
              <HoldingDialog
                envelopes={envelopes}
                assetClasses={assetClasses}
                variant="default"
                size="default"
              >
                <PlusIcon data-icon="inline-start" />
                Nouvelle ligne
              </HoldingDialog>
            </EmptyContent>
          ) : null}
        </Empty>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>
              {holdings.length} ligne{holdings.length > 1 ? "s" : ""}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/*
              Sous md, le tableau à sept colonnes déborde : la colonne Actions
              sort de l'écran et les boutons deviennent inatteignables, sans que
              rien ne signale qu'il faut défiler horizontalement. On bascule donc
              sur une liste de cartes, où chaque ligne porte ses propres actions.
            */}
            <ul className="flex flex-col gap-3 md:hidden">
              {holdings.map((holding) => (
                <li
                  key={holding.id}
                  className={cn(
                    "rounded-lg border p-3",
                    !holding.isActive && "opacity-55",
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <HoldingIdentity holding={holding} today={today} />
                    <span className="shrink-0 font-medium tabular-nums">
                      {formatEuro(holdingValue(holding))}
                    </span>
                  </div>

                  <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <dt>Enveloppe</dt>
                      <dd className="text-foreground">
                        {holding.envelopeName}
                      </dd>
                    </div>
                    <div className="flex items-center gap-1">
                      <dt>Classe</dt>
                      <dd className="flex items-center gap-1 text-foreground">
                        <ColorDot slot={holding.assetClassColor} />
                        {holding.assetClassName}
                      </dd>
                    </div>
                    {holding.inputMode === "AMOUNT" ? null : (
                      <div className="flex items-center gap-1">
                        <dt>Détail</dt>
                        <dd className="text-foreground tabular-nums">
                          {formatQuantity(holding.quantity)} ×{" "}
                          {formatEuro(holding.unitPrice)}
                        </dd>
                      </div>
                    )}
                  </dl>

                  <div className="mt-3 flex flex-wrap items-center gap-1 border-t pt-2">
                    <HoldingActions
                      holding={holding}
                      envelopes={envelopes}
                      assetClasses={assetClasses}
                    />
                  </div>
                </li>
              ))}
            </ul>

            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Support</TableHead>
                    <TableHead>Enveloppe</TableHead>
                    <TableHead className="hidden lg:table-cell">
                      Classe
                    </TableHead>
                    <TableHead className="hidden text-right lg:table-cell">
                      Quantité
                    </TableHead>
                    <TableHead className="hidden text-right lg:table-cell">
                      Cours
                    </TableHead>
                    <TableHead className="text-right">Valeur</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {holdings.map((holding) => {
                    const isAmountMode = holding.inputMode === "AMOUNT";
                    return (
                      <TableRow
                        key={holding.id}
                        className={holding.isActive ? undefined : "opacity-55"}
                      >
                        {/*
                          `whitespace-normal` annule le `whitespace-nowrap` que
                          TableCell porte par défaut. Sans cela, un nom de
                          support long ne peut ni revenir à la ligne ni être
                          tronqué : il impose sa largeur au tableau, qui déborde
                          et pousse la colonne Actions hors de l'écran. Seule
                          cette colonne est assouplie ; les chiffres et les
                          boutons restent insécables.
                        */}
                        <TableCell className="w-full min-w-[12rem] whitespace-normal">
                          <HoldingIdentity holding={holding} today={today} />
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {holding.envelopeName}
                        </TableCell>
                        <TableCell className="hidden whitespace-nowrap lg:table-cell">
                          <span className="flex items-center gap-2">
                            <ColorDot slot={holding.assetClassColor} />
                            {holding.assetClassName}
                          </span>
                        </TableCell>
                        <TableCell className="hidden text-right tabular-nums lg:table-cell">
                          {isAmountMode ? "—" : formatQuantity(holding.quantity)}
                        </TableCell>
                        <TableCell className="hidden text-right tabular-nums lg:table-cell">
                          {isAmountMode ? "—" : formatEuro(holding.unitPrice)}
                        </TableCell>
                        <TableCell className="text-right font-medium tabular-nums">
                          {formatEuro(holdingValue(holding))}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-1">
                            <HoldingActions
                              holding={holding}
                              envelopes={envelopes}
                              assetClasses={assetClasses}
                            />
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
