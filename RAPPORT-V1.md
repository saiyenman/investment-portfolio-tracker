# Rapport d'implémentation — V1

*7 août 2026 — vérification de bout en bout terminée*

La V1 est implémentée et **vérifiée dans le navigateur contre la base réelle**.
Build en 12 s, 35 tests verts, ESLint et TypeScript propres.

---

## 1. Vérification de bout en bout

Les sept points prévus ont été déroulés dans l'interface, connecté, sur la base
de production.

| # | Vérification | Résultat observé |
|---|---|---|
| 1 | Créer une enveloppe « CTO (test) » et une classe « Crypto (test) » depuis `/settings` | Créées sans toucher au code, avec les bons slots de palette. Apparaissent immédiatement dans les listes déroulantes et dans les deux donuts. |
| 2 | Saisir deux lignes (une en parts × cours, une en montant) | Total 4 000 €, poids 75 % / 25 %. Le mode Montant a bien figé `unit_price = 1` et stocké 3 000 en quantité. |
| 3 | Modifier un cours depuis le tableau de bord | 100 → 200 : patrimoine 4 000 → 5 000 €, poids recalculés à 60 / 40, centre du donut mis à jour. |
| 4 | Cibles totalisant 99 % | « 99 % — doit faire 100 % » en rouge, bouton d'enregistrement désactivé. |
| 5 | Cibles à 100 %, puis répartition de 500 € | Écarts chiffrés à −20 pt / +20 pt. Les 500 € vont intégralement à la classe en retard, total réparti exact. |
| 6 | Cours daté de plus de 90 jours | Badge « Valeur du 01/01/2026 » sur la ligne, et bandeau « 1 valeur à rafraîchir » sur le tableau de bord. |
| 7 | Désactiver une classe encore utilisée | Refus explicite en toast : « Impossible de désactiver cette classe : 1 ligne active y est rattachée. » Aucune erreur SQL, la classe reste active. |

**Couche de données**, vérifiée en exécutant le code de production contre la
base : schéma Drizzle aligné (3 enveloppes, 4 classes, 6 lignes lues), `NUMERIC`
renvoyé en `string` — la discipline anti-flottant tient de bout en bout —,
écriture effective, déclencheur `updated_at` fonctionnel, contrainte `CHECK`
rejetant une quantité négative.

**Nettoyage effectué** : les deux lignes de test ont été supprimées via
l'interface, les cibles remises à zéro, et l'enveloppe et la classe de test
désactivées. Le portefeuille est revenu à son état initial : 6 lignes, 4
classes, 3 enveloppes, total à 0 €. Aucun montant n'a été inventé sur vos lignes
réelles.

> « CTO (test) » et « Crypto (test) » restent présentes mais **désactivées** :
> l'application ne propose que la désactivation pour la nomenclature, jamais la
> suppression, afin de ne pas trouer l'historique. Vous pouvez les supprimer
> définitivement depuis Supabase si vous préférez.

---

## 2. Bugs trouvés et corrigés pendant la vérification

Cinq défauts réels, dont trois qu'aucun test ni le build ne pouvaient attraper.

### `"use server"` n'accepte que des fonctions asynchrones

Mes trois fichiers d'actions exportaient `IDLE`, une constante. React lève
alors « A "use server" file can only export async functions, found object » —
**à l'évaluation du module, pas à la compilation**. Le build passait, la page
plantait au premier clic. Corrigé en déplaçant l'état partagé dans
`lib/action-state.ts`.

### Le pooler Supabase et le pipelining de postgres.js

`/settings` mettait **36 secondes**, et une requête sur une table de trois
lignes finissait annulée par un *statement timeout*. Diagnostic : une session
active depuis deux minutes, en attente `ClientRead` avec une transaction
ouverte.

Cause : `max: 1` sur le client postgres.js. Les quatre requêtes parallèles de
`loadPortfolio()` étaient alors *pipelinées* sur une connexion unique, ce que
Supavisor en mode transaction ne gère pas. Corrigé par un vrai pool (`max: 4`) :
chaque requête concurrente obtient sa propre connexion. **36 s → 418 ms.**

