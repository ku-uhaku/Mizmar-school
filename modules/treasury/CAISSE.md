# Le module Caisse (`treasury`)

Documentation fonctionnelle du module `treasury` — la caisse de l'école : les
tiroirs-caisses, les encaissements des familles, les décaissements, les
virements entre caisses, et le suivi des chèques.

## 1. Ce que le module possède

Le module `treasury` **possède** douze tables (`prisma/schema/treasury/`) et
**gère aussi** la moitié « encaissement » du module `billing/enrolment` : un
paiement *est* un mouvement d'argent, donc le reçu et son affectation aux
lignes de l'échéancier d'un élève vivent ici plutôt que dans le module qui
décide de ce qui est dû.

| Table | Rôle |
|---|---|
| `CashRegister` | Une caisse physique (un tiroir). Ne détient aucun solde propre — il est toujours recalculé. |
| `CashSession` | Une ouverture de caisse, du moment où elle est déverrouillée au moment où elle est comptée et fermée. |
| `CashOperation` | **La seule table sur laquelle un solde est jamais calculé.** Une ligne par mouvement : encaissement, décaissement, virement. |
| `Payment` | Un reçu — une famille remettant de l'argent un jour donné, réglant les lignes d'échéancier de son choix. |
| `PaymentTender` | Une forme d'argent composant un reçu (espèces, chèque, virement) — permet « 500 en espèces + 1500 par chèque » en une seule opération. |
| `PaymentAllocation` | Le lien entre un reçu et une ligne d'échéancier (`EnrollmentFee`) — combien de ce reçu règle quelle mensualité de quel enfant. |
| `Cheque` | Suivi d'un chèque, de sa réception à son encaissement (ou son rejet). |
| `Bank` | Les banques avec lesquelles l'école traite réellement (regroupe « Attijariwafa », « AWB », « Attijari »…). |
| `OperationCategory` / `OperationSubcategory` | La rubrique budgétaire d'un mouvement (« Fournitures › Papeterie »), sur deux niveaux — pas un arbre. |
| `OperationMotif` | Le motif écrit par le bursier, en langage courant (« Achat de ramettes A4 »). |
| `Supplier` | Un fournisseur régulier (Lydec, la papeterie, le propriétaire) — sa rubrique par défaut voyage avec lui, ce qui réduit le décaissement à un select. |

Toutes ces tables sont scopées par `schoolId` — chaque école ne voit que sa
propre caisse (voir `lib/dal.ts` et `modules/treasury/queries.ts`).

## 2. Les concepts clés

### 2.1 Caisse (`CashRegister`) vs. Session (`CashSession`)

Une **caisse** est le tiroir lui-même : « Caisse Principale », « Caisse
Secondaire ». Elle ne détient **aucun solde stocké** — son solde est toujours
`float d'ouverture + somme des mouvements d'espèces postés`.

