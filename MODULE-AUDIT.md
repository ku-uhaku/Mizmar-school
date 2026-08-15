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
Légende de colonne : **Accès** = passe d'autorisation (faite sur les 17).
**Logique** = revue ligne à ligne du métier (partielle, voir le journal).

| # | Module | Accès | Logique | Notes |
| --- | --- | --- | --- | --- |
| 14 | `school-life` | ✅ | ✅ | filtre par permission dans l'action |
| 15 | `events` | ✅ | ✅ | école → familles, sens unique |
| 16 | `requests` | ✅ | ✅ | pas de `REQUEST_CREATE` : c'est le parent qui dépose |
| 17 | `chat` | ✅ | ✅ | parent ↔ parent ; aucun chemin d'écriture pour le personnel |
| 18 | `families` | ✅ | ✅ | `authorizeFamily` / `authorizeGuardianPortal` |
| 19 | `students` | ✅ | 🔎 | n'expose de la famille que `id`/`name`/`code` |
| 20 | `enrolment` | ✅ | 🔎 | `authorizeEnrolment` ; échéanciers non relus en détail |
| 21 | `classes` | ✅ | 🔎 | |
| 22 | `assessments` | ✅ | 🔎 | `FAMILY_VISIBLE_STATUSES = ["GRADED"]` |
| 23 | `massar` | ✅ | 🔎 | |
| 24 | `bulletins` | ✅ | 🔎 | |
| 25 | `classroom` | ✅ | ✅ | aucune occurrence de « guardian » ni « phone » |
| 26 | `timetable` | ✅ | ✅ | détection de conflits relue — voir le journal |
| 27 | `supplies` | ✅ | 🔎 | |
| 28 | `documents` | ✅ | 🔎 | |
| 29 | `imports` | ✅ | ✅ | exige trois permissions, pas une |
| 30 | `reports` | ✅ | 🔎 | seul module à utiliser `revalidatePath` |

### Caisse / logistique

| # | Module | Taille | État | Notes |
| --- | --- | --- | --- | --- |
| 31 | `treasury` | 29 f / 14 850 l | ✅ | 186 tests verts — voir le journal |
| 32 | `transport` | 21 f / 11 994 l | ✅ | 17 actions / 19 autorisations |

### Configuration académique (pas de nav, pas de permissions)

| # | Module | Taille | État | Notes |
| --- | --- | --- | --- | --- |
| 33 | `academics` | 5 f / 1 051 l | ✅ | données pures + seed, aucune action |
| 34 | `facilities` | 4 f / 158 l | ✅ | idem |
| 35 | `geography` | 4 f / 533 l | ✅ | idem + une query |
| 36 | `billing` | 6 f / 933 l | ✅ | idem + `service.ts` (reprise d'année) |

### Sans table ni nav

| # | Module | Taille | État | Notes |
| --- | --- | --- | --- | --- |
| 37 | `auth` | 9 f / 960 l | ✅ | throttling + message d'accès web |
| 38 | `context` | 7 f / 610 l | ✅ | ne fait jamais confiance à l'id du client |
| 39 | `portal` | 6 f / 2 619 l | 🔧 | fuite d'e-mails corrigée — voir la section frontière |

---

## La frontière enseignant ↔ parent

*Passe dédiée : aucun contact direct entre un enseignant et un parent. Vérifiée
dans les deux sens, plus le rôle qui les sépare.*

**Verdict : la règle tient, après un correctif.** Toutes les voies entre une
famille et le personnel sont médiées par le bureau, et c'est écrit dans la
conception, pas seulement dans le comportement.

| Voie | Qui parle à qui | Statut |
| --- | --- | --- |
| `chat` | **parent ↔ parent** uniquement (école entière ou une classe) | ✅ |
| `events` | école → familles, une seule direction, `event.publish` | ✅ |
| `requests` | famille → **guichet**, traité sous `request.handle` | ✅ |
| `classroom` remarques | enseignant → famille, une seule direction, et seulement si `classroom.remarkPublish` | ✅ |
| `assessments` / `bulletins` | notes publiées par le bureau, jamais par l'enseignant | ✅ |
| DTO du portail | **fuite d'adresses e-mail** | 🔧 corrigé |

**Ce qui rend la règle solide (côté chat).** `ChatChannel` est décrit dans son
propre schéma comme « une conversation entre les parents d'une école, ou d'une
classe ». Le module ne déclare que deux permissions, et **aucune n'est
« publier »** : `chat.view` pour lire, `chat.moderate` pour retirer un message
ou archiver un fil. Il n'existe aucun chemin d'écriture pour le personnel, ni
sur le web ni sur l'API mobile. Côté parent, l'écriture passe par
`canPostToChannel` → `listMyChannels` → `householdScope`, donc un compte sans
enfant inscrit n'a aucun canal — un enseignant n'a littéralement rien où poster.

**Ce qui rend la règle solide (côté rôle).** Le rôle système `Enseignant` ne
détient **ni `family.view`, ni `chat.view`, ni `request.handle`, ni
`event.publish`** (vérifié : 0 occurrence). Il a `student.view`, mais
`modules/students/queries.ts` n'expose de la famille que `id`, `name`, `code` —
jamais un tuteur, jamais un téléphone. Et `modules/classroom/queries.ts` ne
contient pas une seule occurrence de « guardian » ou « phone ». Un enseignant ne
peut donc pas joindre un parent, même s'il le voulait.

Les commentaires de `system-roles.ts` montrent que la séparation est
intentionnelle et fine : pas d'`ATTENDANCE_JUSTIFY` (l'enseignant constate une
absence, le bureau décide si le mot l'excuse), pas de `REMARK_PUBLISH` (« une
inquiétude part vers la famille une fois que l'école a décidé quoi dire, pas au
moment où elle est écrite »), pas de `SUPPLY_REVIEW`, pas d'`ASSESSMENT_PUBLISH`.

