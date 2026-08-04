import "server-only";

import { NextResponse } from "next/server";

import { ForbiddenError, getAuthContext, type AuthContext } from "@/lib/dal";

/**
 * Plumbing for the native app's JSON API.
 *
 * Route handlers here stay as thin as the pages do: authorize, call a module's
 * `queries.ts`, return the DTO. No business rule and no `where` clause lives in
 * `app/api/`, for exactly the reason none lives in `app/`.
 *
 * The one thing that must differ from a page: `requireAuth()` redirects, which
 * is the right answer for a browser and a useless one for a phone. Everything
 * here answers with a status code instead.
 */

export type ApiHandler<T> = (context: AuthContext) => Promise<T>;

/**
 * Cross-origin access, **in development only**.
 *
 * A native client is not subject to CORS at all, so this buys the shipped app
 * nothing — it exists so the Expo web preview, served from another port, can
 * reach the API while somebody is working on a screen. Allowing any origin in
 * production would let any page on the internet make credentialed calls on a
 * signed-in user's behalf, so the headers are simply not emitted there.
 */
const ALLOW_CROSS_ORIGIN = process.env.NODE_ENV !== "production";

function withCors(response: NextResponse): NextResponse {
  if (!ALLOW_CROSS_ORIGIN) return response;

  response.headers.set("access-control-allow-origin", "*");
  response.headers.set("access-control-allow-methods", "GET,POST,OPTIONS");
  response.headers.set("access-control-allow-headers", "authorization,content-type");
  return response;
}

/** Preflight. Every mobile route re-exports this as its `OPTIONS`. */
export function preflight(): NextResponse {
  return withCors(new NextResponse(null, { status: 204 }));
}

export function json<T>(data: T, status = 200): NextResponse {
  return withCors(NextResponse.json(data, { status }));
}

export function apiError(
  code: string,
  message: string,
  status: number,
): NextResponse {
  return withCors(NextResponse.json({ error: { code, message } }, { status }));
}

/**
 * Resolves the caller through the DAL — cookie or Bearer token, decided in
 * `lib/dal.ts` — and hands the handler a full `AuthContext`. The handler is
 * still expected to authorize: being signed in is not being allowed.
 */
export async function withAuth<T>(
  handler: ApiHandler<T>,
): Promise<NextResponse> {
  const context = await getAuthContext();
  if (!context) {
    return apiError("unauthenticated", "Sign in to continue.", 401);
  }

  try {
    const data = await handler(context);
    // A query answering null means "not yours, or not there" — the two are one
    // answer on purpose, since telling them apart confirms a row exists.
    if (data === null) return apiError("not_found", "Not found.", 404);
    return json(data);
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return apiError("forbidden", "You may not do that.", 403);
    }
    // Genuine bugs are not the client's business, and the message may name a
    // table. Log and answer with nothing.
    console.error("[mobile-api]", error);
    return apiError("server_error", "Something went wrong.", 500);
  }
}

/**
 * A date from a query string, defaulting to today at local midnight. Every
 * date-keyed row in this schema is stored at midnight, so a raw `new Date()`
 * would match nothing.
 */
export function dateParam(value: string | null): Date {
  const parsed = value ? new Date(value) : new Date();
  const date = Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  date.setHours(0, 0, 0, 0);
  return date;
}
