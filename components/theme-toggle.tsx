"use client";

import { MonitorIcon, MoonIcon, SunIcon } from "lucide-react";
import { useTheme } from "next-themes";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const OPTIONS = [
  { value: "light", label: "Clair", icon: SunIcon },
  { value: "dark", label: "Sombre", icon: MoonIcon },
  { value: "system", label: "Système", icon: MonitorIcon },
] as const;

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="sm" aria-label="Changer de thème" />
        }
      >
        {/*
          Les deux icônes sont rendues, le CSS masque celle qui ne s'applique
          pas. Choisir en JavaScript imposerait un état « monté » — le serveur
          ignore la préférence système et le contenu de localStorage — donc un
          effet et un rendu intermédiaire. next-themes posant la classe sur
          <html> avant l'hydratation, la bonne icône est correcte dès la
          première peinture, sans état ni divergence.
        */}
        <SunIcon className="dark:hidden" />
        <MoonIcon className="hidden dark:block" />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end">
        <DropdownMenuGroup>
          {OPTIONS.map((option) => (
            <DropdownMenuItem
              key={option.value}
              onClick={() => setTheme(option.value)}
              // Le menu ne se rend qu'après ouverture, donc après hydratation :
              // lire `theme` ici ne crée aucune divergence.
              aria-current={theme === option.value ? "true" : undefined}
              className={
                theme === option.value ? "bg-accent font-medium" : undefined
              }
            >
              <option.icon />
              {option.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
