/**
 * Authentication translations (fr).
 *
 * Merged into the app dictionary by `lib/i18n/dictionaries/fr.ts`. The
 * English file defines the shape; `fr` and `ar` are checked against it, so a
 * key added here is a compile error until every language supplies it.
 */
const fr = {
  auth: {
    signInTitle: "Connexion",
    signInSubtitle: "Accédez au tableau de bord d'administration scolaire.",
    email: "Adresse e-mail",
    password: "Mot de passe",
    signIn: "Se connecter",
    signingIn: "Connexion…",
    signOut: "Se déconnecter",
    invalidCredentials: "E-mail ou mot de passe incorrect.",
    accountDisabled: "Ce compte a été désactivé.",
    tooManyAttempts:
      "Trop de tentatives de connexion échouées. Réessayez dans {minutes} minutes.",
    brandTagline: "L'administration multi-écoles, une seule organisation.",
    panelHeadline: "Toute la vie de vos écoles, au même endroit.",
    highlightSchools: "Chaque école, niveau et classe du groupe.",
    highlightPeople: "Élèves, familles et personnel sur un seul dossier.",
    highlightSecure: "Des accès accordés rôle par rôle, école par école.",
    showPassword: "Afficher le mot de passe",
    hidePassword: "Masquer le mot de passe",
    poweredBy: "Édité par",
  },
};

export default fr;
