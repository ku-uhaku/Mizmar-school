# Module audit — passe module par module

Revue module par module : nouveautés, bugs, expérience utilisateur, config
manquante. On avance un module à la fois ; « next » passe au suivant.

Baseline au démarrage de la passe : `npm run typecheck` → **vert** (exit 0).

## Ce qu'on vérifie sur chaque module

1. **Nouveautés** — ce que le module a gagné et qui n'est câblé nulle part
   (query orpheline, composant jamais monté, permission jamais accordée).
2. **Bugs** — logique fausse, gating incohérent entre deux fonctions sœurs,
   liens morts, tests qui figent un mauvais comportement.
3. **Expérience utilisateur** — ce que l'écran affirme sans l'avoir gagné, les
   états vides, ce qui manque pour agir sans changer d'écran, RTL.
4. **Optimisation** — les allers-retours DB inutiles (`await` en série qui
   pourraient tenir dans un `Promise.all`), les lectures lourdes appelées pour
   jeter le résultat, ce qui tourne sur *chaque* rendu du layout.
5. **Config** — permissions déclarées/accordées/traduites, entrée nav, seed,
   enregistrement dans le registre et les trois dictionnaires.

Chaque module revu doit repartir avec `npm run typecheck`, `npx eslint` et ses
tests verts.

## Légende

| Marque | Sens |
| --- | --- |
| ⬜ | pas encore revu |
| 🔎 | en cours |
| ✅ | revu, rien à corriger |
| ⚠️ | revu, corrections notées ci-dessous |
| 🔧 | revu, corrections appliquées |

## Avancement

Ordre = ordre d'enregistrement dans `modules/registry.ts`.

### Socle

| # | Module | Taille | État | Notes |
| --- | --- | --- | --- | --- |
| 1 | `dashboard` | 9 f / 1 142 l | 🔧 | 2 corrigés, 1 reporté aux modules 14/16 |
| 2 | `organization` | 11 f / 1 044 l | ✅ | RAS — 1 dérive de doc remontée en transverse |
| 3 | `schools` | 14 f / 1 876 l | 🔧 | 2 corrigés |
| 4 | `school-years` | 15 f / 2 117 l | 🔧 | 2 corrigés |
| 5 | `users` | 16 f / 3 616 l | 🔧 | 2 corrigés (dont 1 escalade de privilège) |
| 6 | `access` | 18 f / 2 713 l | ✅ | RAS — 2 points de conception à acter |
| 7 | `configuration` | 16 f / 5 779 l | 🔧 | 1 fuite inter-écoles corrigée |
| 8 | `setup` | 22 f / 6 636 l | ✅ | RAS |
| 9 | `hr` | 21 f / 10 076 l | ✅ | RAS — le module le plus régulier de l'app |
| 10 | `profile` | 8 f / 986 l | ✅ | RAS |
| 11 | `appearance` | 12 f / 1 310 l | ✅ | RAS |
| 12 | `notifications` | 12 f / 2 303 l | ✅ | RAS |
| 13 | `audit` | 15 f / 2 534 l | ✅ | RAS |

**Socle terminé** (13/13). 9 correctifs sur 6 modules ; 7 modules propres.

### Vie scolaire

| # | Module | Taille | État | Notes |
| --- | --- | --- | --- | --- |
| 14 | `school-life` | 10 f / 1 529 l | ⬜ | |
| 15 | `events` | 14 f / 2 729 l | ⬜ | |
| 16 | `requests` | 14 f / 2 322 l | ⬜ | |
| 17 | `chat` | 12 f / 1 650 l | ⬜ | |
| 18 | `families` | 18 f / 4 376 l | ⬜ | |
| 19 | `students` | 22 f / 7 052 l | ⬜ | |
| 20 | `enrolment` | 16 f / 6 332 l | ⬜ | |
| 21 | `classes` | 16 f / 3 379 l | ⬜ | |
| 22 | `assessments` | 23 f / 10 399 l | ⬜ | travail en cours (devoirs) non commité |
| 23 | `massar` | 13 f / 4 255 l | ⬜ | |
| 24 | `bulletins` | 15 f / 3 716 l | ⬜ | |
| 25 | `classroom` | 17 f / 6 131 l | ⬜ | |
| 26 | `timetable` | 26 f / 10 075 l | ⬜ | |
| 27 | `supplies` | 16 f / 2 941 l | ⬜ | |
| 28 | `documents` | 13 f / 2 214 l | ⬜ | |
| 29 | `imports` | 12 f / 2 918 l | ⬜ | |
| 30 | `reports` | 13 f / 5 751 l | ⬜ | |

### Caisse / logistique

