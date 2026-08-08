# Design System Master File

> **LOGIC:** When building a specific page, first check `design-system/pages/[page-name].md`.
> If that file exists, its rules **override** this Master file.
> If not, strictly follow the rules below.

---

**Project:** Suivi de patrimoine
**Generated:** 2026-08-08 13:41:18
**Category:** Financial Dashboard
**Design Dials:** Variance 3/10 (Centered / Minimal) | Motion 3/10 (Subtle) | Density 8/10 (Dense / Dashboard)

---

## Global Rules

### Color Palette

| Role | Hex | CSS Variable |
|------|-----|--------------|
| Primary | `#18181B` | `--color-primary` |
| On Primary | `#FFFFFF` | `--color-on-primary` |
| Secondary | `#3F3F46` | `--color-secondary` |
| Accent/CTA | `#2563EB` | `--color-accent` |
| Background | `#FAFAFA` | `--color-background` |
| Foreground | `#09090B` | `--color-foreground` |
| Muted | `#E8ECF0` | `--color-muted` |
| Border | `#E4E4E7` | `--color-border` |
| Destructive | `#DC2626` | `--color-destructive` |
| Ring | `#18181B` | `--color-ring` |

**Color Notes:** Monochrome + blue accent

### Typography

- **Police unique :** **Inter** (variable), chargée via `next/font/google` avec
  `display: "swap"` — pas d'`@import` CSS, qui bloquerait le rendu.
- **Monospace :** pile système (`ui-monospace, SFMono-Regular, Menlo…`), aucune
  webfont supplémentaire ; elle ne sert qu'à la marge.

> **Écarté du générateur : Fira Sans + Fira Code.**
> Le couple convient à un tableau de bord, mais imposait deux webfonts dont une
> police de code en titrage — usage détourné, ligatures comprises. Inter couvre
> seule les deux rôles : dessinée pour l'interface, hauteur d'x généreuse, et
> des chiffres tabulaires exemplaires. C'est ce dernier point qui compte ici :
> sans chiffres de largeur fixe, les colonnes de montants ne s'alignent pas.

