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
import { listAssetClasses, listEnvelopes, listHoldings } from "@/lib/db/queries";
import {
  formatDate,
  formatEuro,
  formatQuantity,
  todayIso,
} from "@/lib/format";
import { holdingValue, isPriceStale } from "@/lib/portfolio/valuation";

import { HoldingDialog } from "./holding-dialog";
import { DeleteHolding, ToggleHolding } from "./row-actions";

export const metadata: Metadata = { title: "Mes lignes — Suivi de patrimoine" };

export default async function HoldingsPage() {
  const [holdings, envelopes, assetClasses] = await Promise.all([
    listHoldings(true),
    listEnvelopes(),
    listAssetClasses(),
  ]);
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
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Support</TableHead>
                    <TableHead>Enveloppe</TableHead>
                    <TableHead>Classe</TableHead>
                    <TableHead className="text-right">Quantité</TableHead>
                    <TableHead className="text-right">Cours</TableHead>
                    <TableHead className="text-right">Valeur</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {holdings.map((holding) => {
                    const isAmountMode = holding.inputMode === "AMOUNT";
                    const stale = isPriceStale(holding.priceUpdatedAt, today);
                    return (
                      <TableRow
                        key={holding.id}
                        className={holding.isActive ? undefined : "opacity-55"}
                      >
                        <TableCell>
                          <div className="flex flex-col gap-0.5">
                            <span className="font-medium">{holding.name}</span>
                            <span className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                              {holding.isin ? (
                                <span className="tabular-nums">
                                  {holding.isin}
                                </span>
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
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {holding.envelopeName}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          <span className="flex items-center gap-2">
                            <ColorDot slot={holding.assetClassColor} />
                            {holding.assetClassName}
                          </span>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {isAmountMode ? "—" : formatQuantity(holding.quantity)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {isAmountMode ? "—" : formatEuro(holding.unitPrice)}
                        </TableCell>
                        <TableCell className="text-right font-medium tabular-nums">
                          {formatEuro(holdingValue(holding))}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-1">
                            <HoldingDialog
                              holding={holding}
                              envelopes={envelopes}
                              assetClasses={assetClasses}
                              variant="ghost"
                            >
                              Modifier
                            </HoldingDialog>
                            <ToggleHolding
                              id={holding.id}
                              isActive={holding.isActive}
                            />
                            <DeleteHolding id={holding.id} name={holding.name} />
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
