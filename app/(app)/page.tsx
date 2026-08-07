import { PlusIcon, TriangleAlertIcon, WalletIcon } from "lucide-react";
import Link from "next/link";

import { AllocationDonut } from "@/components/allocation-donut";
import { ColorDot } from "@/components/color-picker";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { loadPortfolio } from "@/lib/db/queries";
import {
  formatDate,
  formatEuro,
  formatPct,
  formatSignedEuro,
  todayIso,
} from "@/lib/format";
import { computeEnvelopeHeadroom } from "@/lib/portfolio/rebalance";
import { computePortfolio } from "@/lib/portfolio/valuation";

import { QuickPriceForm } from "./quick-price-form";

function StatTile({
  label,
  value,
  hint,
  badge,
}: {
  label: string;
  value: string;
  hint?: string;
  badge?: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-1 pt-6">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="text-2xl font-semibold tabular-nums">{value}</p>
        {badge}
        {hint ? (
          <p className="text-xs text-muted-foreground">{hint}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}

export default async function DashboardPage() {
  const data = await loadPortfolio();
  const today = todayIso();

  const summary = computePortfolio({
    holdings: data.holdings,
    envelopes: data.envelopes,
    assetClasses: data.assetClasses,
    today,
  });
  const headroom = computeEnvelopeHeadroom({
    envelopes: data.envelopes,
    byEnvelope: summary.byEnvelope,
  });

  const classById = new Map(data.assetClasses.map((c) => [c.id, c]));
  const envelopeById = new Map(data.envelopes.map((e) => [e.id, e]));

  if (summary.holdings.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <WalletIcon />
          </EmptyMedia>
          <EmptyTitle>Votre patrimoine est encore vide</EmptyTitle>
          <EmptyDescription>
            Ajoutez vos lignes pour voir apparaître la répartition par classe
            d&apos;actifs et par enveloppe.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button render={<Link href="/holdings" />}>
            <PlusIcon data-icon="inline-start" />
            Ajouter une ligne
          </Button>
        </EmptyContent>
      </Empty>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          Tableau de bord
        </h1>
        <p className="text-sm text-muted-foreground">
          Répartition au {formatDate(today)}.
        </p>
      </header>

      {summary.staleCount > 0 ? (
        <Alert>
          <TriangleAlertIcon />
          <AlertTitle>
            {summary.staleCount} valeur{summary.staleCount > 1 ? "s" : ""} à
            rafraîchir
          </AlertTitle>
          <AlertDescription>
            La plus ancienne date du {formatDate(summary.oldestPriceDate)}. Une
            répartition calculée sur des cours périmés est fausse — mettez-les à
            jour dans le tableau ci-dessous.
          </AlertDescription>
        </Alert>
      ) : null}

      <section
        aria-label="Synthèse"
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        <StatTile
          label="Patrimoine total"
          value={formatEuro(summary.totalValue)}
          hint={`${summary.holdings.length} ligne${
            summary.holdings.length > 1 ? "s" : ""
          }`}
        />
        <StatTile
          label="Capital investi"
          value={formatEuro(summary.totalCostBasis)}
          hint={
            summary.holdingsWithoutCostBasis > 0
              ? `Partiel — ${summary.holdingsWithoutCostBasis} ligne${
                  summary.holdingsWithoutCostBasis > 1 ? "s" : ""
                } sans montant investi`
              : undefined
          }
        />
        <StatTile
          label="Plus-value latente"
          value={formatSignedEuro(summary.totalGain)}
          badge={
            summary.totalGainPct !== null ? (
              <span>
                <Badge variant="secondary">
                  {summary.totalGainPct > 0 ? "+" : ""}
                  {formatPct(summary.totalGainPct)}
                </Badge>
              </span>
            ) : undefined
          }
          hint="Sur les seules lignes dont le coût est renseigné"
        />
        <StatTile
          label="Classes d'actifs"
          value={String(summary.byAssetClass.length)}
          hint={`${summary.byEnvelope.length} enveloppe${
            summary.byEnvelope.length > 1 ? "s" : ""
          }`}
        />
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Par classe d&apos;actifs</CardTitle>
            <CardDescription>La nature du risque porté.</CardDescription>
          </CardHeader>
          <CardContent>
            <AllocationDonut
              items={summary.byAssetClass}
              total={summary.totalValue}
              title="Par classe d'actifs"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Par enveloppe fiscale</CardTitle>
            <CardDescription>Où les actifs sont logés.</CardDescription>
          </CardHeader>
          <CardContent>
            <AllocationDonut
              items={summary.byEnvelope}
              total={summary.totalValue}
              title="Par enveloppe fiscale"
            />
          </CardContent>
        </Card>
      </section>

      {headroom.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Marge sous plafond</CardTitle>
            <CardDescription>
              Ce qu&apos;il reste à verser sur les enveloppes plafonnées.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-6">
            {headroom.map((row) => (
              <div key={row.envelopeId} className="flex flex-col gap-0.5">
                <span className="text-sm text-muted-foreground">{row.name}</span>
                <span className="text-lg font-semibold tabular-nums">
                  {formatEuro(row.headroom)}
                </span>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {formatEuro(row.current)} / {formatEuro(row.ceiling)}
                  {row.isFull ? " — plafond atteint" : ""}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Détail des lignes</CardTitle>
          <CardDescription>
            La colonne « valeur unitaire » est modifiable directement : en mode
            montant, elle porte le solde de la ligne.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Support</TableHead>
                  <TableHead>Classe</TableHead>
                  <TableHead>Enveloppe</TableHead>
                  <TableHead className="text-right">Valeur unitaire</TableHead>
                  <TableHead className="text-right">Valeur</TableHead>
                  <TableHead className="text-right">Poids</TableHead>
                  <TableHead className="text-right">+/-value</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {summary.holdings.map((holding) => {
                  const assetClass = classById.get(holding.assetClassId);
                  const envelope = envelopeById.get(holding.envelopeId);
                  const isAmountMode = holding.inputMode === "AMOUNT";
                  return (
                    <TableRow key={holding.id}>
                      <TableCell>
                        <div className="flex flex-col gap-0.5">
                          <span className="font-medium">{holding.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {holding.isStalePrice ? (
                              <Badge variant="outline">
                                Valeur du {formatDate(holding.priceUpdatedAt)}
                              </Badge>
                            ) : (
                              `Mis à jour le ${formatDate(holding.priceUpdatedAt)}`
                            )}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <span className="flex items-center gap-2">
                          <ColorDot slot={assetClass?.color ?? null} />
                          {assetClass?.name ?? "—"}
                        </span>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {envelope?.name ?? "—"}
                      </TableCell>
                      <TableCell>
                        <QuickPriceForm
                          id={holding.id}
                          inputMode={holding.inputMode}
                          label={
                            isAmountMode
                              ? `Montant de ${holding.name}`
                              : `Cours de ${holding.name}`
                          }
                          defaultValue={
                            isAmountMode ? holding.quantity : holding.unitPrice
                          }
                        />
                      </TableCell>
                      <TableCell className="text-right font-medium tabular-nums">
                        {formatEuro(holding.value)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatPct(holding.weightPct)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {holding.gain === null ? (
                          <span className="text-muted-foreground">—</span>
                        ) : (
                          <span className="flex flex-col items-end gap-0.5">
                            <span>{formatSignedEuro(holding.gain)}</span>
                            {holding.gainPct !== null ? (
                              <Badge variant="secondary">
                                {holding.gainPct > 0 ? "+" : ""}
                                {formatPct(holding.gainPct)}
                              </Badge>
                            ) : null}
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
