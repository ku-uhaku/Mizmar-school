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
    identifier: "Username",
    identifierHint: "Your school username. Parents sign in on the app with their email.",
    password: "Password",
    signIn: "Sign in",
    signingIn: "Signing in…",
    signOut: "Sign out",
    invalidCredentials: "Incorrect email or password.",
    accountDisabled: "This account has been deactivated.",
    tooManyAttempts:
      "Too many failed sign-in attempts. Try again in {minutes} minutes.",
    brandTagline: "Multi-school administration, one organisation.",
    panelHeadline: "Everything your schools run on, in one place.",
    highlightSchools: "Every school, level and class of the group.",
    highlightPeople: "Pupils, families and staff on a single record.",
    highlightSecure: "Access granted role by role, school by school.",
    showPassword: "Show password",
    hidePassword: "Hide password",
    poweredBy: "Published by",
  },
} as const;

export default en;
