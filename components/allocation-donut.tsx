"use client";

import { Cell, Pie, PieChart } from "recharts";

import {
  ChartContainer,
  ChartTooltip,
  type ChartConfig,
} from "@/components/ui/chart";
import { formatEuro, formatEuroCompact, formatPct } from "@/lib/format";
import type { Breakdown } from "@/lib/portfolio/types";

/**
 * Donut de répartition.
 *
 * Choix issus de la validation de palette :
 * — la légende est TOUJOURS présente et porte les montants, ce qui satisfait la
 *   « règle de relief » : trois slots clairs passent sous 3:1 de contraste sur
 *   fond blanc, l'identité ne peut donc pas reposer sur la seule couleur ;
 * — un liseré de 2 px à la couleur de la surface sépare les segments, pour que
 *   deux teintes voisines ne se touchent jamais ;
 * — les segments arrivent déjà triés par valeur décroissante.
 */
export function AllocationDonut({
  items,
  total,
  title,
  emptyLabel = "Aucune donnée",
}: {
  items: Breakdown[];
  total: string;
  title: string;
  emptyLabel?: string;
}) {
  if (items.length === 0 || Number(total) <= 0) {
    return (
      <p className="py-12 text-center text-sm text-muted-foreground">
        {emptyLabel}
      </p>
    );
  }

  const data = items.map((item, index) => ({
    id: item.id,
    name: item.name,
    amount: item.value,
    value: Number(item.value),
    pct: item.weightPct,
    fill: `var(--${item.color ?? `chart-${(index % 8) + 1}`})`,
  }));

  const config: ChartConfig = Object.fromEntries(
    data.map((entry) => [entry.id, { label: entry.name, color: entry.fill }]),
  );

  return (
    <div className="flex flex-col gap-4">
      <ChartContainer
        config={config}
        className="mx-auto aspect-square max-h-[220px] w-full"
      >
        <PieChart>
          <ChartTooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const entry = payload[0]!.payload as (typeof data)[number];
              return (
                <div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-md">
                  <p className="font-medium text-popover-foreground">
                    {entry.name}
                  </p>
                  <p className="tabular-nums text-muted-foreground">
                    {formatEuro(entry.amount)} · {formatPct(entry.pct)}
                  </p>
                </div>
              );
            }}
          />
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius="58%"
            outerRadius="88%"
            paddingAngle={2}
            strokeWidth={2}
            stroke="var(--card)"
            isAnimationActive={false}
          >
            {data.map((entry) => (
              <Cell key={entry.id} fill={entry.fill} />
            ))}
          </Pie>
          <text
            x="50%"
            y="50%"
            textAnchor="middle"
            dominantBaseline="middle"
            className="fill-foreground text-lg font-semibold tabular-nums"
          >
            {formatEuroCompact(total)}
          </text>
        </PieChart>
      </ChartContainer>

      {/* Légende porteuse des valeurs : c'est elle qui rend l'identité des
          segments lisible sans dépendre de la couleur seule. */}
      <ul aria-label={`Détail — ${title}`} className="flex flex-col gap-1.5">
        {data.map((entry) => (
          <li
            key={entry.id}
            className="flex items-center justify-between gap-3 text-sm"
          >
            <span className="flex min-w-0 items-center gap-2">
              <span
                aria-hidden
                className="size-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: entry.fill }}
              />
              <span className="truncate">{entry.name}</span>
            </span>
            <span className="flex shrink-0 items-center gap-3 tabular-nums">
              <span className="text-muted-foreground">
                {formatEuro(entry.amount)}
              </span>
              <span className="w-14 text-right font-medium">
                {formatPct(entry.pct)}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
