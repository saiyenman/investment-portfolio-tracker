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
        "inline-flex items-center gap-1.5 tabular-nums",
        size === "lg" ? "text-2xl font-semibold" : "text-sm",
        tone,
        className,
      )}
    >
      <Icon className={size === "lg" ? "size-5" : "size-3.5"} aria-hidden />
      <span className="sr-only">{label} : </span>
      <span>{formatSignedEuro(amount)}</span>
      {pct !== null && pct !== undefined ? (
        <span className="text-xs opacity-80">
          ({pct > 0 ? "+" : ""}
          {formatPct(pct)})
        </span>
      ) : null}
    </span>
  );
}
