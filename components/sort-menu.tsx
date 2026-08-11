import { ArrowDownIcon, ArrowUpIcon, ArrowUpDownIcon } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { sortHref, type SortDirection, type SortState } from "@/lib/sort";

export type SortColumn<K extends string> = {
  key: K;
  label: string;
  naturalDirection?: SortDirection;
};

/**
 * Choix du tri là où il n'y a pas d'en-têtes de colonnes.
 *
 * Sous md les deux écrans basculent en liste de cartes : les cartes suivent
 * bien l'ordre demandé, mais sans ce menu il n'y aurait aucun moyen de le
 * changer depuis un téléphone. Les entrées sont des liens, comme les en-têtes
 * — le tri reste un état de l'URL, pas un état client.
 */
export function SortMenu<K extends string>({
  columns,
  basePath,
  state,
  className,
}: {
  columns: SortColumn<K>[];
  basePath: string;
  state: SortState<K>;
  className?: string;
}) {
  const active = columns.find((c) => c.key === state.key);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="outline" size="sm" className={className} />}
      >
        <ArrowUpDownIcon data-icon="inline-start" />
        {active ? `Trié par ${active.label.toLowerCase()}` : "Trier"}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Trier par</DropdownMenuLabel>
        {columns.map((column) => {
          const isActive = state.key === column.key;
          const Icon = state.direction === "asc" ? ArrowUpIcon : ArrowDownIcon;
          return (
            <DropdownMenuItem
              key={column.key}
              render={
                <Link
                  href={sortHref(
                    basePath,
                    column.key,
                    column.naturalDirection ?? "desc",
                    state,
                  )}
                  scroll={false}
                />
              }
            >
              {column.label}
              {isActive ? (
                <Icon className="ml-auto size-3.5" aria-hidden />
              ) : null}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
