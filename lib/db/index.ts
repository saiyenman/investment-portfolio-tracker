import "server-only";

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

/**
 * Client Postgres de l'application.
 *
 * Deux points spécifiques à Supabase :
 *
 * 1. `prepare: false` — le pooler transactionnel (port 6543) ne supporte pas
 *    les requêtes préparées. Sans ce réglage, les requêtes échouent de façon
 *    déroutante ("prepared statement already exists"). Le coût est nul sur une
 *    charge personnelle.
 * 2. `max: 1` — en environnement serverless chaque instance ouvre son propre
 *    pool ; un pool large par instance saturerait la base.
 *
 * L'initialisation est paresseuse : sans cela, `next build` échouerait dès
 * qu'une page est préchargée sans DATABASE_URL dans l'environnement.
 */

const globalForDb = globalThis as unknown as {
  __portfolioDb?: ReturnType<typeof createClient>;
};

function createClient() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL est absente. Renseignez-la dans .env.local " +
        "(Supabase → Project Settings → Database → Connection string → Transaction pooler).",
    );
  }
  const client = postgres(url, { prepare: false, max: 1 });
  return drizzle(client, { schema });
}

export function getDb() {
  // Réutilisé entre les rechargements à chaud du serveur de développement,
  // sinon chaque édition de fichier ouvrirait un nouveau pool.
  globalForDb.__portfolioDb ??= createClient();
  return globalForDb.__portfolioDb;
}

export { schema };
