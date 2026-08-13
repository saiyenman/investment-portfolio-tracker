<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Suivi de patrimoine — contexte projet

App perso mono-utilisateur : répartition du patrimoine + aide au rééquilibrage.
UI, libellés, messages d'erreur et commentaires **en français**. Commentaires =
le *pourquoi* (contrainte, piège, décision), jamais la paraphrase du code.

## Stack

- Next.js 16 (canary) App Router · React 19 · TS strict · alias `@/*` → racine
- Tailwind v4 CSS-first — tout dans `app/globals.css` (`@theme inline`), **pas de `tailwind.config`**
- shadcn style `base-nova` sur **Base UI (`@base-ui/react`), pas Radix** · icônes lucide · next-themes · recharts
- Drizzle ORM + postgres.js sur Postgres Supabase · Supabase Auth (`@supabase/ssr`) uniquement pour l'auth
- decimal.js (monnaie) · zod v4 (entrées d'actions) · yahoo-finance2 (cours) · vitest

## Architecture

```
app/login/                 public (hors garde)
app/(app)/                 protégé — layout: `dynamic = "force-dynamic"` + getCurrentUser()
app/(app)/<route>/page.tsx Server Component async
           actions.ts      "use server" — mutations de la route
           *.tsx           "use client" colocalisés (dialogs, formulaires)
components/                UI partagée métier · components/ui/ primitives shadcn
lib/db/index.ts            getDb() paresseux+singleton (prepare:false, max:4 — pooler Supavisor)
lib/db/queries.ts          ★ TOUT le SQL, jamais ailleurs
lib/portfolio/             ★ moteur pur : valuation, rebalance, quotes, types — 0 import db/réseau
lib/quotes/                yahoo.ts (fetch brut) → service.ts (cache TTL 15 min + repli) → load.ts (entrée unique des écrans) · rates.ts (taux des devises de saisie)
lib/{format,parse,expression,sort,notify,action-state}.ts
proxy.ts                   ex-middleware.ts (Next 16) — export `proxy`, runtime nodejs
drizzle/                   SQL généré, appliqué à la main sur Supabase · tests/ vitest
```

- `import "server-only"` en tête de tout module serveur (`lib/db/*`, `lib/quotes/{service,load,rates}`).
- Les écrans lisent **toujours** `loadPortfolioWithQuotes()` / `listHoldingsWithQuotes()` — jamais `loadPortfolio()` ni `listHoldings()` en direct, sinon deux écrans divergent.
- Types du moteur (`lib/portfolio/types.ts`) structurels et minimaux, découplés de Drizzle.

## Données & état

- **Lecture** : Server Components async → `lib/quotes/load`. Aucun fetch client, aucun React Query, aucune route handler / API route.
- **Écriture** : Server Actions exclusivement. `useActionState(action, IDLE)` côté client.
- Forme d'action imposée : `(_previous: ActionState, formData: FormData)` → `requireUser()` → `zod.safeParse` → helpers `lib/parse` → `lib/db/queries` → `revalidatePath("/", "layout")` → `actionSuccess()`.
- `ActionState = { error, ok, at }` + `IDLE/actionSuccess/actionFailure` vivent dans `lib/action-state.ts` : un fichier `"use server"` ne peut exporter que des fonctions async (échec à l'exécution, pas au build).
- `at` (timestamp) obligatoire : sans lui deux succès identiques ne redéclenchent pas l'effet client (dialog qui ne se ferme pas).
- État d'UI persistant → **URL**, pas React : tri via `?tri=&sens=` (`lib/sort.ts`), la revalidation détruirait un état client.
- Retour utilisateur : `actionFailure("…")` pour une erreur attendue (message français, actionnable) ; `throw` pour l'inattendu ; codes PG mappés (`23505` → message métier). Toasts via `lib/notify`.

## Conventions

- **Monnaie** : `NUMERIC` en base → `string` à toutes les frontières → `Decimal` dans le moteur. `lib/format.ts` est le **seul** endroit où un montant redevient `number` (pour `Intl`, locale `fr-FR`). Jamais de `Number()` dans un calcul.
- Saisie : `parseDecimalInput` (virgule, espaces insécables), `evaluateAmount` (« 10x12,20 »). Le serveur recalcule toujours — les actions sont joignables par POST direct.
- Fonctions pures = paramètre `today` injecté, jamais `new Date()` interne (testabilité).
- Suppression **logique** partout (`isActive`) ; `sortOrder` sur chaque table ; UUID en PK.
- Fichiers kebab-case, composants PascalCase, TS camelCase ↔ colonnes snake_case.
- Tests : vitest node, `tests/**/*.test.ts`, uniquement le pur (`portfolio`, `format`, `sort`, `expression`), fixtures partagées, `describe/it` en français. Pas de test base ni UI.
- Migrations : modifier `lib/db/schema.ts` → `npm run db:generate` → appliquer le SQL sur Supabase. RLS active sur les 4 tables (défense en profondeur, l'app passe hors PostgREST).
- UI : `tabular-nums` sur tout chiffre en colonne ; palette `--chart-1…8` validée — **ne pas réordonner** ; toute visualisation doublée d'une légende chiffrée ou d'un tableau ; aucune bibliothèque d'animation ; navigation = `<Link className={buttonVariants()}>`, pas `<Button render={<Link/>}>` ; icônes avec `data-icon="inline-start"` ; bascule de thème sans état « monté » (icônes masquées en CSS).

## Modèle (4 tables + cache)

`envelopes` (enveloppes fiscales : PEA, AV, Livret A… avec `ceilingAmount` facultatif) → `holdings` → `asset_classes` (Actions, Immobilier, Or…). Une **ligne = un support DANS une enveloppe** : le même ETF en PEA et en AV fait deux lignes (unique `(envelope_id, name)`), aucune table de jonction. `allocation_targets` porte la cible en % par classe (PK = `asset_class_id`, remplacée en bloc). `quotes` = dernière cotation par symbole, à la fois cache TTL et valeur de repli ; les taux de change y sont des lignes ordinaires (`USDEUR=X`).

**Invariants** — (1) une seule formule de valorisation : `quantity × unitPrice` ; `inputMode: AMOUNT` stocke les euros dans `quantity` avec `unitPrice = 1` (Livret A, fonds euro), donc zéro cas particulier dans le code. (2) Aucune arithmétique flottante sur la monnaie. (3) On stocke des **positions**, pas un journal d'opérations : la répartition d'aujourd'hui ne dépend pas de l'historique.
