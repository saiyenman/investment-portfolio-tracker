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
import { cn } from "@/lib/utils";

import { NomenclatureDialog } from "./nomenclature-dialog";
import { ToggleActive } from "./toggle-active";

export const metadata: Metadata = { title: "Réglages — Suivi de patrimoine" };

type Kind = "envelope" | "assetClass";

type NomenclatureItem = {
  id: string;
  name: string;
  color: string | null;
  ceilingAmount?: string | null;
  isActive: boolean;
};

function StatusBadge({ isActive }: { isActive: boolean }) {
  return isActive ? (
    <Badge variant="secondary">Active</Badge>
  ) : (
    <Badge variant="outline">Désactivée</Badge>
  );
}

function ItemActions({ kind, item }: { kind: Kind; item: NomenclatureItem }) {
  return (
    <>
      <NomenclatureDialog kind={kind} item={item} variant="ghost">
        Modifier
      </NomenclatureDialog>
      <ToggleActive scope={kind} id={item.id} isActive={item.isActive} />
    </>
  );
}

/**
 * Une section de nomenclature : enveloppes ou classes d'actifs.
 *
 * Les deux ne diffèrent que par leurs libellés et par la colonne « Plafond »,
 * propre aux enveloppes. Une seule implémentation évite qu'elles divergent —
 * c'est ainsi que la ligne désactivée s'était retrouvée grisée d'un côté
 * seulement, et par un attribut `data-inactive` qu'aucune règle CSS ne visait.
 */
function NomenclatureSection({
  kind,
  title,
  description,
  createLabel,
  items,
  showCeiling = false,
}: {
  kind: Kind;
  title: string;
  description: string;
  createLabel: string;
  items: NomenclatureItem[];
  showCeiling?: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
        <div className="ml-auto">
          <NomenclatureDialog kind={kind}>
            <PlusIcon data-icon="inline-start" />
            {createLabel}
          </NomenclatureDialog>
        </div>
      </CardHeader>
      <CardContent>
        {/*
          Sous md, la colonne Actions et ses deux boutons occupent 181 px
          incompressibles : avec le nom, le plafond et le statut, le tableau
          déborde de 141 px dans les 311 px d'un écran de téléphone. On bascule
          donc sur des cartes, comme le tableau de bord et /holdings. Rien n'y
          est masqué et il n'y a jamais à défiler latéralement.
        */}
        <ul className="flex flex-col gap-3 md:hidden">
          {items.map((item) => (
            <li
              key={item.id}
              className={cn(
                "rounded-lg border p-3",
                !item.isActive && "opacity-55",
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <span className="flex min-w-0 items-center gap-2 font-medium">
                  <ColorDot slot={item.color} />
                  {item.name}
                </span>
                <span className="shrink-0">
                  <StatusBadge isActive={item.isActive} />
                </span>
              </div>

              {showCeiling ? (
                <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                  Plafond
                  <span className="text-foreground tabular-nums">
                    {item.ceilingAmount ? formatEuro(item.ceilingAmount) : "—"}
                  </span>
                </p>
              ) : null}

              <div className="mt-3 flex flex-wrap items-center gap-1 border-t pt-2">
                <ItemActions kind={kind} item={item} />
              </div>
            </li>
          ))}
        </ul>

        <div className="hidden md:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nom</TableHead>
                {showCeiling ? (
                  <TableHead className="text-right">Plafond</TableHead>
                ) : null}
                <TableHead>Statut</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow
                  key={item.id}
                  className={item.isActive ? undefined : "opacity-55"}
                >
                  {/* Seule colonne à contenu libre : la seule à pouvoir revenir
                      à la ligne, sinon un nom long impose sa largeur au
                      tableau. */}
                  <TableCell className="w-full min-w-[8rem] font-medium whitespace-normal">
                    <span className="flex items-center gap-2">
                      <ColorDot slot={item.color} />
                      {item.name}
                    </span>
                  </TableCell>
                  {showCeiling ? (
                    <TableCell className="text-right tabular-nums">
                      {item.ceilingAmount ? formatEuro(item.ceilingAmount) : "—"}
                    </TableCell>
                  ) : null}
                  <TableCell>
                    <StatusBadge isActive={item.isActive} />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <ItemActions kind={kind} item={item} />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

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

      <NomenclatureSection
        kind="envelope"
        title="Enveloppes fiscales"
        description="Les contenants : Livret A, PEA, Assurance-Vie, CTO, PER…"
        createLabel="Nouvelle enveloppe"
        items={envelopes}
        showCeiling
      />

      <NomenclatureSection
        kind="assetClass"
        title="Classes d'actifs"
        description="La nature du risque : Actions, Immobilier, Or, Crypto…"
        createLabel="Nouvelle classe"
        items={assetClasses}
      />
    </div>
  );
}
