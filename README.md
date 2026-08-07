# Suivi de patrimoine

Application web personnelle pour connaître la répartition exacte de son
patrimoine et savoir comment la rééquilibrer.

**Principe directeur** — la répartition actuelle ne dépend pas de l'historique
des transactions, seulement de ce qui est détenu aujourd'hui. La V1 stocke donc
des **positions**, pas un journal d'opérations : 4 tables, et une saisie
initiale de quelques minutes.

## Démarrage

```bash
npm install
npm run dev
```

Deux prérequis avant que l'application affiche des données :

**1. Renseigner `DATABASE_URL` dans `.env.local`**
Supabase → Project Settings → Database → Connection string → *Transaction
pooler*, puis remplacer `[YOUR-PASSWORD]` par le mot de passe de la base. Les
autres variables sont déjà remplies (valeurs publiques du projet).

**2. Créer le compte d'accès**
Supabase → Authentication → Users → *Add user*, avec confirmation d'e-mail.
L'application est mono-utilisateur : désactivez les inscriptions publiques dans
Authentication → Sign In / Providers.

## Commandes

| Commande | Rôle |
|---|---|
| `npm run dev` | Serveur de développement (Turbopack) |
| `npm run build` | Build de production |
| `npm test` | Tests du moteur de calcul |
| `npm run lint` | ESLint |
| `npm run db:generate` | Régénère le SQL depuis le schéma Drizzle |

## Architecture

```
app/
  login/              Page de connexion (hors garde d'authentification)
  (app)/              Tout le reste, protégé
    page.tsx          Tableau de bord — synthèse, donuts, détail
    holdings/         CRUD des lignes de portefeuille
    rebalance/        Cibles, écarts, répartition d'un versement
    settings/         CRUD enveloppes et classes d'actifs
lib/
  db/schema.ts        Schéma Drizzle (source de vérité du modèle)
  db/queries.ts       ★ Tout le SQL — jamais dans les composants
  portfolio/          ★ Moteur de calcul — fonctions pures, 100 % testées
  supabase/           Clients d'authentification
proxy.ts              Garde d'accès (ex-middleware.ts, renommé en Next.js 16)
drizzle/              Migrations SQL + seed
tests/portfolio/      Fixtures et tests du moteur
```

### Les deux invariants du modèle

**Une seule formule de valorisation : `quantité × prix unitaire`.**
Le champ `input_mode` ne change que l'apparence du formulaire :

| Mode | Saisie | En base |
|---|---|---|
| `QUANTITY` | 12 parts × 485,20 € | `quantity=12`, `unit_price=485.20` |
| `AMOUNT` | Montant : 8 400 € | `quantity=8400`, `unit_price=1` |

Le Livret A et le fonds euro entrent ainsi dans le modèle sans aucun cas
particulier dans le code.

**Aucune arithmétique flottante sur la monnaie.**
`NUMERIC` en base, `Decimal` (decimal.js) dans le moteur, `string` aux
frontières. `lib/format.ts` est le seul endroit où un montant redevient un
`number`, pour `Intl`.

## Points d'attention métier

- **SCPI** : saisir la **valeur de retrait**, pas le prix de souscription
  (environ 10 % d'écart). Sinon le patrimoine est surestimé en permanence.
- **Fraîcheur** : au-delà de 90 jours, une ligne est signalée « à rafraîchir ».
  Une répartition calculée sur des cours périmés est fausse.
- **Frais de gestion d'assurance-vie** : non modélisés en V1 ; ils se
  répercutent quand vous mettez à jour la valeur de la ligne.

## Sécurité

- RLS activée sur les 4 tables, politique restreinte au rôle `authenticated`.
  L'application interroge Postgres côté serveur et n'y est pas soumise : c'est
  une défense en profondeur sur l'API PostgREST, publiquement exposée.
- `getUser()` (et non `getSession()`) partout : seul le premier revalide le
  jeton auprès de Supabase.
- Chaque Server Action vérifie l'authentification — elles sont joignables par
  POST direct, pas seulement via l'interface.
- Validation Zod en entrée de chaque action.

## Palette de graphiques

Les huit couleurs de `--chart-1` … `--chart-8` (dans `app/globals.css`) ont été
validées dans les deux thèmes : bande de clarté, plancher de chroma, séparation
daltonisme (pire paire adjacente ΔE 9,1 clair / 8,4 sombre) et contraste.
**L'ordre des slots est le mécanisme de sécurité, pas un choix esthétique** — ne
pas réordonner sans revalider. Trois slots clairs passent sous 3:1 de contraste :
d'où la légende porteuse de montants et le tableau détaillé, qui garantissent
que l'identité d'un segment ne repose jamais sur la seule couleur.

## Extensions prévues (non implémentées)

La V1 est conçue pour ne pas être un cul-de-sac :

- **V2 — cours automatiques** : table `prices` + `yahoo-finance2`, un appel par
  jour via GitHub Actions.
- **V3 — historisation** : `snapshots` mensuels, courbes d'évolution.
- **V4 — journal d'opérations** : `quantity` et `cost_basis` deviennent
  calculés ; migration par une transaction d'ouverture par ligne.

Ce qui rend ces ajouts indolores : tout le SQL est dans `lib/db/queries.ts`, le
moteur est constitué de fonctions pures, la suppression est logique partout, et
les identifiants sont des UUID.