### Le build tentait de pré-rendre les pages dynamiques

`next build` lançait neuf workers, chacun ouvrant une connexion pour générer des
pages qui lisent le portefeuille en direct. `/settings` dépassait 60 s et devait
être réessayé. Corrigé par `export const dynamic = "force-dynamic"` sur le
layout applicatif. **Build 62 s → 12 s**, génération de pages 62 s → 1 s.

### Le mode Montant écrivait dans la mauvaise colonne

Le champ modifiable du tableau de bord porte des euros en mode Montant, pas un
cours. L'action l'écrivait dans `unit_price` : un Livret A à 8 400 € serait
devenu 70 millions, la valeur étant quantité × prix. L'action reçoit désormais
le mode de saisie.

### Défauts d'interface

- Les champs de saisie affichaient les `NUMERIC` bruts (`0.00000000`,
  `485.20000000`). Ajout de `toDecimalInput`, couvert par cinq tests dont le
  piège de la regex trop gourmande qui transformerait « 100 » en « 1 ».
- La confirmation de suppression n'était pas contrôlée : elle serait restée
  ouverte au-dessus d'une ligne qui n'existe plus.

---

## 3. Ce qui reste à votre main

**Protection contre les mots de passe compromis.** L'audit de sécurité Supabase
remonte un avertissement : *Leaked Password Protection Disabled*. Activable en
un clic — Authentication → Policies — pour que Supabase vérifie les mots de
passe contre HaveIBeenPwned. C'est un réglage de votre projet, je n'y touche pas.

**Inscriptions publiques.** À désactiver dans Authentication → Sign In /
Providers si ce n'est pas déjà fait : l'application est mono-utilisateur.

---

## 4. État des vérifications automatiques

| Contrôle | Résultat |
|---|---|
| `npm test` | 35 tests, 3 fichiers — tous verts |
| `npx tsc --noEmit` | 0 erreur |
| `npx eslint .` | 0 erreur, 0 avertissement |
| `npm run build` | Succès en 12 s |
| Advisors sécurité Supabase | 1 avertissement (mots de passe compromis, ci-dessus) |
| RLS | Active sur les 4 tables, politique restreinte au rôle `authenticated` |

### Ce que couvrent les 35 tests

Le moteur (`lib/portfolio/`) est constitué de fonctions pures, sans accès base.
C'est le seul code où une erreur passerait inaperçue.

- **Valorisation** : `12 × 485,20 = 5 822,40` exact ; `3 × 0,1 = 0,30` et non
  `0.30000000000000004`.
- **Agrégation** : aucune perte entre lignes, classes et enveloppes ; les trois
  répartitions totalisent 100 %.
- **Plus-value** : calculée sur les seules lignes dont le coût est renseigné.
- **Portefeuille vide** : `0,00 €`, pas de `NaN`, pas de division par zéro.
- **Fraîcheur** : bascule pile au seuil (89 jours non, 90 jours oui) ; une ligne
  sans cours saisi n'est jamais signalée.
- **Rééquilibrage** : somme des allocations exactement égale au montant saisi, y
  compris quand il ne se divise pas (1 000 € sur trois classes → 333,34 +
  333,33 + 333,33) ; l'écart de la classe la plus en retard diminue après
  application ; bascule au prorata quand plus aucune classe n'est en retard ;
  écrêtage par plafond avec reliquat signalé.
- **Formatage** : aller-retour sans perte entre l'affichage et la relecture —
  rouvrir une ligne et enregistrer sans rien changer ne doit rien altérer.

---

## 5. Périmètre

L'application calcule et affiche des données saisies par l'utilisateur.
L'outil de rééquilibrage applique une règle arithmétique de convergence vers
**les cibles que l'utilisateur définit lui-même**. Ni le code ni ce rapport ne
comportent de recommandation d'allocation ou de conseil en investissement.
