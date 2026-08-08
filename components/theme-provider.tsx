"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

/**
 * Fournisseur de thème.
 *
 * `attribute="class"` pose la classe `.dark` sur `<html>`, ce qu'attend la
 * variante déclarée dans globals.css : `@custom-variant dark (&:is(.dark *))`.
 * Sans elle, les jetons sombres — pourtant définis et validés — restaient
 * inatteignables.
 *
 * `disableTransitionOnChange` neutralise les transitions le temps de la bascule :
 * sinon chaque couleur s'anime séparément et le changement de thème donne un
 * effet de délavage.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}