**Échelle** (redéfinie dans `app/globals.css`, un cran au-dessus des défauts
Tailwind — 12/14/16 était trop juste pour un écran qu'on lit longuement) :

| Palier | Taille | Interligne | Usage |
|---|---|---|---|
| `text-xs` | 13 px | 1.45 | Libellés secondaires |
| `text-sm` | 15 px | 1.5 | Corps de tableau, boutons |
| `text-base` | 17 px | 1.6 | Texte courant |
| `text-lg` | 19 px | 1.55 | — |
| `text-xl` | 22 px | 1.4 | — |
| `text-2xl` | 26 px | 1.3 | Titres de page |
| `text-3xl` | 32 px | 1.25 | Chiffres de synthèse |

L'échelle est modifiée au niveau du thème, jamais composant par composant : les
espacements restent inchangés, donc la densité 8/10 est préservée.

**Piège corrigé :** `--font-sans` était auto-référentiel (`var(--font-sans)`)
alors que le layout exposait `--font-geist-sans`. La variable ne résolvait rien
et l'application entière tombait sur la police de repli du navigateur. Toute
nouvelle police doit être exposée sous un nom distinct (`--font-inter`) et
référencée explicitement dans `@theme inline`.

### Spacing Variables

*Density: 8/10 — Dense / Dashboard*

| Token | Value | Usage |
|-------|-------|-------|
| `--space-xs` | `2px` / `0.125rem` | Tight gaps |
| `--space-sm` | `4px` / `0.25rem` | Icon gaps, inline spacing |
| `--space-md` | `8px` / `0.5rem` | Standard padding |
| `--space-lg` | `12px` / `0.75rem` | Section padding |
| `--space-xl` | `16px` / `1rem` | Large gaps |
| `--space-2xl` | `24px` / `1.5rem` | Section margins |
| `--space-3xl` | `32px` / `2rem` | Hero padding |

### Shadow Depths

| Level | Value | Usage |
|-------|-------|-------|
| `--shadow-sm` | `0 1px 2px rgba(0,0,0,0.05)` | Subtle lift |
| `--shadow-md` | `0 4px 6px rgba(0,0,0,0.1)` | Cards, buttons |
| `--shadow-lg` | `0 10px 15px rgba(0,0,0,0.1)` | Modals, dropdowns |
| `--shadow-xl` | `0 20px 25px rgba(0,0,0,0.15)` | Hero images, featured cards |

---

## Component Specs

### Buttons

```css
/* Primary Button */
.btn-primary {
  background: #2563EB;
  color: white;
  padding: 12px 24px;
  border-radius: 8px;
  font-weight: 600;
  transition: all 200ms ease;
  cursor: pointer;
}

.btn-primary:hover {
  opacity: 0.9;
  transform: translateY(-1px);
}

/* Secondary Button */
.btn-secondary {
  background: transparent;
  color: #18181B;
  border: 2px solid #18181B;
  padding: 12px 24px;
  border-radius: 8px;
  font-weight: 600;
  transition: all 200ms ease;
  cursor: pointer;
}
```

### Cards

Les cartes de cette application sont des **conteneurs, pas des contrôles** : on
ne clique pas dessus. Elles ne portent donc ni `cursor: pointer`, ni état de
survol.

```css
.card {
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 16px;            /* densité 8/10 : 16 px, pas 24 */
  box-shadow: var(--shadow-sm);
}
```

> **Corrigé depuis la sortie du générateur.** Sa spec proposait
> `cursor: pointer` sur toutes les cartes et un `transform: translateY(-2px)`
> au survol. Le premier annonce une interaction qui n'existe pas ; le second
> viole la règle « Layout-shifting hovers » listée plus bas dans ce même
> fichier. Les deux ont été retirés.

### Inputs

```css
.input {
  padding: 12px 16px;
  border: 1px solid #E2E8F0;
  border-radius: 8px;
  font-size: 16px;
  transition: border-color 200ms ease;
}

.input:focus {
  border-color: #18181B;
  outline: none;
  box-shadow: 0 0 0 3px #18181B20;
}
```

### Modals

```css
.modal-overlay {
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
}

.modal {
  background: white;
  border-radius: 16px;
  padding: 32px;
  box-shadow: var(--shadow-xl);
  max-width: 500px;
  width: 90%;
}
```

---

## Style Guidelines

**Style:** Dense data dashboard — sober, high-contrast, typographically quiet.

**Keywords:** data-first, calm, high legibility, tight vertical rhythm, restrained accent.

> **Écarté du générateur : « Exaggerated Minimalism ».**
> Il prescrit `font-size: clamp(3rem, 10vw, 12rem)`, `font-weight: 900` et « massive
> whitespace », et se destine à la mode, au luxe et aux pages d'agence. C'est
> incompatible avec le curseur Densité 8/10 retenu plus haut : sur un tableau de
> 8 lignes × 7 colonnes, une typographie géante détruit la comparabilité des
> chiffres, qui est la fonction même de l'écran. Le produit gagne sa crédibilité
> par la lisibilité des nombres, pas par une déclaration graphique.

**Règles typographiques effectives :**

| Rôle | Taille | Poids |
|---|---|---|
| Titre de page | 24 px (`text-2xl`) | 600 |
| Titre de carte | 16 px | 600 |
| Chiffre de synthèse | 24–30 px, `tabular-nums` | 600 |
| Corps / tableau | 14 px | 400 |
| Libellé secondaire | 12–13 px, `text-muted-foreground` | 400 |

Tout nombre affiché en colonne porte `tabular-nums` : sans chiffres de largeur
fixe, les montants ne s'alignent pas verticalement et la lecture comparative
devient impossible.

### Page Pattern

**Pattern : application authentifiée à navigation persistante.**

> **Écarté du générateur : « Real-Time / Operations Landing ».**
> Ce pattern décrit une page d'atterrissage marketing (hero, preuves sociales,
> « Start trial / Contact »). L'application n'a aucune page publique : toutes les
> routes sauf `/login` sont derrière `proxy.ts`. Il n'y a rien à convertir.

Structure réelle, identique sur les quatre écrans :

1. Barre de navigation persistante (4 destinations + déconnexion)
2. Titre de page + une phrase de contexte
3. Alertes actionnables s'il y en a (cours périmés…)
4. Contenu : synthèse → visualisations → tableau détaillé

L'ordre va du plus agrégé au plus détaillé. Une seule action primaire par écran.

---

## Motion

**Aucune bibliothèque d'animation. Aucun scroll-reveal.**

