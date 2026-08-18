import "server-only";

import { headers } from "next/headers";

const ONE_YEAR = 60 * 60 * 24 * 365;

export type PreferenceCookieOptions = {
  httpOnly: true;
  sameSite: "lax";
  path: "/";
  maxAge: number;
  secure: boolean;
};

/**
 * Options for the preference cookies — `locale` and `ui-prefs`.
 *
 * `secure` follows the protocol the request actually arrived on, and
 * deliberately not `NODE_ENV`. A browser silently discards a `Secure` cookie
 * that arrives over plain HTTP, so a production build served without TLS — the
 * Docker stack publishes port 3000 as it is — lost every preference write. The
 * language looked as though it changed, because `setLocaleAction` re-renders
 * the tree itself, then reverted to the default on the next server render: the
 * cookie behind it had never been stored. Changing the theme is what usually
 * exposed it, since setting a cookie makes Next re-render the route.
 *
 * Next populates `x-forwarded-proto` on every request and passes through the
 * one a reverse proxy sets, so a deployment terminating TLS in front of the app
 * still gets `Secure`.
 */
export async function preferenceCookieOptions(): Promise<PreferenceCookieOptions> {
  // A proxy chain sends a comma-separated list; the client-facing hop is first.
  const proto = (await headers()).get("x-forwarded-proto")?.split(",")[0]?.trim();

  return {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: ONE_YEAR,
    secure: proto === "https",
  };
}
