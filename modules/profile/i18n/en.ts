/**
 * Own profile translations (en).
 *
 * Merged into the app dictionary by `lib/i18n/dictionaries/en.ts`. The
 * English file defines the shape; `fr` and `ar` are checked against it, so a
 * key added here is a compile error until every language supplies it.
 */
const en = {
  profile: {
    title: "Profile",
    subtitle: "Your personal details and password.",
    personal: "Personal information",
    firstName: "First name",
    lastName: "Last name",
    phone: "Phone",
    jobTitle: "Job title",
    bio: "Bio",
    avatarUrl: "Avatar URL",
    email: "Email address",
    emailReadonly: "Contact an administrator to change your email address.",
    updated: "Profile updated.",
    security: "Security",
    changePassword: "Change password",
    currentPassword: "Current password",
    newPassword: "New password",
    confirmPassword: "Confirm new password",
    passwordChanged:
      "Password changed. You will need to sign in again here, and every other device has been signed out.",
    passwordMismatch: "The two passwords do not match.",
    wrongCurrentPassword: "Your current password is incorrect.",
    access: "Your access",
    orgRole: "Organisation role",
    schoolRoles: "School roles",
  },
} as const;

/** Sidebar labels this module contributes to the `nav` namespace. */
export const nav = {
  profile: "Profile",
} as const;

export default en;
