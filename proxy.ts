import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Next 16 renamed Middleware to Proxy. This runs on the Node.js runtime.
 *
 * This is an *optimistic* check only: it looks at whether a session cookie is
 * present, never at whether it is valid. Real authentication and authorization
 * happen in lib/dal.ts on every request. Keeping it cookie-shallow also keeps
 * it fast, which is what the proxy layer is for.
 */

// Auth.js v5 prefixes the cookie with `__Secure-` when running over HTTPS.
const SESSION_COOKIES = [
  "authjs.session-token",
  "__Secure-authjs.session-token",
];

/** Reachable without a session cookie. */
const PUBLIC_PATHS = ["/login", "/no-access"];

/**
 * Of those, the ones a signed-in visitor is bounced away from.
 *
 * `/no-access` is deliberately not here: it exists precisely for somebody
 * holding a perfectly valid session the web app will not open — a teacher, whose
 * work is on the phone. Bouncing them to `/` would send them straight back to
 * the redirect in `requireAuth` that put them there, and round again.
 */
const SIGNED_OUT_ONLY = ["/login"];

const matches = (paths: string[], pathname: string) =>
  paths.some((path) => pathname === path || pathname.startsWith(`${path}/`));

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const hasSessionCookie = SESSION_COOKIES.some((name) =>
    request.cookies.has(name),
  );
  const isPublic = matches(PUBLIC_PATHS, pathname);

  if (!hasSessionCookie && !isPublic) {
    const url = new URL("/login", request.nextUrl);
    // Send the user back where they were headed once they sign in.
    if (pathname !== "/") url.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(url);
  }

  if (hasSessionCookie && matches(SIGNED_OUT_ONLY, pathname)) {
    return NextResponse.redirect(new URL("/", request.nextUrl));
  }

  return NextResponse.next();
}

export const config = {
  // Skip API routes (Auth.js owns /api/auth), Next internals and static assets.
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
