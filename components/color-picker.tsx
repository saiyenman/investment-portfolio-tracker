"use client";

import { CheckIcon } from "lucide-react";
import { useState } from "react";

import { PALETTE_SLOTS } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Sélecteur de couleur restreint aux huit slots de la palette catégorielle.
 *
 * Volontairement pas un sélecteur libre : l'ordre et les valeurs de ces slots
 * ont été validés (bande de clarté, séparation daltonisme, contraste) dans les
 * deux thèmes. Une couleur choisie librement casserait cette garantie.
 */
export function ColorPicker({
  name,
  defaultValue,
  label = "Couleur",
}: {
  name: string;
  defaultValue?: string | null;
  label?: string;
}) {
  const [selected, setSelected] = useState(defaultValue ?? PALETTE_SLOTS[0]);

  return (
    <>
      <input type="hidden" name={name} value={selected} />
      <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
        {PALETTE_SLOTS.map((slot, index) => (
          <button
            key={slot}
            type="button"
            role="radio"
            aria-checked={selected === slot}
            aria-label={`Couleur ${index + 1}`}
            onClick={() => setSelected(slot)}
            className={cn(
              "flex size-8 items-center justify-center rounded-md border transition-transform",
              selected === slot
                ? "ring-2 ring-ring ring-offset-2 ring-offset-background"
                : "hover:scale-110",
            )}
            style={{ backgroundColor: `var(--${slot})` }}
          >
            {selected === slot ? (
              <CheckIcon className="size-4 text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.6)]" />
            ) : null}
          </button>
        ))}
      </div>
    </>
  );
}

/** Pastille de couleur affichée à côté d'un libellé, dans les tableaux. */
export function ColorDot({ slot }: { slot: string | null }) {
  return (
    <span
      aria-hidden
      className="inline-block size-3 shrink-0 rounded-full"
      style={{ backgroundColor: `var(--${slot ?? "chart-1"})` }}
    />
  );
}
