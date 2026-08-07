import "server-only";

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

/**
 * Client Postgres de l'application.
 *
 * Trois réglages, tous imposés par le pooler Supabase (Supavisor) :
 *
 * 1. `prepare: false` — le pooler transactionnel (port 6543) ne supporte pas
 *    les requêtes préparées. Sans ce réglage, les requêtes échouent avec
 *    « prepared statement already exists ».
 *
 * 2. `max: 4` — et surtout PAS 1. postgres.js pipeline les requêtes
 *    concurrentes sur une même connexion, ce que Supavisor en mode
 *    transaction ne gère pas : la transaction reste ouverte côté serveur en
 *    attente `ClientRead`, et la requête finit annulée par le statement
 *    timeout. Observé en conditions réelles : `loadPortfolio()` lance quatre
 *    requêtes en parallèle, ce qui suffisait à bloquer la page 36 secondes.
 *    Avec un pool, chaque requête concurrente obtient sa propre connexion et
 *    aucun pipelining n'a lieu. Le chiffre couvre les quatre requêtes
 *    parallèles de `loadPortfolio()`.
 *
 * 3. `idle_timeout` — les connexions inactives sont rendues au pooler plutôt
 *    que gardées ouvertes entre deux consultations.
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
  const client = postgres(url, {
    prepare: false,
    max: 4,
    idle_timeout: 20,
    connect_timeout: 10,
  });
  return drizzle(client, { schema });
}

export function getDb() {
  // Réutilisé entre les rechargements à chaud du serveur de développement,
  // sinon chaque édition de fichier ouvrirait un nouveau pool.
  globalForDb.__portfolioDb ??= createClient();
  return globalForDb.__portfolioDb;
}

export { schema };