| # | Module | Taille | État | Notes |
| --- | --- | --- | --- | --- |
| 31 | `treasury` | 29 f / 14 850 l | ⬜ | |
| 32 | `transport` | 21 f / 11 994 l | ⬜ | |

### Configuration académique (pas de nav, pas de permissions)

| # | Module | Taille | État | Notes |
| --- | --- | --- | --- | --- |
| 33 | `academics` | 5 f / 1 051 l | ⬜ | |
| 34 | `facilities` | 4 f / 158 l | ⬜ | |
| 35 | `geography` | 4 f / 533 l | ⬜ | |
| 36 | `billing` | 6 f / 933 l | ⬜ | |

### Sans table ni nav

| # | Module | Taille | État | Notes |
| --- | --- | --- | --- | --- |
| 37 | `auth` | 9 f / 960 l | ⬜ | |
| 38 | `context` | 7 f / 610 l | ⬜ | |
| 39 | `portal` | 6 f / 2 619 l | ⬜ | app native — à revoir avec `mobile/` |

---

## Constats transverses

*(remplis au fil de la passe — ce qui touche plusieurs modules atterrit ici)*

- `AGENTS.md` § « Module inventory » ne liste que ~20 modules sur 39. La table
  est à reprendre une fois la passe finie.
- `AGENTS.md` § « Seeding » est en retard d'un orchestrateur *(relevé au module
  2)*. Il affirme « There are **two orchestrators** » et décrit `seed-config.ts`
  comme « the same school with nothing in it… What a real school starts from ».
  Il y en a **trois** — `seed.ts`, `seed-config.ts`, `seed-empty.ts`, chacun avec
  son script (`db:seed`, `db:seed:config`, `db:seed:empty`) — et le rôle a
  glissé : `seed-config.ts` passe `DEMO_ORGANIZATION`, c'est `seed-empty.ts` qui
  part d'une base sans rien à défaire. Le commentaire de
  `modules/organization/seed.ts` a la bonne version ; c'est `AGENTS.md` qui doit
  s'aligner (y compris son bloc de commandes, qui ignore `db:seed:empty`).
- Convention `next/cache` : 30 modules sur 31 rafraîchissent avec `refresh()`.
  Seul `modules/reports/actions.ts` utilise `revalidatePath()` — à trancher au
  module 30, pas avant.

---

## Journal des revues

*(un bloc par module revu : nouveautés, bugs, UX, config, décisions)*

### 1 — `dashboard` 🔧

**Périmètre.** `module.ts` (une entrée nav, `/`), `queries.ts` (3 lectures
composées), 3 composants (`section-card`, `dashboard-charts`, `quick-actions`),
`dashboard.test.ts`, i18n ×3. Aucune table, aucune permission propre : le module
ne fait que composer les comptes des autres. Rendu par
`app/(dashboard)/page.tsx` et `app/(dashboard)/layout.tsx`.

**Vérifications passées.**

- `npx vitest run modules/dashboard` → 20/20 vert.
- `npm run typecheck` → vert.
- Les 10 cibles de liens (4 cartes de section, 5 actions rapides, `/users/new`)
  existent toutes en tant que `page.tsx`.
- Les 4 cartes couvrent bien les 4 sections « de travail » du nav
  (`vieScolaire`, `finance`, `logistique`, `rh`) — pas de section orpheline.
- Le gating est propre : chaque figure est demandée seulement si le lecteur a le
  code, et le test le prouve (« does not even take a count it may not show »).

**Corrigé — 1. `enrolled: 0` / `unplaced: 0` affirmés à tort.** ✅

`loadSchoolLifeSummary` renvoyait `enrolment?.enrolled ?? 0` quand le lecteur
n'a pas `enrolment.view` : la carte vie scolaire imprimait « 0 inscrits » comme
un fait, à quelqu'un qui n'a pas droit au chiffre. C'est exactement la règle que
les deux modules énoncent et que `loadSchoolLifeStats` respecte, lui, en
renvoyant `null`. Le zéro remonte donc en `null` de bout en bout :

- `modules/school-life/queries.ts` — `SchoolLifeSummary.enrolled` / `.unplaced`
  passent en `number | null`, `?? 0` → `?? null`.
- `modules/dashboard/queries.ts` — `SectionHeadline.detail` / `.attention`
  passent en `number | null`.
- `app/(dashboard)/page.tsx` — nouvel helper `detail(count, template)`, jumeau
  de `attention`, qui rend `undefined` quand le chiffre est absent ; les quatre
  cartes passent par lui.
- `modules/dashboard/components/section-card.tsx` — `detail` devient optionnel
  et la ligne n'est plus rendue du tout quand il manque (pas de trou dans la
  grille : la colonne droite se contente de ce qu'elle a).