Une **session** est une *garde* : de l'ouverture (avec un fond de caisse
compté) à la fermeture (avec un comptage réel). Une caisse ne peut avoir
qu'**une session ouverte à la fois** — contrainte imposée en base par
`CashSession.openKey` (voir `lib/db-keys.ts` pour l'astuce SQLite).

À la fermeture, trois chiffres sont figés pour toujours sur la ligne :
- `expectedCentimes` — ce que le grand livre dit qu'il devrait y avoir,
- `countedCentimes` — ce que le caissier a réellement compté,
- `varianceCentimes` — l'écart entre les deux.

Ces chiffres ne sont **jamais recalculés après coup** : une annulation
enregistrée la semaine suivante ne doit pas changer rétroactivement ce
qu'une caisse était censée contenir au moment où elle a été comptée.

### 2.2 Deux montants sur chaque opération

Chaque `CashOperation` porte **deux montants**, et la distinction est
centrale :

- `amountCentimes` — la valeur de l'opération.
- `cashImpactCentimes` — combien d'espèces ont physiquement bougé dans le
  tiroir, **signé** (positif = entré, négatif = sorti).

Ils diffèrent dès que l'argent n'est pas arrivé en billets : un règlement de
2000 DH composé de 500 en espèces et 1500 par chèque *vaut* 2000 mais ne
*déplace* que 500 dans le tiroir. Seul `cashImpactCentimes` est sommé pour
vérifier une caisse à la fermeture — la fonction `cashImpactOf()`
(`modules/treasury/enums.ts`) est l'unique endroit où cette règle est écrite.

### 2.3 Rien n'est jamais supprimé — tout se corrige par écriture inverse

Aucune opération, aucun reçu n'est jamais édité ou supprimé après coup. Une
**annulation** :
1. change le statut (`POSTED` → `CANCELLED`),
2. écrit une **opération miroir** qui pointe vers l'originale
   (`reversesOperationId`), datée du jour de la correction.

L'opération d'origine reste `POSTED` — c'est le cœur du système : l'argent
*est* réellement entré ce jour-là, le barrer *et* poster une écriture inverse
le retirerait deux fois du tiroir. Une caisse qui était juste le matin
afficherait un manque le soir.

Cela signifie que le grand livre (`Opérations`) lit exactement ce qui s'est
passé, jamais ce qu'on aurait souhaité.

**Ce qui peut être annulé, et où :**

| Type de mouvement | Où l'annuler | Effet |
|---|---|---|
| Un reçu (encaissement famille) | Tableau des reçus, `/caisse` | Les frais repartent sur l'échéancier |
| Un décaissement, un virement | Grand livre, bouton sur la ligne | Écriture inverse ; un salaire ou une avance repasse en « non payé » |

Deux règles encadrent une annulation qui **fait bouger des espèces** :

1. elle est postée dans **la caisse de celui qui annule** (ou, pour un
   décaissement, dans la caisse d'origine du mouvement) — jamais dans « la
   première caisse ouverte venue », ce qui mettait l'écart au nom d'un collègue ;
2. elle est **refusée** si le tiroir ne contient pas la somme à rendre. On ne
   rend pas des espèces qu'on n'a pas.

Une avance déjà **récupérée sur un bulletin** bloque l'annulation de son
décaissement : il faudrait sinon retenir sur un salaire une avance que l'employé
n'a jamais reçue. Le bulletin se rectifie d'abord.

### 2.4 Le reçu est fait à la famille, pas à l'élève

Un parent avec trois enfants scolarisés paie une fois et attend **un seul**
papier. Le `Payment` appartient donc à la `Family`, et c'est
`PaymentAllocation` qui dit quelles lignes de quels enfants il règle — un
reçu peut couvrir deux enfants sur une même transaction.

Le reçu ne porte aucun « mode de paiement » propre : ce qu'il a été réglé
*avec* vit dans ses `PaymentTender` (un par forme d'argent), ce qui est ce
qui permet « 500 en espèces et le reste par chèque » en une seule écriture au
lieu de deux reçus.

### 2.5 Le chèque n'est pas de l'argent — pas encore

Un chèque pris en octobre, daté pour décembre, déposé en décembre, peut
revenir impayé en janvier. La table `Cheque` existe pour répondre à deux
questions qu'un simple reçu ne peut pas répondre : « qu'est-ce qui traîne
dans le tiroir non déposé ? » et « qu'est-ce qui est revenu impayé ? ».

Cycle de vie (`modules/treasury/enums.ts`) :

```
PENDING → DEPOSITED → CASHED        (chemin normal — le seul où l'argent arrive)
                    → BOUNCED       (rejeté)
        → RETURNED                  (rendu à la famille, sans passer en banque)
        → CANCELLED                 (saisi par erreur)
```

`CASHED` est la seule fin où le chèque est devenu de l'argent. Les trois autres
sont le même fait vu du reçu — *ce papier ne paiera pas* — et le système les
traite donc pareil : si un chèque **entrant** y arrive, il **annule
automatiquement le reçu** qu'il avait réglé, et les frais repartent sur
l'échéancier de la famille par le même mécanisme que toute autre annulation. Il
n'existe qu'**une seule** façon pour de l'argent de revenir sur une ligne de
facturation (`UNPAID_CHEQUE_ENDINGS`, `setChequeStatus`).

> Seul `BOUNCED` défaisait le reçu. Un chèque restitué ou annulé laissait donc
> le reçu debout : la famille restait « à jour » d'un chèque qui n'existait
> plus, et la caisse continuait de compter l'argent. C'est corrigé.

Un chèque **sortant**, ou un chèque suivi seul, ne règle aucun reçu : le solder
ne déplace que sa propre ligne.

**Et sur un reçu mixte, seul le chèque est défait.** Un règlement de 2 000 en
500 espèces + 1 500 par chèque dont le chèque ne paie pas :

* le reçu d'origine est annulé (on ne peut pas dire quelle mensualité les 500
  ont réglée — l'affectation était un seul acte) ;
* **les espèces ne sont pas reversées** : elles n'ont jamais quitté le tiroir,
  et l'écriture inverse porte donc un impact caisse nul ;
* un **reçu de remplacement** est émis automatiquement pour les 500, affecté aux
  mêmes lignes, mensualité la plus ancienne d'abord.

Résultat : la famille redoit exactement le montant du chèque, la caisse ne bouge
pas d'un centime, et les 500 restent rattachés à un reçu vivant. Un autre chèque
porté sur le même reçu suit le remplacement plutôt que d'être rendu
(`keepChequeIds`) — c'est toujours le même papier, la banque n'en sait rien.

## 3. Les écrans (`/caisse/*`)

Le module contribue sept entrées de navigation, une par question qu'un
bursier se pose (voir `modules/treasury/module.ts`) :

| Écran | Route | Permission | Ce qu'il fait |
|---|---|---|---|
| **Vue d'ensemble** | `/caisse` | `TREASURY_VIEW` | Résumé du jour, état de chaque caisse, reçus récents, grand livre complet. |
| **Encaissement** | `/caisse/encaissement` | `TREASURY_COLLECT` | Prendre l'argent d'une famille et le répartir sur les échéances. |
| **Familles** | `/caisse/familles` | `TREASURY_VIEW` | La situation de chaque foyer : ce qui est dû, ce qui est payé, qui est en retard. |
| **Décaissement** | `/caisse/decaissement` | `TREASURY_DISBURSE` | Payer quelqu'un (salaire, fournisseur, dépense). |
| **Transfert** | `/caisse/transfert` | `TREASURY_TRANSFER` | Déplacer de l'argent d'une caisse vers une autre caisse ou vers la banque. |
| **Suivi chèques** | `/caisse/cheques` | `TREASURY_CHEQUES` | Faire avancer un chèque dans son cycle de vie. |
| **Caisses** | `/caisse/registers` | `TREASURY_VIEW` (gérer : `TREASURY_SESSION`) | Créer/gérer les tiroirs, ouvrir/fermer les sessions. |

### 3.1 Vue d'ensemble (`/caisse`)

Composée de :
- **`TreasuryDashboard`** — les chiffres du jour : espèces attendues dans les
  tiroirs ouverts, nombre de caisses ouvertes, encaissé/décaissé aujourd'hui
  (net des annulations du jour), chèques en attente et leur montant, nombre
  de chèques rejetés.
- **`SessionBar`** — l'état de chaque caisse et le bouton pour l'ouvrir ou la
  fermer.
- **`ReceiptsTable`** — les 25 derniers reçus, avec bouton d'annulation si
  autorisé.
- **`OperationsTable`** — le grand livre (`listOperations`), filtrable par
  type/statut/session. Plafonné aux 200 mouvements les plus récents : au-delà,
  c'est un export qu'il faut, pas une page.

Une session close a son propre écran (`/caisse/registers/sessions/[sessionId]`)
et sa version imprimable (`app/(print)/print/caisse/session/[sessionId]`) — le
détail d'une garde, du fond de caisse au comptage.

### 3.2 Encaissement (`/caisse/encaissement`)

L'écran où l'argent entre. La famille choisie voyage **dans l'URL**
(`?family=<id>`), pas dans un état client — recharger la page ou envoyer le
lien à un collègue retombe sur le même échéancier plutôt que sur un écran
vide.

Fonctionnement (`recordPaymentAction` → `recordPayment` dans `service.ts`) :
1. Le bursier choisit une famille → l'écran affiche chaque enfant et chaque
   ligne d'échéancier encore due (`findPayableFamily`), avec le montant déjà
   réglé et le reste dû.
2. Il sélectionne les lignes à régler et le montant sur chacune.
3. Il saisit le ou les moyens de paiement (espèces / chèque / virement) — un
   ou plusieurs, d'où le nom « tenders ».
4. Le serveur vérifie, **dans une transaction**, que :
   - le total des moyens de paiement = le total des affectations,
   - chaque ligne appartient bien à cette école/année (jamais l'id du
     formulaire seul),
   - aucune ligne n'est sur-réglée — relu **à l'intérieur** de la
     transaction, pour que deux caissiers ne puissent pas régler la même
     mensualité en même temps.
5. Un chèque déclaré comme moyen de paiement fait naître automatiquement une
   ligne `Cheque` en statut `PENDING`.
6. Une seule `CashOperation` de type `ENCAISSEMENT` est postée, avec l'impact
   caisse calculé (seule la part en espèces compte).
7. Un numéro de reçu est attribué (`R-2026-0187`), séquentiel par école et
   par année.

Toute l'opération est une seule transaction : un reçu qui aurait sauvegardé
son chèque mais pas ses affectations serait pire qu'un échec complet.

**Une ligne, une affectation.** Une requête qui nomme deux fois la même
mensualité (double-clic, POST forgé) est d'abord *additionnée* en une seule
affectation, puis confrontée au reste dû. Vérifier chaque moitié séparément
laissait passer le double du montant : chacune était comparée à un reste dû qui
ignorait l'autre.

**Le numéro de reçu est attribué dans la transaction**, et une collision entre
deux caissiers est réessayée (jusqu'à cinq fois) au lieu de remonter en erreur
au comptoir.

### 3.3 Décaissement (`/caisse/decaissement`)

L'argent qui sort — salaire, fournisseur, dépense courante
(`recordDisbursementAction` → `recordDisbursement`). Le formulaire propose :
- une **rubrique** et éventuellement une **sous-rubrique**
  (`OperationCategory`/`OperationSubcategory`, filtrées à `kind: OUT` ou
  `BOTH`),
- un **motif** (`OperationMotif`),
- un **bénéficiaire** — soit un membre du personnel (`beneficiaryStaffId`,
  proposé seulement si le lecteur peut voir la liste RH), soit un nom libre
  (`beneficiaryName`, toujours requis) pour un propriétaire, un transporteur,
  etc. qui n'a pas de fiche dans l'application,
- le **moyen de paiement** — un chèque sortant déclaré fait naître une ligne
  `Cheque` (`direction: OUTGOING`).

### 3.4 Transfert (`/caisse/transfert`)

Déplace de l'argent **sans qu'il soit ni gagné ni dépensé** — entre deux
caisses, ou d'une caisse vers la banque (`recordTransferAction` →
`recordTransfer`). C'est délibérément un troisième type d'opération
(`TRANSFERT`) plutôt que « décaissement ici + encaissement là » : compter un
transfert comme une dépense d'un côté et une recette de l'autre gonflerait
les deux totaux du rapport financier.

Un transfert **caisse-à-caisse** écrit **deux lignes** partageant un
`transferGroupId` : une sortie de la caisse source, une entrée dans la caisse
destination — mais seulement **si cette dernière a une session ouverte**.
Sinon l'argent sort de la source et n'entre nulle part tant que personne
n'ouvre l'autre caisse ; c'est volontaire, l'argent ne peut pas « arriver »
dans un tiroir que personne ne tient. Un transfert **vers la banque** n'a
qu'une seule ligne, la banque n'étant pas une caisse.

### 3.5 Suivi chèques (`/caisse/cheques`)

Liste tous les chèques, triés par date d'échéance. Un bouton change le
statut (`setChequeStatusAction`) — solder un chèque entrant qui a réglé un reçu
**encore vivant** (`BOUNCED`, `RETURNED`, `CANCELLED`) exige en plus la
permission `TREASURY_CANCEL`, car cela annule ce reçu.

L'exigence porte sur le reçu, pas sur le statut : annuler la saisie d'un chèque
qui n'a rien réglé ne renverse aucun argent, et ne doit donc pas demander le
droit d'annuler. L'écran suit la même règle — l'avertissement rouge et le champ
« remarque » n'apparaissent que quand un reçu est réellement sur le point d'être
annulé (`settlesLivePayment`).

### 3.6 Caisses (`/caisse/registers`)

Créer, renommer, activer/désactiver les tiroirs, et — sur le même écran —
ouvrir/fermer leurs sessions. Gérer les caisses est protégé par
`TREASURY_SESSION` plutôt que par un code dédié : qui peut ouvrir et fermer
un tiroir est qui répond du nombre de tiroirs qui existent.

## 4. Permissions

Le découpage suit **qui fait réellement le travail**, pas les tables
(`modules/treasury/permissions.ts`) :

| Permission | Donne le droit de |
|---|---|
| `TREASURY_VIEW` | Consulter la caisse, la liste des caisses, le grand livre. |
| `TREASURY_SESSION` | Ouvrir/fermer une session, créer/gérer les caisses elles-mêmes. |
| `TREASURY_COLLECT` | Encaisser — prendre l'argent d'une famille. |
| `TREASURY_DISBURSE` | Décaisser — payer quelqu'un. |
| `TREASURY_TRANSFER` | Déplacer de l'argent entre caisses ou vers la banque. |
| `TREASURY_CHEQUES` | Faire avancer un chèque dans son cycle de vie. |
| `TREASURY_CANCEL` | Annuler un reçu **ou tout autre mouvement** (décaissement, virement), et solder un chèque qui en avait réglé un. |

Le principe de contrôle interne d'une petite école tient dans ce découpage :
une secrétaire à l'accueil encaisse toute la journée (`TREASURY_COLLECT`)
mais ne peut ni payer (`TREASURY_DISBURSE`) ni annuler un reçu déjà écrit
(`TREASURY_CANCEL`) — ces deux droits appartiennent au bursier.

## 5. Comment un solde est calculé (jamais stocké)

Aucune table ne contient « le solde de la caisse ». Tout est recalculé à la
lecture, à partir du grand livre — c'est ce qui rend un comptage vérifiable
plutôt qu'affirmé :

```
solde attendu d'une caisse ouverte
  = float d'ouverture (CashSession.openingFloatCentimes)
  + somme des cashImpactCentimes des opérations POSTED de cette session
```

**Aucun écran ne laisse sortir plus d'espèces que le tiroir n'en contient.** La
règle est écrite une seule fois (`availableIfShortOf`) et appelée par le
décaissement, le virement, le paiement d'un salaire, celui d'une avance et les
deux chemins d'annulation — un tiroir affichant moins que zéro n'est pas un état
dans lequel une caisse peut se trouver. Pour l'annulation d'un mouvement, la
vérification se fait **dans la transaction** et cumulée par caisse : les deux
jambes d'un virement qui reviennent dans le même tiroir sont pesées ensemble,
pas chacune contre le solde entier.

Le résumé du jour (`treasurySummary`) applique la même logique, avec une
subtilité pour les totaux du jour : une opération annulée dans l'heure doit
être **retirée** du total du jour, pas simplement ignorée — sinon une
recette annulée resterait comptée dans les encaissements du jour tout en
étant absente de la caisse physique. Mais l'écriture inverse porte toujours la
date du jour alors que l'originale garde la sienne : seule une annulation dont
**l'originale est du jour** est retranchée. Sans cela, annuler un reçu de la
semaine dernière affichait un encaissement négatif sur une journée qui ne
l'avait jamais compté.

**« En retard » a une seule définition** (`isOverdue`, `payment-state.ts`) : une
échéance n'est en retard qu'une fois le **jour** passé, pas à l'instant où elle
tombe. Il y en avait quatre, qui ne s'accordaient pas — la fiche de l'élève, la
liste des familles et le total de l'école pouvaient classer la même ligne
différemment le même jour.

## 6. Ce que le pupille/la famille voit ailleurs dans l'app

Le module expose aussi (via `queries.ts`) l'état de paiement d'un élève et de
sa fratrie, utilisé par le dossier élève :

- **`studentPaymentStanding`** — ce que l'élève doit, a payé, et ce qui est
  en retard (`overdueCentimes` — distinct de simplement « dû », car un élève
  facturé en 9 fois dès septembre doit la majorité de l'année sans être en
  retard).
- **`familyPaymentStanding`** — la même chose agrégée pour toute la fratrie.
- **`listStudentPayments`** — les reçus qui ont réglé *cet* élève
  spécifiquement (via les affectations, pas via la famille entière — un reçu
  familial peut ne régler qu'un seul des enfants).

**Une ligne d'échéancier déjà réglée est verrouillée.** Tant qu'un reçu vivant
pointe dessus, la grille des frais refuse de l'annuler, de la mettre en
« offerte » ou de la descendre sous le montant déjà encaissé
(`repriceFeeLine` → `ALREADY_PAID`). Sans cela, la ligne sortait du filtre
`status: "DUE"` et emportait l'argent avec elle : la caisse comptait 3 000, la
fiche de l'élève 2 000, et personne ne pouvait dire où étaient passés les 1 000.
Le chemin correct est d'annuler le reçu — le seul acte qui rende vraiment
l'argent, et qui laisse une trace disant qu'il l'a fait. Le report d'une
réduction sur les mois suivants saute pour la même raison les mois déjà réglés,
sans rien dire : c'est la réponse que le bursier aurait donnée de toute façon.

**L'application des familles lit la même règle.** `loadChildFees`
(`modules/portal/queries.ts`) ne compte que les affectations d'un reçu
`POSTED` : un chèque impayé cessait sinon de compter partout dans l'école tout
en restant « payé » sur le téléphone du parent — c'est-à-dire sur la version à
partir de laquelle il vient discuter.

L'état de chaque ligne (à jour / partiel / à venir / en retard) est calculé
par `modules/treasury/payment-state.ts`, importé aussi bien côté serveur que
côté client, pour que la couleur d'un badge ne puisse jamais diverger entre
deux écrans.

## 7. Le reçu imprimé

`app/(print)/print/payment/[paymentId]/page.tsx` imprime le détail complet
d'un reçu : chaque ligne réglée (élève, classe, type de frais, échéance,
montant), chaque moyen de paiement utilisé, et le total. Un reçu **annulé**
reste imprimable — volontairement — pour que quiconque tient la copie papier
puisse la retrouver et être informé qu'elle ne tient plus.

## 8. Fichiers du module

```
modules/treasury/
  module.ts          manifeste : nav (5 écrans) + permissions
  permissions.ts      TREASURY_VIEW, _SESSION, _COLLECT, _DISBURSE, _TRANSFER, _CHEQUES, _CANCEL
  enums.ts            valeurs autorisées + toute l'arithmétique monétaire (centimes)
  payment-state.ts    l'état d'une ligne/d'un échéancier (SETTLED/PARTIAL/UPCOMING/OVERDUE)
  validation.ts       schémas zod des formulaires
  queries.ts          lectures scopées par école — jamais par un id de la requête seul
  service.ts          écritures + invariants (session unique, totaux qui s'équilibrent, jamais de sur-paiement)
  actions.ts          "use server" — chaque action authorize d'abord, puis rescope tout id reçu
  seed.ts             données de démonstration idempotentes
  i18n/{en,fr,ar}.ts   traductions du namespace `treasury`
  components/*.tsx     les écrans et leurs formulaires
```
