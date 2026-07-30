/**
 * Authentication translations (en).
 *
 * Merged into the app dictionary by `lib/i18n/dictionaries/en.ts`. The
 * English file defines the shape; `fr` and `ar` are checked against it, so a
 * key added here is a compile error until every language supplies it.
 */
const en = {
  auth: {
    signInTitle: "Sign in",
    signInSubtitle: "Access your school administration dashboard.",
    email: "Email address",
    password: "Password",
    signIn: "Sign in",
    signingIn: "Signing in…",
    signOut: "Sign out",
    invalidCredentials: "Incorrect email or password.",
    accountDisabled: "This account has been deactivated.",
    brandTagline: "Multi-school administration, one organisation.",
  },
} as const;

export default en;
