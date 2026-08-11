import { ArrowDownIcon, ArrowUpIcon, ChevronsUpDownIcon } from "lucide-react";
import Link from "next/link";

import { TableHead } from "@/components/ui/table";
import {
  ariaSort,
  sortHref,
  type SortDirection,
  type SortState,
} from "@/lib/sort";
import { cn } from "@/lib/utils";

/**
 * En-tête de colonne triable.
 *
 * Un lien et non un bouton : le tri est un état de l'URL, donc une
 * destination. Le clic milieu et « ouvrir dans un nouvel onglet » fonctionnent,
 * et la page reste rendue côté serveur.
 *
 * Trois signaux plutôt qu'un : `aria-sort` pour les lecteurs d'écran, une
 * flèche pour la colonne active, et un intitulé masqué qui annonce ce que fera
 * le clic — « Trier par valeur, ordre croissant » — car une flèche seule ne
 * dit pas si elle décrit l'état actuel ou l'action à venir.
 */
export function SortableHeader<K extends string>({
  columnKey,
  label,
  basePath,
  state,
  naturalDirection = "desc",
  className,
  align = "start",
}: {
  columnKey: K;
  label: string;
  basePath: string;
  state: SortState<K>;
  naturalDirection?: SortDirection;
  className?: string;
  align?: "start" | "end";
}) {
  const isActive = state.key === columnKey;
  const nextDirection = isActive
    ? state.direction === "asc"
      ? "desc"
      : "asc"
    : naturalDirection;

  const Icon = !isActive
    ? ChevronsUpDownIcon
    : state.direction === "asc"
      ? ArrowUpIcon
      : ArrowDownIcon;

  return (
    <TableHead className={className} aria-sort={ariaSort(columnKey, state)}>
      <Link
        href={sortHref(basePath, columnKey, naturalDirection, state)}
        scroll={false}
        className={cn(
          "-mx-1 inline-flex items-center gap-1 rounded px-1 py-0.5 transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
          align === "end" && "flex-row-reverse",
          isActive ? "text-foreground" : "text-muted-foreground",
        )}
      >
        {label}
        <Icon
          className={cn("size-3.5 shrink-0", !isActive && "opacity-50")}
          aria-hidden
        />
        <span className="sr-only">
          Trier par {label}, ordre{" "}
          {nextDirection === "asc" ? "croissant" : "décroissant"}
        </span>
      </Link>
    </TableHead>
  );
}
