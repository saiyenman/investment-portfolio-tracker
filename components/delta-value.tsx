import { MinusIcon, TrendingDownIcon, TrendingUpIcon } from "lucide-react";

import { formatPct, formatSignedEuro } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Plus-value ou moins-value.
 *
 * Trois canaux redondants plutôt qu'un seul : le signe (+/−), une icône
 * directionnelle et la couleur. Sur une application dont c'est précisément la
 * fonction, un gain et une perte ne peuvent pas se ressembler — et la couleur
 * seule ne suffit pas, environ 8 % des hommes ne distinguent pas le rouge du
 * vert. Un libellé masqué complète l'annonce pour les lecteurs d'écran.
 */
export function DeltaValue({
  amount,
  pct,
  size = "sm",
  className,
}: {
  amount: string | null;
  pct?: number | null;
  size?: "sm" | "lg";
  className?: string;
}) {
  if (amount === null || amount === undefined) {
    return <span className="text-muted-foreground">—</span>;
  }

  const value = Number(amount);
  const direction = value > 0 ? "up" : value < 0 ? "down" : "flat";
  const Icon =
    direction === "up"
      ? TrendingUpIcon
      : direction === "down"
        ? TrendingDownIcon
        : MinusIcon;

  const tone = {
    up: "text-(--positive)",
    down: "text-(--negative)",
    flat: "text-muted-foreground",
  }[direction];

  const label = { up: "Gain", down: "Perte", flat: "Stable" }[direction];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-x-1.5 gap-y-0 tabular-nums",
        // En grande taille — les tuiles de synthèse — « +3 543,22 € (+17,3 %) »
        // ne tient pas sur une ligne : le pourcentage passe à la ligne d'un
        // bloc plutôt que d'être rogné par le bord de la carte. En petite
        // taille, dans le tableau, la colonne a la place : on garde une ligne.
        size === "lg" ? "flex-wrap text-2xl font-semibold" : "text-sm",
        tone,
        className,
      )}
    >
      <Icon className={size === "lg" ? "size-5" : "size-3.5"} aria-hidden />
      <span className="sr-only">{label} : </span>
      <span>{formatSignedEuro(amount)}</span>
      {pct !== null && pct !== undefined ? (
        // Insécable : sans cela le pourcentage se coupe entre la virgule et le
        // signe « % » dans les tuiles étroites — « (+17, » / « %) ».
        <span className="whitespace-nowrap text-xs opacity-80">
          ({pct > 0 ? "+" : ""}
          {formatPct(pct)})
        </span>
      ) : null}
    </span>
  );
}