> **Écarté du générateur : GSAP ScrollTrigger.**
> Faire apparaître en fondu des chiffres de patrimoine au défilement est une
> animation décorative : elle n'exprime aucune relation de cause à effet, ce que
> la règle `motion-meaning` de cette même skill interdit. Elle ajouterait une
> dépendance lourde et retarderait la lecture de données que l'utilisateur vient
> précisément consulter.

Le mouvement se limite aux transitions d'état, qui elles portent du sens :

| Cas | Durée | Courbe |
|---|---|---|
| Survol / focus | 150 ms | `ease-out` |
| Ouverture de dialogue | 200 ms | `ease-out` |
| Fermeture de dialogue | 130 ms | `ease-in` (sortie plus rapide que l'entrée) |
| Apparition d'un toast | 200 ms | `ease-out` |

`prefers-reduced-motion` doit neutraliser ces transitions.

---

## Palette de graphiques — NE PAS REMPLACER

Les huit couleurs catégorielles de `app/globals.css` (`--chart-1` … `--chart-8`)
ont été validées par un contrôle exécutable : bande de clarté, plancher de
chroma, séparation daltonisme (pire paire adjacente ΔE 9,1 en clair / 8,4 en
sombre) et contraste, dans les deux thèmes.

**L'ordre des slots est le mécanisme de sécurité, pas un choix esthétique.** Ne
pas réordonner ni substituer sans relancer la validation.

Trois slots clairs passent sous 3:1 de contraste : la **règle de relief**
s'applique — toute visualisation doit être accompagnée d'une légende porteuse de
valeurs ou d'une vue tableau, pour que l'identité d'un segment ne repose jamais
sur la seule couleur.

**Contrainte de cohabitation :** l'accent d'interface `#2563EB` est proche du
slot `--chart-1`. Ne jamais placer de bouton d'action primaire à l'intérieur
d'une carte contenant un graphique, sous peine de confondre un élément
interactif avec une série de données.

---

## Anti-Patterns (Do NOT Use)

- ❌ Rendu lent — les pages lisent la base à chaque requête, garder les requêtes parallèles
- ✅ **Thème clair par défaut : conservé, contrairement à la sortie du générateur.**
  Il proposait de l'interdire. Les deux thèmes sont pleinement supportés et
  validés (y compris la palette de graphiques) ; on suit la préférence système
  plutôt que d'imposer le sombre à un outil consulté en journée.

### Bascule de thème

`next-themes` avec `attribute="class"`, valeur par défaut `system`, sélecteur à
trois entrées (Clair / Sombre / Système) dans l'en-tête et sur la page de
connexion.

Deux points à ne pas défaire :

- `suppressHydrationWarning` sur `<html>` — la classe de thème est posée avant
  l'hydratation, React la signalerait sinon comme une divergence.
- **Aucun état « monté » pour choisir l'icône.** Les deux icônes sont rendues et
  le CSS masque la mauvaise (`dark:hidden` / `hidden dark:block`). Passer par
  `useState` + `useEffect` déclenche la règle `react-hooks/set-state-in-effect`
  et provoque un rendu intermédiaire visible.

### Additional Forbidden Patterns

- ❌ **Emojis as icons** — Use SVG icons (Heroicons, Lucide, Simple Icons)
- ❌ **Missing cursor:pointer** — All clickable elements must have cursor:pointer
- ❌ **Layout-shifting hovers** — Avoid scale transforms that shift layout
- ❌ **Low contrast text** — Maintain 4.5:1 minimum contrast ratio
- ❌ **Instant state changes** — Always use transitions (150-300ms)
- ❌ **Invisible focus states** — Focus states must be visible for a11y

---

## Pre-Delivery Checklist

Before delivering any UI code, verify:

- [ ] No emojis used as icons (use SVG instead)
- [ ] All icons from consistent icon set (Heroicons/Lucide)
- [ ] `cursor-pointer` on all clickable elements
- [ ] Hover states with smooth transitions (150-300ms)
- [ ] Light mode: text contrast 4.5:1 minimum
- [ ] Focus states visible for keyboard navigation
- [ ] `prefers-reduced-motion` respected
- [ ] Responsive: 375px, 768px, 1024px, 1440px
- [ ] No content hidden behind fixed navbars
- [ ] No horizontal scroll on mobile
