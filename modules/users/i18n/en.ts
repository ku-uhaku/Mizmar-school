/**
 * Users translations (en).
 *
 * Merged into the app dictionary by `lib/i18n/dictionaries/en.ts`. The
 * English file defines the shape; `fr` and `ar` are checked against it, so a
 * key added here is a compile error until every language supplies it.
 */
const en = {
  user: {
    title: "Users",
    subtitle: "People who can sign in to the dashboard.",
    newUser: "New user",
    editUser: "Edit user",
    createUser: "Create user",
    firstName: "First name",
    lastName: "Last name",
    email: "Email address",
    emailHint: "Optional. Nothing signs in with it — the username is the login.",
    password: "Password",
    passwordHint: "At least 8 characters.",
    passwordEditHint: "Leave blank to keep the current password.",
    phone: "Phone",
    jobFunction: "Function",
    noJobFunctions:
      "No function is configured for this school yet — add one under Configuration.",
    birthDate: "Date of birth",
    birthDateHint: "Used to work out the age.",
    age: "Age",
    ageYears: "{count} years old",
    orgRole: "Organisation role",
    orgRoleHint: "Applies across every school. Leave empty for school-only access.",
    schoolAccess: "School access",
    schoolAccessHint: "Give the user a role in each school they work in.",
    noAccess: "No school access",
    active: "Account active",
    superAdmin: "Super administrator",
    superAdminHint: "Bypasses every permission check.",
    lastLogin: "Last sign-in",
    never: "Never",
    created: "User created.",
    updated: "User updated.",
    deleted: "User deleted.",
    deleteTitle: "Delete this user?",
    deleteBody: "“{name}” will lose access immediately and be removed.",
    emailTaken: "That email address is already registered.",
    username: "Username",
    usernameHint: "What they type to sign in. Suggested from the name — edit it if you like.",
    usernameTaken: "That username is already taken.",
    cannotDeleteSelf: "You cannot delete your own account.",
    cannotDemoteSelf: "You cannot remove your own super administrator status.",
    noUsers: "No users yet.",
    searchPlaceholder: "Search by name or email…",
    nameColumn: "User",
    you: "You",
    schoolsCount: "{count} schools",
  },
} as const;

/** Sidebar labels this module contributes to the `nav` namespace. */
export const nav = {
  users: "Users",
} as const;

/** Permission matrix labels for this module's own codes. */
export const permissions = {
  groups: {
    user: "Users",
  },
  codes: {
    "user.view": "View users",
    "user.create": "Create users",
    "user.update": "Update users",
    "user.delete": "Delete users",
    "user.assignRole": "Assign roles to users",
  },
} as const;

export default en;
