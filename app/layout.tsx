import type { Metadata } from "next";
import { Inter } from "next/font/google";

import { ThemeProvider } from "@/components/theme-provider";

import "./globals.css";

/**
 * Inter plutôt que Geist ou Roboto.
 *
 * Dessinée pour l'interface : hauteur d'x généreuse, formes ouvertes, lisible
 * en petit corps. Surtout, ses chiffres tabulaires sont exemplaires — c'est ce
 * qui aligne verticalement les colonnes de montants, condition de toute lecture
 * comparative dans un tableau financier.
 *
 * `display: "swap"` affiche immédiatement la police de repli puis substitue :
 * on évite le texte invisible au chargement (FOIT).
 */
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Suivi de patrimoine",
  description:
    "Suivi de la répartition du patrimoine et aide au rééquilibrage.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // suppressHydrationWarning : next-themes pose la classe de thème sur <html>
    // avant l'hydratation, ce que React signalerait sinon comme une divergence.
    <html
      lang="fr"
      suppressHydrationWarning
      className={`${inter.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