**Corrigé — Le portail livrait des adresses e-mail aux familles.** ✅

`modules/portal/queries.ts` recopiait à la main la logique de `displayName`
(`lib/dal.ts`) à **trois** endroits. Ce helper retombe sur l'e-mail du compte
quand le profil manque — ce qui est juste là où il est utilisé, le bandeau qui
vous montre votre propre nom — et faux ici :

1. **l'auteur d'une remarque** → l'e-mail de l'enseignant qui l'a écrite ;
2. **l'enseignant d'un cours** sur l'emploi du temps de l'enfant → son e-mail ;
3. **l'auteur d'un message** dans un canal de parents → l'e-mail **d'un autre
   parent**, diffusé à toute la classe.

Les deux premiers ouvrent exactement la ligne directe famille → enseignant que
tout le reste de l'app referme : le chat est entre parents, une demande passe au
guichet, une remarque va dans un seul sens. Une adresse dans un DTO contourne
tout cela. Le troisième est d'une autre nature mais pire à sa façon : il divulgue
l'adresse personnelle d'un parent à tous les autres.

Se déclenchait dès qu'un compte n'a pas de ligne `Profile` ou un nom vide —
typiquement un compte créé par import.

Un seul helper local, `personName`, remplace les trois copies : il renvoie le nom
du profil ou `null`, jamais l'e-mail. Et la colonne `email` est **retirée des
trois `select`**, pour qu'elle ne quitte même pas la base. `PortalMessage.authorName`
passe de `string` à `string | null`, avec son miroir dans
`mobile/src/api/types.ts` (aucun écran mobile ne l'affichait encore, donc rien à
reprendre côté rendu).

## Bilan de la passe

**39 / 39 modules revus pour l'accès. 10 correctifs sur 7 modules.**

| # | Module | Correctif |
| --- | --- | --- |
| 1 | `dashboard` | « 0 inscrits » affirmé sans droit → `null` |
| 1 | `dashboard` | un aller-retour DB de trop sur la page la plus ouverte |
| 3 | `schools` | comptage d'élèves non scopé au tenant |
| 3 | `schools` | garde de suppression élargie au personnel et à la caisse |
| 4 | `school-years` | garde élargie aux reçus (le `Restrict` devient une phrase) |
| 4 | `school-years` | lecture de toutes les colonnes pour un seul `id` |
| 5 | `users` | **escalade de privilège** — `update` org-wide achetait `delete` org-wide |
| 5 | `users` | `countUsers` sans `organizationId` |
| 7 | `configuration` | fuite d'existence entre écoles à la suppression |
| 39 | `portal` | **adresses e-mail livrées aux familles** (3 endroits) |

Deux d'entre eux sont de vrais défauts de sécurité : l'escalade du module 5 et la
fuite d'e-mails du module 39. Les autres sont des affirmations non gagnées, des
gardes partielles ou des dérives de portée.

**Ce qui reste ouvert** (rien de bloquant, tout est tracé plus haut) :

- La revue métier des modules marqués 🔎 — surtout `bulletins` (moyennes) et
  `massar` (mapping).
- `configuration` n'a **aucun test au niveau des actions** : le CRUD de quatorze
  tables sans filet.
- `findBlockingReference` est séquentiel là où le cas courant paierait moins en
  parallèle.
