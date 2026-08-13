import { InfoHint } from "@/components/info-hint";
import { Badge } from "@/components/ui/badge";
import type { AppliedQuote } from "@/lib/portfolio/quotes";
import { formatEuro, formatNumber } from "@/lib/format";

/**
 * Cours issu du marché, avec le détail de sa provenance.
 *
 * Une valeur convertie qu'on ne peut pas vérifier n'a pas sa place sur un
 * écran de patrimoine : l'infobulle donne le cours d'origine, sa devise, le
 * taux appliqué et la date. Sans cela, un chiffre en euros pour une action
 * cotée à New York serait invérifiable — et une erreur de sens du taux
 * (0,87 au lieu de 1,15) passerait inaperçue.
 */
export function QuotedPrice({ quote }: { quote: AppliedQuote }) {
  const converted = quote.rate !== null;

  return (
    <span className="inline-flex items-center justify-end gap-1.5">
      <span className="font-medium tabular-nums">{formatEuro(quote.price)}</span>
      <InfoHint title={quote.symbol}>
        {converted ? (
          <>
            Coté {formatNumber(quote.sourcePrice)} {quote.sourceCurrency}, converti
            au taux {quote.rateSymbol} de {formatNumber(quote.rate!)}.
            <br />
            Cours du {formatDay(quote.asOf)}.
          </>
        ) : (
          <>Coté directement en euros. Cours du {formatDay(quote.asOf)}.</>
        )}
      </InfoHint>
    </span>
  );
}

/** Badge discret indiquant qu'une ligne suit le marché. */
export function QuoteBadge({ symbol }: { symbol: string }) {
  return (
    <Badge variant="outline" className="font-mono text-[0.7rem]">
      {symbol}
    </Badge>
  );
}

function formatDay(iso: string): string {
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "short" }).format(
    new Date(`${iso}T00:00:00Z`),
  );
}
