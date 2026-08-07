import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Skills d'agents : dépendances outillées, pas du code applicatif.
    ".agents/**",
    // SQL généré par drizzle-kit et rejoué tel quel sur Supabase.
    "drizzle/**",
  ]),
]);

export default eslintConfig;
