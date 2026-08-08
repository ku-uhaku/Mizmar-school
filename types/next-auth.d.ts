import type { DefaultSession } from "next-auth";

/**
 * What this app puts in the session beyond Auth.js's defaults.
 *
 * Both fields are carried in the JWT and re-checked against the database on
 * every request by lib/dal.ts — nothing here is trusted on its own. See the
 * note on `credentialsChangedAt` in prisma/schema/users/user.prisma.
 */
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      /**
       * `User.credentialsChangedAt` as it stood when this session was issued,
       * in epoch milliseconds. 0 when the password has never been changed.
       */
      credentialsStamp: number;
    } & DefaultSession["user"];
  }

  interface User {
    credentialsStamp?: number;
  }
}

export {};
