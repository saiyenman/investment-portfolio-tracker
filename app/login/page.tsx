import type { Metadata } from "next";

import { ThemeToggle } from "@/components/theme-toggle";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Connexion — Suivi de patrimoine",
};

export default function LoginPage() {
  return (
    <main className="relative flex min-h-svh items-center justify-center p-6">
      {/* Le sélecteur est aussi ici : sans lui, impossible de changer de thème
          avant d'être authentifié. */}
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Suivi de patrimoine</CardTitle>
          <CardDescription>
            Application personnelle — accès réservé.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LoginForm />
        </CardContent>
      </Card>
    </main>
  );
}
