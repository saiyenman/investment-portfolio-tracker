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
    ".claude/**",
    // SQL généré par drizzle-kit et rejoué tel quel sur Supabase.
    "drizzle/**",
  ]),
  {
    rules: {
      /*
        Les Server Actions reçoivent `(état, formData)` de useActionState :
        la signature est imposée, même quand l'action n'a que faire de l'un
        des deux. Le préfixe `_` est la convention déjà suivie partout ici
        (`_previous`) ; la règle par défaut ne la voyait que lorsqu'un
        paramètre utilisé suivait.
      */
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
]);

export default eslintConfig;
