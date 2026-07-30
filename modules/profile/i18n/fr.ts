/**
 * Own profile translations (fr).
 *
 * Merged into the app dictionary by `lib/i18n/dictionaries/fr.ts`. The
 * English file defines the shape; `fr` and `ar` are checked against it, so a
 * key added here is a compile error until every language supplies it.
 */
const fr = {
  profile: {
    title: "Profil",
    subtitle: "Vos informations personnelles et votre mot de passe.",
    personal: "Informations personnelles",
    firstName: "Prénom",
    lastName: "Nom",
    phone: "Téléphone",
    jobTitle: "Fonction",
    bio: "Biographie",
    avatarUrl: "URL de l'avatar",
    email: "Adresse e-mail",
    emailReadonly: "Contactez un administrateur pour changer votre adresse e-mail.",
    updated: "Profil mis à jour.",
    security: "Sécurité",
    changePassword: "Changer le mot de passe",
    currentPassword: "Mot de passe actuel",
    newPassword: "Nouveau mot de passe",
    confirmPassword: "Confirmer le nouveau mot de passe",
    passwordChanged: "Mot de passe modifié.",
    passwordMismatch: "Les deux mots de passe ne correspondent pas.",
    wrongCurrentPassword: "Votre mot de passe actuel est incorrect.",
    access: "Vos accès",
    orgRole: "Rôle d'organisation",
    schoolRoles: "Rôles par école",
  },
};

/** Sidebar labels this module contributes to the `nav` namespace. */
export const nav = {
  profile: "Profil",
};

export default fr;
