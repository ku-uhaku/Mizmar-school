/**
 * Users translations (fr).
 *
 * Merged into the app dictionary by `lib/i18n/dictionaries/fr.ts`. The
 * English file defines the shape; `fr` and `ar` are checked against it, so a
 * key added here is a compile error until every language supplies it.
 */
const fr = {
  user: {
    title: "Utilisateurs",
    subtitle: "Les personnes pouvant se connecter au tableau de bord.",
    newUser: "Nouvel utilisateur",
    editUser: "Modifier l'utilisateur",
    createUser: "Créer l'utilisateur",
    firstName: "Prénom",
    lastName: "Nom",
    email: "Adresse e-mail",
    password: "Mot de passe",
    passwordHint: "Au moins 8 caractères.",
    passwordEditHint: "Laissez vide pour conserver le mot de passe actuel.",
    phone: "Téléphone",
    jobFunction: "Fonction",
    noJobFunctions:
      "Aucune fonction n'est configurée pour cet établissement — ajoutez-en une sous Configuration.",
    birthDate: "Date de naissance",
    birthDateHint: "Sert à calculer l'âge.",
    age: "Âge",
    ageYears: "{count} ans",
    orgRole: "Rôle d'organisation",
    orgRoleHint: "S'applique à toutes les écoles. Laissez vide pour un accès par école uniquement.",
    schoolAccess: "Accès aux écoles",
    schoolAccessHint: "Attribuez un rôle à l'utilisateur dans chaque école concernée.",
    noAccess: "Aucun accès",
    active: "Compte actif",
    superAdmin: "Super administrateur",
    superAdminHint: "Contourne toutes les vérifications de permissions.",
    lastLogin: "Dernière connexion",
    never: "Jamais",
    created: "Utilisateur créé.",
    updated: "Utilisateur mis à jour.",
    deleted: "Utilisateur supprimé.",
    deleteTitle: "Supprimer cet utilisateur ?",
    deleteBody: "« {name} » perdra immédiatement son accès et sera supprimé.",
    emailTaken: "Cette adresse e-mail est déjà enregistrée.",
    username: "Nom d’utilisateur",
    usernameHint: "Ce qu’il ou elle saisit pour se connecter. Proposé d’après le nom — modifiable.",
    usernameTaken: "Ce nom d’utilisateur est déjà pris.",
    cannotDeleteSelf: "Vous ne pouvez pas supprimer votre propre compte.",
    cannotDemoteSelf: "Vous ne pouvez pas retirer votre propre statut de super administrateur.",
    noUsers: "Aucun utilisateur pour le moment.",
    searchPlaceholder: "Rechercher par nom ou e-mail…",
    nameColumn: "Utilisateur",
    you: "Vous",
    schoolsCount: "{count} écoles",
  },
};

/** Sidebar labels this module contributes to the `nav` namespace. */
export const nav = {
  users: "Utilisateurs",
};

/** Permission matrix labels for this module's own codes. */
export const permissions = {
  groups: {
    user: "Utilisateurs",
  },
  codes: {
    "user.view": "Consulter les utilisateurs",
    "user.create": "Créer des utilisateurs",
    "user.update": "Modifier les utilisateurs",
    "user.delete": "Supprimer des utilisateurs",
    "user.assignRole": "Attribuer des rôles aux utilisateurs",
  },
};

export default fr;
