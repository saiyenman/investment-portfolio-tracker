# Rapport d'implémentation — V1

*7 août 2026*

La V1 est implémentée. Le build passe, les 30 tests du moteur sont verts,
ESLint est propre et les advisors de sécurité Supabase ne remontent rien.

---

## Ce qui est vérifié

| Élément | Preuve |
|---|---|
| Schéma + RLS | 4 tables créées, RLS active sur chacune, advisors Supabase sans alerte |
| Seed | 3 enveloppes / 4 classes / 6 lignes, rejoué → toujours 3/4/6 |
| Moteur de calcul | 30 tests : poids = 100 %, mode `AMOUNT` exact, patrimoine nul sans division par zéro, versement réparti au centime près, plafond qui écrête, prorata quand plus aucun déficit |
| Authentification | `/` redirige vers `/login`, formulaire rendu, proxy en 5 ms, zéro erreur console |
| Requêtes de lecture | Jointures validées directement en base — forme conforme à ce que le moteur attend |
| Build | `next build` réussi ; les 4 pages de données sont dynamiques, le Proxy est enregistré |

### Détail des tests du moteur

Le moteur (`lib/portfolio/`) est constitué de fonctions pures, sans accès base.
C'est le seul code où une erreur passerait inaperçue : il est donc couvert
exhaustivement, sur un portefeuille de référence de 43 232,20 € réparti sur
3 enveloppes et 4 classes.

- **Valorisation** : `12 × 485,20 = 5 822,40` exact ; `3 × 0,1 = 0,30` (et non
  `0.30000000000000004`, ce que donnerait l'arithmétique flottante).
- **Agrégation** : aucune perte entre les lignes, les classes et les enveloppes ;
  les trois répartitions totalisent 100 %.
- **Plus-value** : calculée sur les seules lignes dont le coût est renseigné,
  jamais en comparant une valeur totale à un coût partiel.
- **Portefeuille vide** : `0,00 €`, pas de `NaN`, pas de division par zéro.
- **Fraîcheur** : bascule pile au franchissement du seuil (89 jours → non,
  90 jours → oui) ; une ligne sans cours saisi n'est jamais signalée.
- **Rééquilibrage** : la somme des allocations proposées égale exactement le
  montant saisi, y compris quand il ne se divise pas (1 000 € sur trois classes
  → 333,34 + 333,33 + 333,33) ; l'écart de la classe la plus en retard diminue
  effectivement après application du plan.

---

## Ce qui n'est pas vérifié

**Les quatre pages qui lisent la base n'ont jamais tourné contre une connexion
réelle.** Elles compilent et sont typées de bout en bout, mais elles n'ont pas
été exécutées : `DATABASE_URL` n'est pas renseignée et aucun compte
d'authentification n'existe encore.

Restent donc à dérouler une fois ces deux éléments en place :

1. Création d'un CTO et d'une classe « Crypto » depuis l'interface, sans toucher
   au code, et vérification qu'ils apparaissent dans les deux donuts.
2. Saisie d'une ligne réelle et contrôle du total affiché.
3. Modification d'un cours → cohérence du total, des donuts et des écarts.
4. Cibles ne totalisant pas 100 % → refus à l'enregistrement.
5. Répartition d'un versement, application, réduction effective des écarts.
6. Cours ramené à plus de 90 jours → apparition de la pastille d'alerte.
7. Désactivation d'une classe encore utilisée → refus explicite, pas d'erreur SQL.

---

## Prérequis restants

Les deux relèvent de l'utilisateur.

**1. `DATABASE_URL` dans `.env.local`** — la ligne est présente, vide.
Supabase → Project Settings → Database → Connection string → *Transaction
pooler*, avec le mot de passe de la base. Le mot de passe n'est pas manipulé par
l'assistant : il est déposé dans le fichier et lu depuis le code sans jamais
être affiché.

**2. Le compte d'accès** — `auth.users` est vide. Supabase → Authentication →
Users → *Add user*. Penser à désactiver les inscriptions publiques dans
Sign In / Providers, l'application étant mono-utilisateur.

---

## Trois décisions à connaître

### Un bug attrapé au passage

En mode « Montant », le champ modifiable du tableau de bord porte des euros (la
quantité), pas un cours. L'action l'écrivait dans `unit_price` — un Livret A à
8 400 € serait devenu 70 millions, puisque la valeur vaut quantité × prix.
L'action reçoit désormais le mode de saisie et écrit dans la bonne colonne.

### Palette de graphiques

Les couleurs de graphique par défaut de shadcn sont en niveaux de gris avec la
base `neutral` — inutilisables pour distinguer des catégories. Elles ont été
remplacées par huit teintes validées dans les deux thèmes : bande de clarté,
plancher de chroma, séparation daltonisme (pire paire adjacente ΔE 9,1 en clair
/ 8,4 en sombre) et contraste vis-à-vis de la surface.

**L'ordre des slots est le mécanisme de sécurité, pas un choix esthétique** — ne
pas réordonner sans revalider. Trois slots clairs passent sous 3:1 de contraste :
d'où la légende porteuse de montants et le tableau détaillé, qui garantissent
que l'identité d'un segment ne repose jamais sur la seule couleur.

### Plafond d'enveloppe

Le plafond n'écrête réellement une classe que si **toutes** ses lignes vivent
dans des enveloppes plafonnées. Les liquidités étant aussi logées en fonds euro
(sans plafond), leur capacité reste illimitée — c'est le comportement correct, et
la marge du Livret A s'affiche séparément sur le tableau de bord.

Limite connue, documentée dans le code : deux classes plafonnées partageant la
même enveloppe verraient leurs capacités se recouvrir, et la somme proposée
pourrait dépasser le plafond réel. Configuration rare, non traitée en V1.

---

## Périmètre

L'application calcule et affiche des données saisies par l'utilisateur.
L'outil de rééquilibrage applique une règle arithmétique de convergence vers
**les cibles que l'utilisateur définit lui-même**. Ni le code ni ce rapport ne
comportent de recommandation d'allocation ou de conseil en investissement.
