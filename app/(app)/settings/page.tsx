import { PlusIcon } from "lucide-react";
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
import { listAssetClasses, listEnvelopes } from "@/lib/db/queries";
import { formatEuro } from "@/lib/format";

import { NomenclatureDialog } from "./nomenclature-dialog";
import { ToggleActive } from "./toggle-active";

export const metadata: Metadata = { title: "Réglages — Suivi de patrimoine" };

export default async function SettingsPage() {
  // On inclut les éléments désactivés : sans cela, impossible de les réactiver.
  const [envelopes, assetClasses] = await Promise.all([
    listEnvelopes(true),
    listAssetClasses(true),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Réglages</h1>
        <p className="text-sm text-muted-foreground">
          Enveloppes et classes d&apos;actifs se créent ici, sans toucher au
          code. Ajouter un CTO, un PER ou une classe « Crypto » prend quelques
          secondes.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Enveloppes fiscales</CardTitle>
          <CardDescription>
            Les contenants : Livret A, PEA, Assurance-Vie, CTO, PER…
          </CardDescription>
          <div className="ml-auto">
            <NomenclatureDialog kind="envelope">
              <PlusIcon data-icon="inline-start" />
              Nouvelle enveloppe
            </NomenclatureDialog>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nom</TableHead>
                <TableHead className="text-right">Plafond</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {envelopes.map((envelope) => (
                <TableRow key={envelope.id} data-inactive={!envelope.isActive}>
                  <TableCell className="w-full min-w-[8rem] font-medium whitespace-normal">
                    <span className="flex items-center gap-2">
                      <ColorDot slot={envelope.color} />
                      {envelope.name}
                    </span>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {envelope.ceilingAmount
                      ? formatEuro(envelope.ceilingAmount)
                      : "—"}
                  </TableCell>
                  <TableCell>
                    {envelope.isActive ? (
                      <Badge variant="secondary">Active</Badge>
                    ) : (
                      <Badge variant="outline">Désactivée</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <NomenclatureDialog
                        kind="envelope"
                        item={envelope}
                        variant="ghost"
                      >
                        Modifier
                      </NomenclatureDialog>
                      <ToggleActive
                        scope="envelope"
                        id={envelope.id}
                        isActive={envelope.isActive}
                      />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Classes d&apos;actifs</CardTitle>
          <CardDescription>
            La nature du risque : Actions, Immobilier, Or, Crypto…
          </CardDescription>
          <div className="ml-auto">
            <NomenclatureDialog kind="assetClass">
              <PlusIcon data-icon="inline-start" />
              Nouvelle classe
            </NomenclatureDialog>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nom</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {assetClasses.map((assetClass) => (
                <TableRow key={assetClass.id}>
                  <TableCell className="w-full min-w-[8rem] font-medium whitespace-normal">
                    <span className="flex items-center gap-2">
                      <ColorDot slot={assetClass.color} />
                      {assetClass.name}
                    </span>
                  </TableCell>
                  <TableCell>
                    {assetClass.isActive ? (
                      <Badge variant="secondary">Active</Badge>
                    ) : (
                      <Badge variant="outline">Désactivée</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <NomenclatureDialog
                        kind="assetClass"
                        item={assetClass}
                        variant="ghost"
                      >
                        Modifier
                      </NomenclatureDialog>
                      <ToggleActive
                        scope="assetClass"
                        id={assetClass.id}
                        isActive={assetClass.isActive}
                      />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
