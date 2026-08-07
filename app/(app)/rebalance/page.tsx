import type { Metadata } from "next";

import { ColorDot } from "@/components/color-picker";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { loadPortfolio } from "@/lib/db/queries";
import { formatEuro, formatPct, formatPoints, todayIso } from "@/lib/format";
import {
  DEFAULT_BAND_PCT,
  computeClassCapacities,
  computeDrift,
} from "@/lib/portfolio/rebalance";
import { computePortfolio } from "@/lib/portfolio/valuation";

import { ContributionPlanner } from "./contribution-planner";
import { TargetsForm } from "./targets-form";

export const metadata: Metadata = {
  title: "Rééquilibrage — Suivi de patrimoine",
};

const STATUS_LABEL = {
  under: "À renforcer",
  over: "À alléger",
  ok: "Dans la cible",
} as const;

export default async function RebalancePage() {
  const data = await loadPortfolio();

  const summary = computePortfolio({
    holdings: data.holdings,
    envelopes: data.envelopes,
    assetClasses: data.assetClasses,
    today: todayIso(),
  });

  const drift = computeDrift({
    byAssetClass: summary.byAssetClass,
    targets: data.targets,
    assetClasses: data.assetClasses,
    totalValue: summary.totalValue,
  });

  const capacities = computeClassCapacities({
    holdings: data.holdings,
    envelopes: data.envelopes,
    byEnvelope: summary.byEnvelope,
  });

  // Les Map et les Decimal ne traversent pas la frontière serveur/client :
  // on les sérialise en objets simples.
  const targetsRecord = Object.fromEntries(data.targets);
  const capacitiesRecord = Object.fromEntries(
    [...capacities].map(([id, value]) => [id, value === null ? null : value.toFixed(2)]),
  );

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Rééquilibrage</h1>
        <p className="text-sm text-muted-foreground">
          L&apos;application compare votre répartition aux cibles que vous
          définissez et calcule comment y converger. Elle ne recommande aucune
          allocation : les cibles ci-dessous sont les vôtres.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Allocation cible</CardTitle>
            <CardDescription>
              La somme doit faire exactement 100 %.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <TargetsForm
              assetClasses={data.assetClasses.map((c) => ({
                id: c.id,
                name: c.name,
                color: c.color,
              }))}
              targets={targetsRecord}
            />
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Écarts</CardTitle>
            <CardDescription>
              Tolérance de ±{DEFAULT_BAND_PCT} points avant signalement.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {drift.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Aucune cible définie pour l&apos;instant.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Classe</TableHead>
                      <TableHead className="text-right">Cible</TableHead>
                      <TableHead className="text-right">Actuel</TableHead>
                      <TableHead className="text-right">Écart</TableHead>
                      <TableHead className="text-right">En euros</TableHead>
                      <TableHead>État</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {drift.map((row) => (
                      <TableRow key={row.assetClassId}>
                        <TableCell>
                          <span className="flex items-center gap-2">
                            <ColorDot slot={row.color} />
                            {row.name}
                          </span>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatPct(row.targetPct)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatPct(row.currentPct)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatPoints(row.gapPct)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">
                          {formatEuro(row.gapValue)}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              row.status === "ok" ? "secondary" : "outline"
                            }
                          >
                            {STATUS_LABEL[row.status]}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Répartir un versement</CardTitle>
          <CardDescription>
            Sans rien vendre — donc sans déclencher de fiscalité. Le versement
            va en priorité aux classes les plus en retard sur leur cible.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ContributionPlanner
            byAssetClass={summary.byAssetClass}
            assetClasses={data.assetClasses}
            targets={targetsRecord}
            totalValue={summary.totalValue}
            capacities={capacitiesRecord}
          />
        </CardContent>
      </Card>
    </div>
  );
}
