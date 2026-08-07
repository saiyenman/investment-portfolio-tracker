"use client";

import Decimal from "decimal.js";
import { useMemo, useState } from "react";

import { ColorDot } from "@/components/color-picker";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatEuro, formatPct } from "@/lib/format";
import { allocateContribution } from "@/lib/portfolio/rebalance";
import type { Breakdown, NamedRef } from "@/lib/portfolio/types";

/**
 * « J'ai X € à placer, comment les répartir ? »
 *
 * Le calcul tourne dans le navigateur : le moteur est constitué de fonctions
 * pures, sans accès base, donc le résultat s'affiche à la frappe sans
 * aller-retour serveur.
 */
export function ContributionPlanner({
  byAssetClass,
  assetClasses,
  targets,
  totalValue,
  capacities,
}: {
  byAssetClass: Breakdown[];
  assetClasses: NamedRef[];
  targets: Record<string, number>;
  totalValue: string;
  /** Capacité d'accueil par classe ; null = illimitée (aucun plafond ne mord). */
  capacities: Record<string, string | null>;
}) {
  const [amount, setAmount] = useState("500");

  const plan = useMemo(() => {
    const cleaned = amount.trim().replace(/[\s ]/g, "").replace(",", ".");
    if (cleaned === "" || !/^\d+(\.\d+)?$/.test(cleaned)) return null;

    return allocateContribution({
      byAssetClass,
      targets: new Map(Object.entries(targets)),
      assetClasses,
      totalValue,
      amount: cleaned,
      capacities: new Map(
        Object.entries(capacities).map(([id, value]) => [
          id,
          value === null ? null : new Decimal(value),
        ]),
      ),
    });
  }, [amount, byAssetClass, assetClasses, targets, totalValue, capacities]);

  const hasTargets = Object.keys(targets).length > 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="contribution-amount">Montant à placer (€)</Label>
        <Input
          id="contribution-amount"
          inputMode="decimal"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          className="w-40 tabular-nums"
        />
      </div>

      {!hasTargets ? (
        <p className="text-sm text-muted-foreground">
          Définissez d&apos;abord une allocation cible pour obtenir une
          répartition.
        </p>
      ) : plan === null ? (
        <p className="text-sm text-muted-foreground">
          Saisissez un montant pour voir la répartition proposée.
        </p>
      ) : plan.allocations.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Rien à répartir pour ce montant.
        </p>
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Classe d&apos;actifs</TableHead>
                <TableHead className="text-right">Part</TableHead>
                <TableHead className="text-right">Montant</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {plan.allocations.map((allocation) => (
                <TableRow key={allocation.assetClassId}>
                  <TableCell>
                    <span className="flex items-center gap-2">
                      <ColorDot slot={allocation.color} />
                      {allocation.name}
                    </span>
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {formatPct(allocation.sharePct)}
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    {formatEuro(allocation.amount)}
                  </TableCell>
                </TableRow>
              ))}
              <TableRow>
                <TableCell className="font-medium">Total réparti</TableCell>
                <TableCell />
                <TableCell className="text-right font-medium tabular-nums">
                  {formatEuro(plan.allocated)}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>

          {Number(plan.unallocated) > 0 ? (
            <Alert>
              <AlertTitle>
                {formatEuro(plan.unallocated)} non plaçable
              </AlertTitle>
              <AlertDescription>
                Les plafonds des enveloppes concernées sont atteints. Créez une
                ligne dans une enveloppe sans plafond, ou révisez vos cibles.
              </AlertDescription>
            </Alert>
          ) : null}
        </>
      )}
    </div>
  );
}