- Tests : `school-life.test.ts` figeait l'ancien comportement
  (`enrolled: 0`) — il attend maintenant `null` ; `dashboard.test.ts` gagne
  « carries a missing figure through as missing, not as zero » et son mock de
  `loadSchoolLifeSummary` devient mutable pour pouvoir le prouver.

**Corrigé — 2. Un aller-retour DB de trop à chaque chargement.** ✅

`app/(dashboard)/page.tsx` attendait `loadDashboardCharts` *après* le
`Promise.all`, alors qu'il ne dépend d'aucun de ses résultats — une latence
complète en trop sur la page la plus ouverte de l'app. Les trois lectures
tiennent maintenant dans un seul `Promise.all`.

**Reporté — 3. La carte vie scolaire n'alerte que sur `unplaced`.**
   `school-life` sait déjà compter `awaitingValidation` (copies rendues que
   personne n'a acceptées), et `requests` a des demandes en attente. Sur la carte
de la plus grosse section, le seul « quelqu'un vous attend » reste les élèves
non placés. Candidat évident pour l'`attention` de la carte — à décider en
revoyant `school-life` (14) et `requests` (16), qui possèdent les chiffres.

**Après correction :** `npm run typecheck` vert · `npx eslint` sur les fichiers
touchés : rien · `npx vitest run modules/dashboard modules/school-life` →
46/46 vert (20 → 21 sur dashboard).

### 2 — `organization` ✅

**Périmètre.** Une table (`Organization`), deux permissions, une route
(`/organization`), une action (update seulement — pas de create ni de delete :
un déploiement = un groupe), une query, un formulaire, un seed partagé par les
trois orchestrateurs. `npx vitest run modules/organization` → 28/28 vert.

**Nouveautés.** Rien d'orphelin. `Organization.defaultLocale` est bien câblé —
`modules/users/actions.ts:230` s'en sert comme dernier recours pour la langue
d'un nouveau compte quand son école n'en fixe pas. La relation
`notifications Notification[]` ajoutée sur la table est portée par le module 12,
rien à faire ici.

**Sécurité — solide.** C'est le point fort du module :

- L'id vient de la session (`context.organization.id`), jamais du formulaire, et
  le schéma zod le prouve deux fois (test « strips the id »).
- `loadOrganizationBrand` est la seule lecture sans session de l'app. Le `select`
  est exhaustif et non un retour de ligne, avec un test qui **vérifie les clés du
  `select` lui-même** — donc ajouter une colonne à la table (une adresse, un
  numéro de licence) ne peut pas l'élargir en silence. Rare et bien vu.
- Le blason atterrit sur `/login` et `/no-access` sans session : `brand-marks.tsx`
  le fait passer par `isDisplayableImage`, et l'écriture par `optionalImage`. Une
  seule fonction décide de l'acceptation et de l'affichage, donc les deux ne
  peuvent pas diverger (test « displays only what it would accept »).
- Lecture école-scopée / écriture org-scopée : la page lit avec `can`, le bouton
  et l'action exigent `canOrg`. Cohérent des deux côtés.

**UX.** Le mode lecture seule montre les vraies valeurs plutôt qu'un écran
refusé, et le `<fieldset disabled>` suffit aux contrôles natifs — le `Select`
Radix, qui n'en est pas un, porte son `disabled` explicite. Correct.

**Optimisation.** Rien à gagner : la page ne fait aucune requête, elle lit
l'organisation déjà portée par l'`AuthContext`.

**Seul point relevé (mineur, non corrigé).** `seedOrganization` reçoit
`DEMO_ORGANIZATION` (nom, raison sociale, ICE, IF) mais code en dur l'email, le
téléphone, le site et l'adresse de démonstration dans son propre corps. La
donnée de démo est donc à moitié dans la constante, à moitié dans la fonction.
Sans conséquence — la branche est inatteignable sans le paramètre — mais si on
touche à ce seed, tout regrouper dans `DEMO_ORGANIZATION`.

La dérive de doc trouvée en lisant ce seed est remontée dans « Constats
transverses » plutôt qu'ici : elle concerne `AGENTS.md`, pas le module.

### 3 — `schools` 🔧

**Périmètre.** `School` + `SchoolSettings`, 4 permissions, 4 routes (liste,
détail, `new`, `setup`), CRUD complet, 3 composants. 31 tables cascadent depuis
`School` — c'est de loin la suppression la plus large de l'app, et le module le
sait (le commentaire sur `deleteSchoolAction` les énumère).
`npx vitest run modules/schools modules/school-years` → 59/59 vert.

**Bien fait.** Le partage org/école est net et tenu des deux côtés : créer et
supprimer sont `authorizeOrg`, modifier est `authorizeSchool` — et la liste
calcule `editableIds` école par école avec `canInSchool`, donc un directeur ne
voit le bouton « Modifier » que sur son école. `updateSchoolAction` écrit en
`updateMany` scopé par `organizationId` plutôt qu'en `update` par id : un id
forgé ne peut pas atteindre le tenant voisin même si les contrôles au-dessus
étaient relâchés. Les deux uniques (`code`, `massarCode`) sont vérifiés avant
l'écriture pour nommer le champ fautif au lieu de laisser remonter la contrainte.

**Corrigé — 1. Le comptage d'élèves n'était pas scopé au tenant.** ✅

`deleteSchoolAction` faisait `db.student.count({ where: { schoolId } })` sur un
`schoolId` venu de la requête que rien n'avait rattaché à l'organisation :
`authorizeOrg` valide un **code**, pas un id. La suppression juste en dessous,
elle, était bien scopée. Un id d'un autre tenant renvoyait donc « cette école a
N élèves » — un chiffre sur une école qu'on ne devrait même pas pouvoir désigner
— là où le `deleteMany` répondait correctement « introuvable ».

Les trois comptages passent maintenant par la relation :

```ts
where: { schoolId, school: { organizationId: context.organization.id } }
```

Portée réelle faible (un déploiement = une organisation, et il faut déjà
`school.delete` org-wide), mais c'est la règle que le fichier applique partout
ailleurs. Le test `« counts the pupils of that school and no other »` figeait le
`where` non scopé : remplacé par `« counts within the caller's own tenant, not by
bare id »`, qui vérifie les trois.

**Corrigé — 2. La garde ne regardait que les élèves.** ✅

Le commentaire promettait « une école qui a enseigné à quelqu'un est désactivée,
pas supprimée », mais la seule condition était `student.count > 0`. Une école
montée en septembre — personnel embauché, paie passée, caisse ouverte — ou créée
puis abandonnée après le wizard de `setup` n'a encore personne d'inscrit : elle
passait la garde et emportait les 31 tables, bulletins de paie et écritures de
caisse compris.

La garde prend maintenant **trois comptages** en parallèle — élèves, personnel,
mouvements de caisse — et le premier qui répond arrête la suppression, chacun
avec sa propre phrase. Ce sont les trois enregistrements qu'on ne peut
reconstruire à partir de rien d'autre. Nouvelles clés `school.hasStaff` et
`school.hasCashOperations` dans `en` / `fr` / `ar`. Deux tests ajoutés (une école
qui emploie, une école dont la caisse a bougé) et le test « refuse sans le code »
vérifie désormais qu'aucun des trois comptages n'est pris.

**Optimisation.** RAS. `listSchools` fait une requête avec `_count`, pas de N+1 ;
`WITH_COUNTS` est partagé par la liste et le détail via `toRow`, donc les deux ne
peuvent pas diverger.

### 4 — `school-years` 🔧

**Périmètre.** `SchoolYear` + `Term`, 4 permissions, une route, un `service.ts`
qui porte deux invariants réels, et la fonctionnalité la plus intéressante des
quatre premiers modules : **démarrer une année à partir de la précédente**.

**La reprise d'année — c'est du bon travail.** `copyYearConfiguration` orchestre
et n'écrit rien : chaque partie est copiée par le module qui possède les tables
(`classes`, `billing`, `timetable`, `transport`), exactement comme `prisma/seed.ts`.
Quatre groupes (`CALENDAR`, `STRUCTURE`, `FEES`, `TRANSPORT`) plutôt qu'une case
par table, parce qu'une école pense en « le calendrier » et « les classes ».
Trois décisions valent d'être relevées :

- Le décalage est arrondi à la **semaine entière** (`shiftInDays`), pour qu'un
  lundi reste un lundi — l'emploi du temps est indexé sur le jour de la semaine,
  donc un férié qui glisse en milieu de semaine changerait silencieusement quelles
  semaines comptent comme enseignées.
- Les vacances sont posées **avant** le calcul des semaines, parce que celui-ci en
  dépend. L'ordre est commenté là où il compte, et nulle part ailleurs.
- **Aucune partie ne transporte de personne** — pas d'élève, pas d'abonnement, pas
  de professeur principal. C'est la bonne ligne, et elle est écrite dans `enums.ts`.

Tout est idempotent (upsert, jamais d'écrasement), donc recopier sur une année
déjà retouchée comble les trous sans défaire le travail fait.

**Autorisation — le module de référence.** Les quatre actions résolvent d'abord
l'école propriétaire depuis la ligne, *puis* autorisent contre elle
(`existing.schoolId` → `authorizeSchool`). Et `createSchoolYearAction` refuse de
laisser le client nommer l'école : elle vient du contexte. La source de la copie
est re-vérifiée contre cette même école, et `copyYearConfiguration` revérifie
encore que les deux années partagent l'école — « la règle appartient à la donnée ».
C'est le patron que `schools` devrait suivre au point 1 ci-dessus.

**Corrigé — 1. La garde ne regardait que les inscriptions.** ✅

Même forme qu'au module 3. En lisant le schéma, le trou s'est révélé plus précis
et plus utile que prévu : `SchoolYear.payments` porte un **`Restrict`** côté
`Payment`, documenté « a year with receipts against it is closed history ». La
base refusait donc déjà — mais en erreur de contrainte brute, c'est-à-dire le
« quelque chose s'est mal passé » dont un économe ne peut rien faire. C'est
exactement ce que le commentaire de l'action déplorait, sans le combler.

`deleteSchoolYearAction` compte maintenant les inscriptions **et** les reçus, en
parallèle, et rend la même phrase lisible dans les deux cas. Le second n'est pas
couvert par le premier : l'argent est encaissé sur une année, et une année peut
porter des reçus dont les inscriptions ont depuis été retirées. Nouvelle clé
`schoolYear.hasPayments` dans les trois langues, deux tests ajoutés.

**Corrigé — 2. Une lecture plus large que nécessaire.** ✅

`defaultSchoolYearFor` chargeait toutes les colonnes de toutes les années d'une
école pour n'en retenir qu'un `id`, à chaque changement d'école. Elle ne
sélectionne plus que `{ id, isDefault, status }` — les trois colonnes qui
décident — et garde la passe unique, qui elle était le bon choix : les trois
préférences sont une chaîne de recours sur les mêmes lignes, les demander trois
fois serait trois allers-retours pour une seule question. La raison est
maintenant écrite au-dessus de la fonction.

**Rien à redire.** Le refus « date de fin avant date de début » est dans le
schéma zod, pas dans l'action. L'invariant « au plus une année par défaut par
école » est dans `service.ts` avec la raison (SQLite ne sait pas exprimer l'index
unique partiel) — donc toute écriture future passe par la même règle. Et une
école sans année par défaut n'est pas un trou : `defaultSchoolYearFor` retombe sur
l'année ACTIVE, puis sur la plus récente.

**Après corrections (modules 3 et 4).** `npm run typecheck` vert ·
`npx eslint modules/schools modules/school-years` : rien ·
`npx vitest run` (suite complète) → **54 fichiers, 2 189 tests, tout vert**
(59 → 63 sur ces deux modules).

### 5 — `users` 🔧

**Périmètre.** `User` + `Profile`, 5 permissions, 3 routes, CRUD + bascule
d'activation, 3 composants, 2 fichiers de tests. `npx vitest run modules/users
modules/access` → 130/130 vert.

**Le module le plus finement autorisé de l'app.** Deux niveaux de portée
(org-wide / école) tenus en parallèle dans `queries.ts` **et** `actions.ts`, avec
le commentaire qui dit explicitement que les deux doivent s'accorder. Plusieurs
décisions rares et justes :

- `resolveOrgRoleId` renvoie `current` — pas `null` — quand l'acteur n'a pas
  `user.assignRole` org-wide. Sans ça, quiconque tient `user.update` retirait son
  rôle d'organisation à un administrateur juste en enregistrant le formulaire : le
  champ ne lui est pas rendu, donc le navigateur ne poste rien, et « rien » se
  serait lu « efface-le ».
- Les memberships ne sont remplacés que **pour les écoles que l'acteur voit**,
  donc un administrateur scopé sur deux écoles ne peut pas effacer l'affectation
  d'un utilisateur dans une troisième.
- `findUser` renvoie `null` (→ `notFound()`) plutôt qu'un état interdit, pour
  qu'un administrateur d'école ne puisse pas sonder l'existence de comptes
  ailleurs.
- Une réinitialisation de mot de passe pose `credentialsChangedAt`, donc elle
  expulse réellement la session en cours.

**Corrigé — 1. Escalade de privilège : la garde ignorait quelle action
s'exécute.** ✅ *(sécurité, réelle)*

`modules/users/actions.ts` — `assertCanActOnUser` choisit sa branche « portée
organisation » ainsi :

```ts
context.isSuperAdmin ||
context.canOrg(PERMISSIONS.USER_UPDATE) ||
context.canOrg(PERMISSIONS.USER_DELETE)
```

Le `||` est le bug : la garde ne sait pas laquelle des deux actions l'appelle.
Un acteur qui tient **`user.update` org-wide** mais **`user.delete` seulement sur
son école** — un rôle parfaitement plausible : « peut corriger la fiche de tout le
monde, ne peut supprimer que chez lui » — passe `authorizeAnyScope(USER_DELETE)`
au titre de son école, puis prend la branche org-wide au titre de son *update*.
Résultat : il supprime n'importe quel compte de l'organisation, y compris un
super administrateur ou un porteur de rôle org-wide, que la branche école lui
interdit explicitement.

Le module connaissait déjà le bon patron, deux fichiers plus loin : `findUser`
prend la permission exercée en paramètre, précisément parce que « org-wide reach
is decided per permission rather than once for the whole module ».

`assertCanActOnUser` prend maintenant ce même paramètre et n'ouvre la branche
large que sur `context.isSuperAdmin || context.canOrg(permission)`. Les trois
appelants passent le code qu'ils exercent réellement : `USER_UPDATE` pour
`updateUserAction` et `toggleUserActiveAction`, `USER_DELETE` pour
`deleteUserAction`. Le resserrement est symétrique : un acteur qui tient
`user.delete` org-wide mais `user.update` sur son école seulement retombe
désormais sur la branche école pour les modifications.

L'angle mort des tests était que les trois personas (`asDirector`, `asOrgAdmin`,
`asSuperAdmin`) sont toutes « tout org » ou « tout école », jamais mixtes.
Ajout d'`asMixedReach` (update org-wide, delete sur une école) et de quatre
tests : il ne supprime pas ailleurs, pas davantage quelqu'un qui le surclasse,
il supprime toujours chez lui, et il modifie toujours org-wide — pour que le
correctif ne retire pas au passage l'autorité qu'il détient vraiment.

**Corrigé — 2. `countUsers` ne scopait pas par organisation.** ✅

`modules/users/queries.ts` — la branche école-scopée était
`{ memberships: { some: { schoolId: { in: visibleSchoolIds } } } }`, sans
`organizationId`, alors que `listUsers` le met dans **les deux** branches et que
le commentaire de `countUsers` promet « scoped the same way as `listUsers` ».
Le tenant est maintenant sur les deux branches. Aucun chiffre ne change
aujourd'hui — une école appartient à une organisation — mais la liste et le
compte sont censés être le même périmètre, et n'en voir qu'un le dire est la
façon dont les deux finissent par diverger.

### 6 — `access` ✅

**Périmètre.** `Role`, `Permission`, `RolePermission`, `Membership` — le socle
d'autorisation de toute l'app. 3 routes, CRUD des rôles, la matrice de
permissions, `system-roles.ts`, et `web-access.ts`. Rien à corriger.

**Bien fait.**

- `resolvePermissionIds` filtre par `isPermissionCode` **avant** de toucher la
  base : un rôle ne peut pas détenir un code que le code applicatif ne teste
  jamais. C'est la promesse d'`AGENTS.md`, tenue au bon endroit (dans
  `queries.ts`, donc un futur script d'import l'obtient gratuitement).
- `updateRoleAction` refuse de **re-scoper un rôle déjà attribué**, et le
  commentaire explique pourquoi c'est un vrai piège : un membership ne porte
  qu'un rôle SCHOOL et `User.orgRoleId` qu'un rôle ORG ; basculer le scope
  laisserait ces lignes pointer sur un rôle qui ne qualifie plus, et comme le
  formulaire utilisateur remplace les memberships en bloc, la prochaine
  sauvegarde sans rapport les ferait disparaître en silence.
- Les rôles système gardent nom et scope ; seul leur jeu de permissions bouge.
- La suppression compte `memberships + orgUsers` pour rendre une phrase au lieu
  de laisser remonter le `Restrict`.
- `listSchoolRoles` existe séparément de `listRoles` pour ne pas traîner toute la
  matrice de permissions dans une liste déroulante de formulaire.

**Deux points de conception à acter (pas des bugs).**

1. **`role.update` vaut la racine.** Rien n'empêche un porteur de `role.update`
   d'ajouter n'importe quel code du catalogue à un rôle qu'il détient déjà, donc
   de s'auto-attribuer `treasury.disburse` ou `user.delete`. C'est cohérent avec
   `AGENTS.md`, qui ne promet que « rien hors catalogue », et c'est le modèle de
   la plupart des back-offices — mais autant que ce soit un choix écrit plutôt
   qu'un oubli : `role.update` ne devrait n'être accordé qu'aux rôles qu'on
   accepte de traiter comme administrateurs.
2. **`hasWebAccess` compare des *noms* de rôles.**
   `MOBILE_ONLY_ROLES.includes(membership.role.name)` — une chaîne, pas un id ni
   un drapeau. Ça ne casse pas aujourd'hui, et pour deux raisons qui ne sont
   écrites nulle part : `updateRoleAction` verrouille le nom des rôles système,
   et `@@unique([organizationId, name])` empêche un rôle sur mesure de s'appeler
   « Enseignant ». Les deux garde-fous sont réels mais distants ; une colonne
   `mobileOnly` sur `Role` rendrait la règle locale. À garder en tête si le
   verrou de nom bouge un jour.

**Après corrections (module 5).** `npm run typecheck` vert · `npx eslint
modules/users` : rien · `npx vitest run` (suite complète) → **54 fichiers,
2 193 tests, tout vert** (2 189 → 2 193 : les 4 tests d'`asMixedReach`).

### 7 — `configuration` 🔧

**Périmètre.** Aucune table à lui : un CRUD générique sur les quatorze tables de
configuration des autres modules, piloté par des descripteurs
(`resources.ts` + `resource-schema.ts`). Une permission,
`configuration.manage`, vérifiée **dans l'école en contexte**.

**Bien conçu.** Trois actions couvrent les quatorze ressources, et chacune
re-résout le descripteur et le scope côté serveur. Deux détails valent d'être
notés parce qu'ils viennent manifestement de vraies pannes :

- `toRelationData` n'existe que pour `create` : l'input généré de ce client
  n'accepte que la relation (`{ city: { connect } }`), jamais la colonne
  `cityId`, alors qu'`updateMany` est l'inverse — scalaires plats uniquement.
  Les deux chemins sont commentés là où ils divergent.
- `findUnreachableReference` revalide **chaque champ référence** contre le
  contexte : la liste déroulante était filtrée, un POST direct ne l'est pas.
- Le commentaire sur `school-settings` raconte le bug qui a donné « les
  réglages ne marchent pas » : la ressource existait sans entrée dans
  `RESOURCE_SCHEMAS`, donc l'enregistrement passait mais `findSingleton`
  relisait les valeurs par défaut.

**Corrigé — Fuite d'existence entre écoles à la suppression.** ✅

`deleteConfigItemAction` appelait `findBlockingReference(schema.model, id)`
**avant** d'avoir établi que la ligne appartient au contexte. Or cette fonction
compte par id nu — elle le doit, puisqu'elle parcourt le *runtime data model* de
Prisma et non le scope de la ressource. Un directeur, porteur légitime de
`configuration.manage` dans son école, obtenait donc « utilisé par 12
enregistrements » pour une salle, une matière ou un type de frais **d'une autre
école de la même organisation** : la réponse confirmait à la fois l'existence de
la ligne voisine et son intensité d'usage, là où le `deleteMany` scopé juste en
dessous ne dit rien du tout.

L'action établit maintenant la portée d'abord (`findFirst` avec
`schema.where(context)`), et ne consulte le garde-fou qu'ensuite. C'est
exactement la promesse de l'en-tête du fichier — « a crafted id matches no rows
instead of reaching another school's » — que le garde-fou lisait en avance.

**Deux points laissés en l'état, à considérer.**

1. **Aucun test au niveau des actions.** `configuration.test.ts` teste le
   registre, les clauses `where` de chaque ressource et la lecture des
   formulaires — tout ce qui est donnée pure — mais mocke `db` par un proxy vide,
   donc `createConfigItemAction` / `updateConfigItemAction` /
   `deleteConfigItemAction` ne sont jamais exécutées. C'est le CRUD de quatorze
   tables sans filet ; le correctif ci-dessus n'a donc pas pu être verrouillé par
   un test sans réécrire le mock partagé du fichier.
2. **`findBlockingReference` est séquentiel.** Il `await` un `count` par relation
   dans une boucle, avec sortie anticipée au premier bloquant. La sortie
   anticipée n'aide que le cas *bloqué* ; le cas courant — rien ne bloque, la
   suppression aboutit — paie tous les allers-retours à la file. Un
   `Promise.all` inverserait le compromis dans le bon sens.

### 8 — `setup` ✅

Le wizard qui remplit une école neuve. Aucune table, aucune permission propre :
il emprunte celles des modules qu'il écrit — et c'est là qu'il est bien fait.
`runSetupAction` calcule d'abord **ce que cette exécution écrit réellement**
(`writesConfiguration`), puis autorise en conséquence, et la portée change avec
le mode :

- `mode: "new"` → tout en `authorizeOrg`, avec la raison écrite : une école qui
  n'existe pas encore ne peut pas être le sujet d'un droit école-scopé, puisque
  `authorizeSchool` re-dérive la portée depuis `context.schools`, lu avant que la
  requête ne crée quoi que ce soit.
- `mode: "existing"` → `authorizeSchool`, le contrôle ordinaire.

Les collisions de `code` et de `massarCode` sont vérifiées avant d'écrire, comme
dans `schools`. Rien à redire.

### 9 — `hr` ✅

Le plus gros module du socle (10 076 lignes) et le plus régulier. **Les seize
actions suivent le même patron sans exception** : `schoolContext()` →
`authorizeSchool(schoolId, CODE)` → re-dérivation de la ligne par
`where: { id, staff: { schoolId } }`. Vérifié une par une — aucune ne fait
confiance à un id de la requête.

Trois choses au-dessus de la moyenne :

- **La paie est cloisonnée dans `queries.ts`, pas dans le rendu.** Le fichier
  `payroll-visibility.test.ts` existe précisément pour ça, et son en-tête dit le
  bug d'origine : la ligne entre `hr.view` et `hr.payroll` était tracée à
  l'affichage, ce qui mettait tous les salaires dans le *payload* d'une page
  qu'une secrétaire pouvait ouvrir, cachés à l'écran et à un panneau devtools
  près. Les tests portent sur ce qui quitte le serveur.
- **Un décaissement exige deux permissions.** `paySalaryAction` et
  `payAdvanceAction` demandent `HR_PAYROLL` *et* `TREASURY_DISBURSE` : payer
  quelqu'un est un acte RH et un acte de caisse.
- **La règle de fonds de caisse n'est pas dupliquée.** `refuseIfShort` délègue à
  `availableIfShortOf` dans la caisse ; seule la phrase est composée ici. Un
  paiement lancé depuis la RH ne peut donc pas autoriser ce que l'écran de
  décaissement refuse.

### 10 — `profile` ✅ · 11 — `appearance` ✅

Deux petits modules qui n'écrivent que la ligne de leur propre utilisateur
(`where: { userId: context.user.id }`), sans permission — il n'y a rien à
accorder pour se modifier soi-même.

`changeOwnPasswordAction` est le morceau intéressant : il relit le hash en base
plutôt que de faire confiance à la session, et pose `credentialsChangedAt` dans
la **même** écriture que le nouveau hash — donc changer son mot de passe
déconnecte réellement les autres appareils, ce qui est tout l'objet de l'action.
Le commentaire assume que l'appareil courant est déconnecté lui aussi et explique
pourquoi le message le dit plutôt que de le cacher : quelqu'un qui lit « mot de
passe changé » puis retombe sur l'écran de connexion en conclut que ça n'a pas
marché et ressaie l'ancien.

### 12 — `notifications` ✅

Boîte de réception scopée au compte qui la lit — d'où l'absence de permission,
documentée dans `module.ts`. Les trois actions filtrent sur
`userId: context.user.id`. Les fonctions de destinataires (`staffHolding`,
`guardiansOf`, `guardiansOfClass`, `guardiansOfEventAudience`) prennent toutes
`organizationId` **et** `schoolId` en paramètres explicites. La déduplication
passe par `userId_dedupeKey`, donc un même événement ne notifie pas deux fois.

### 13 — `audit` ✅

Lecture seule, et le scope est calculé une fois dans `readableScope` que les
trois lectures partagent — donc la liste, l'historique d'une ligne et le filtre
« qui » ne peuvent pas diverger. Deux détails justes :

- Un lecteur sans le code obtient `null` → page vide, **sans requête**.
- `audit.security` est une seconde permission qui filtre les
  `SECURITY_ACTIONS` du même jeu de résultats, plutôt qu'un écran séparé.
- La branche école-scopée écrit `schoolId: currentSchoolId(context)`, et ce
  helper renvoie le sentinelle `NO_MATCH` plutôt qu'`undefined` quand aucune
  école n'est sélectionnée. C'est le bon réflexe : `undefined` aurait été
  *ignoré* par Prisma et aurait ouvert toute l'organisation. Vérifié dans
  `lib/scope.ts`.

`listActivityActors` lit les acteurs depuis la trace elle-même et non depuis la
table des comptes, pour que quelqu'un qui a quitté l'établissement apparaisse
toujours dans « qui a fait quoi ».

**Après correction (module 7).** `npm run typecheck` vert ·
`npx eslint modules/configuration` : rien · `npx vitest run` → **54 fichiers,
2 193 tests, tout vert**.

**Rien à changer par ailleurs.** `quick-actions` (liste fixe filtrée par
permission, dans le header et non sur le dashboard) et `section-card` (couleur
dérivée du `href` via `sectionForPath`, pas de seconde liste à tenir) sont bien
posés. Les charts choisissent quatre formes pour quatre questions différentes et
disparaissent proprement quand il n'y a rien à tracer.
