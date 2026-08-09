import { InfoIcon } from "lucide-react";

import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

/**
 * Petite icône d'explication.
 *
 * Popover et non Tooltip : un tooltip ne s'ouvre qu'au survol et au focus,
 * jamais au clic — l'explication resterait donc hors de portée sur un écran
 * tactile. Le Popover de Base UI accepte `openOnHover`, ce qui donne les trois
 * accès d'un coup : souris, clavier (c'est un vrai bouton) et tactile, avec la
 * fermeture par Échap et par clic extérieur qui va avec.
 *
 * `delay` évite qu'elle ne s'ouvre en balayant la souris au-dessus d'une liste.
 */
export function InfoHint({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Popover>
      <PopoverTrigger
        openOnHover
        delay={200}
        // Le nom accessible ne peut pas être l'icône : elle est décorative.
        aria-label={`À propos de ${title}`}
        className={cn(
          "inline-flex shrink-0 cursor-help rounded-full text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
          className,
        )}
      >
        <InfoIcon className="size-4" aria-hidden />
      </PopoverTrigger>
      <PopoverContent className="max-w-[min(20rem,calc(100vw-2rem))]">
        <PopoverHeader>
          <PopoverTitle>{title}</PopoverTitle>
          <PopoverDescription>{children}</PopoverDescription>
        </PopoverHeader>
      </PopoverContent>
    </Popover>
  );
}