- Les deux points de conception d'`access` à acter : `role.update` vaut la
  racine, et `hasWebAccess` compare des noms de rôles.
- `AGENTS.md` est en retard sur deux points (inventaire des modules, orchestrateurs
  de seed).

**Vérification finale :** `npm run typecheck` vert · `npx eslint` sur tous les
fichiers touchés : rien · `npx vitest run` → **54 fichiers, 2 193 tests, tout
vert** (2 189 au départ, +4 tests ajoutés).

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
école » est dans `service.ts` avec la raison (MySQL ne sait pas exprimer l'index
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

## Vie scolaire — passe d'autorisation (14 à 30)

*Une passe sur les 17 modules d'un coup, parce que la question posée — « l'accès
est-il bon ? » — se vérifie mieux en travers qu'un module à la fois. La revue
métier ligne à ligne reste à faire sur les modules marqués 🔎.*

**Verdict : aucun défaut d'autorisation sur les 17.**

**Méthode.** Trois balayages, plus des plongées ciblées.

1. **Chaque action est-elle autorisée ?** Comptage des `export async function`
   contre les appels `authorize*` par module. Quatre modules affichaient moins
   d'appels que d'actions — `families` (9/6), `enrolment` (6/4), `school-life`
   (1/0), `reports` (1/0) — et les quatre sont corrects après lecture :
   - `families` et `enrolment` passent par un helper
     (`authorizeFamily`, `authorizeGuardianPortal`, `authorizeEnrolment`) qui
     résout l'école **depuis la ligne** avant d'autoriser. Le bon patron, celui
     que `school-years` a établi.
   - `school-life` (recherche globale) et `reports` (favori) filtrent par
     permission à l'intérieur de l'action, code par code.
2. **Les compteurs dérivent-ils de leurs listes ?** C'est le bug trouvé au module
   5. Aucun équivalent ici : `countFamilies`, `countStudentsByStanding`,
   `countEnrolmentsByLevel`, `countAssessments`, `countAwaitingReview` passent
   toutes par le `scope(context)` / `schoolScope(context)` partagé du fichier.
3. **Le rôle `Enseignant` peut-il déborder ?** Voir la section « frontière
   enseignant ↔ parent » plus haut : non.

**Plongées.**

- **`timetable` — détection de conflits.** La partie la plus subtile de tout ce
  que j'ai lu. Trois règles se superposent : la parité de quinzaine
  (`parityOverlaps` — deux semaines opposées ne se croisent jamais, et `ALL`
  recouvre les deux, ce qui est précisément pourquoi l'index unique ne peut pas
  trancher seul), la fenêtre de semaines (`weekWindowsOverlap` — les deux moitiés
  d'un cours modifié en cours d'année ne sont pas un conflit, sinon la grille
  deviendrait inéditable après le premier trimestre), et le semestre nul qui
  signifie « toute l'année » et entre donc en collision avec tout. Ce dernier
  point porte le commentaire juste : le filtre ne se resserre que si le cours
  *entrant* a son propre semestre, sinon une réservation à l'année pourrait être
  posée par-dessus un cours semestriel sans que personne soit prévenu. Rien à
  redire.
- **`imports` — écritures en masse.** Exige **trois** permissions et pas une :
  `import.students`, `student.create` **et** `family.create`, parce qu'un import
  crée les deux. L'export exige symétriquement `student.view` + `family.view`.
- **`families` — ouverture d'un compte portail.** Le compte parent est créé
  `roleId: null`, donc sans membership : « a parent is not staff, and everything
  they may read is scoped by the household instead ». Un seul accès par dossier,
  vérifié sur tout le dossier et pas sur le tuteur seul, pour que rouvrir un
  compte existant et en ouvrir un second donnent la même réponse.
- **`assessments` — ce qu'une famille voit.** `FAMILY_VISIBLE_STATUSES` ne
  contient que `GRADED`, l'état où l'école a accepté la correction. Les écrans du
  personnel utilisent `COUNTED_STATUSES`, plus large, parce qu'une moyenne en
  cours de trimestre doit inclure une copie encore en correction. Les deux listes
  sont séparées et commentées ; l'enseignant tient `ASSESSMENT_GRADE` mais pas
  `ASSESSMENT_PUBLISH`, donc il ne décide pas de la publication.

**Reste à faire.** La revue métier des modules marqués 🔎 — en particulier le
calcul des moyennes de `bulletins` et le mapping `massar`. Les échéanciers
d'`enrolment` ont été relus depuis (voir ci-dessous).

## L'argent — `enrolment` (20) et `treasury` (31)

*Relu en priorité : un mauvais chiffre y est pire qu'une mauvaise permission.*
`npx vitest run modules/treasury modules/transport` → 186/186 vert.

**Rien à corriger. C'est la partie la mieux raisonnée de l'application.**

**`EnrollmentFee` — pourquoi la table existe.** Le schéma répond lui-même, en
trois points qui sont chacun une décision : le prix est **copié** à l'inscription
plutôt que relu à travers `feeRateId`, pour qu'un tarif corrigé en novembre ne
réécrive pas ce qui a été signé en septembre ; une réduction est par élève **et
par mois**, ce qu'une liste de prix ne peut pas exprimer ; et c'est la ligne à
laquelle un encaissement s'attachera. `feeRateId` est conservé en `SetNull` et
n'est **jamais** lu pour calculer un total — seulement pour répondre à « pourquoi
suis-je facturé ça ? ».

**`repriceFeeLine` — deux bugs d'argent déjà fermés, et le commentaire le dit.**

1. *Waiver d'une ligne déjà payée.* Toute somme « payé par cet élève » se lit à
   travers les lignes encore `DUE` ; annuler une ligne réglée sortait donc ses
   allocations du total de l'élève pendant que le reçu et la caisse comptaient
   toujours chaque centime. Les deux comptabilités divergeaient exactement du
   montant réellement versé. L'édition est refusée tant que l'argent est attaché ;
   annuler le reçu est le chemin de retour, et il laisse une trace.
2. *La course entre le contrôle et l'écriture.* Les deux étaient deux requêtes
   sur des connexions séparées, et un reçu validé entre elles passait à travers
   un garde qui avait déjà lu zéro. Les deux partagent maintenant une
   transaction, et `paidOnFeeLine` prend un client pour être lue **dedans**.

**`recordPayment` — trois précautions.**

- **Une ligne, une allocation.** Une requête nommant deux fois la même échéance
  passait le contrôle de sur-paiement deux fois, chaque moitié comparée à un
  reste qui ignorait l'autre ; seul l'index unique rattrapait, en plantant. Les
  doublons sont fusionnés avant le contrôle.
- **Relecture dans la transaction, scopée école + année.** Un id de la requête ne
  peut pas atteindre l'échéancier d'un autre tenant, et le reste dû est celui qui
  est vrai au moment de l'écriture.
- **La notification est hors transaction, et après.** Un fan-out sur les tuteurs
  d'une famille tiendrait le verrou d'écriture ouvert pendant des lectures
  étrangères au grand livre. Si la notification échoue, le reçu tient — le bon
  sens de la dépendance.

**`transport`** : 17 actions, 19 appels d'autorisation. Rien à signaler.

## Le reste (33 à 39)

- **`academics`, `facilities`, `geography`, `billing`** — configuration
  académique : `enums.ts`, `presets.ts`, `seed.ts`, pas d'`actions.ts`. Ils
  n'exposent aucune surface d'écriture propre ; leurs tables sont éditées par le
  CRUD générique de `configuration` (module 7), qui porte l'autorisation.
  `billing/service.ts` ne sert qu'à la reprise d'année (`copyFeeConfiguration`),
  appelée par `school-years`.
- **`auth`** — la porte d'entrée, et elle est prudente. L'identifiant est validé
  comme une simple chaîne et non comme un e-mail (le personnel se connecte par
  nom d'utilisateur), la colonne interrogée est décidée dans `checkCredentials`,
  et une adresse malformée reçoit la même réponse qu'un compte inexistant — ce
  qui est aussi ce qui empêche le formulaire de dire à un inconnu quels comptes
  existent. Throttling avec délai arrondi vers le haut « pour que le message ne
  dise jamais réessayez dans 0 minute ». Et un enseignant qui tape son bon mot de
  passe sur le web reçoit un message distinct de « identifiants invalides » : il
  n'y a rien à protéger en restant vague, et il mérite qu'on lui dise quelle
  application est la sienne.
- **`context`** — les deux bascules ne font jamais confiance à l'id du client :
  l'école doit être dans `context.schools`, et l'année doit appartenir à l'école
  en contexte. Changer d'école déplace aussi vers une année sensée de la nouvelle
  plutôt que de garder celle de l'école qu'on vient de quitter.
- **`portal`** — voir la section « frontière enseignant ↔ parent ». Une
  correction appliquée.

**Rien à changer par ailleurs.** `quick-actions` (liste fixe filtrée par
permission, dans le header et non sur le dashboard) et `section-card` (couleur
dérivée du `href` via `sectionForPath`, pas de seconde liste à tenir) sont bien
posés. Les charts choisissent quatre formes pour quatre questions différentes et
disparaissent proprement quand il n'y a rien à tracer.
