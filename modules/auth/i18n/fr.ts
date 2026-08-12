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
    identifier: "Nom d’utilisateur",
    identifierHint: "Votre identifiant d’école. Les parents se connectent sur l’application avec leur courriel.",
    password: "Mot de passe",
    signIn: "Se connecter",
    signingIn: "Connexion…",
    signOut: "Se déconnecter",
    invalidCredentials: "E-mail ou mot de passe incorrect.",
    accountDisabled: "Ce compte a été désactivé.",
    mobileOnlyAccount:
      "Les comptes enseignants s'utilisent sur l'application Mizmar, pas sur ce tableau de bord. Connectez-vous-y avec les mêmes identifiants.",
    noAccessTitle: "Votre espace est sur l'application",
    noAccessBody:
      "Ce compte enseigne, et le tableau de bord est celui de l'administration. Tout son travail — l'appel, les notes, le carnet, l'emploi du temps — se trouve sur l'application Mizmar.",
    noAccessHint:
      "Connectez-vous sur l'application avec les mêmes identifiants. Si vous pensez devoir accéder au tableau de bord, adressez-vous au secrétariat de votre école.",
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
