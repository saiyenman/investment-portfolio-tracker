import { defineConfig } from "drizzle-kit";

/**
 * `drizzle-kit generate` produit le SQL sans toucher à la base : c'est ce SQL
 * qui est ensuite appliqué sur Supabase et versionné dans ./drizzle.
 * `push` / `migrate` exigent en revanche DATABASE_URL (connexion directe,
 * port 5432 — le pooler ne supporte pas le DDL de la même façon).
 */
export default defineConfig({
  dialect: "postgresql",
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
});
