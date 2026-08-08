/**
 * Where the app is willing to send a browser after signing in.
 *
 * `callbackUrl` arrives in the query string — proxy.ts puts the path there when
 * it bounces an unauthenticated request — so it is attacker-controlled: anybody
 * can send a member of staff a link to the real login page carrying a callback
 * of their choosing. A bare `startsWith("/")` does not survive that, because
 * `//evil.com` and `/\evil.com` both begin with a slash and both resolve to
 * another host, which turns the school's own login screen into a credible
 * staging post for a phishing page.
 *
 * So the value is resolved against a throwaway origin and kept only when it
 * lands back on that same origin. Anything that escapes it — an absolute URL, a
 * protocol-relative one, a backslash the URL parser folds into a slash — is
 * dropped for the fallback rather than corrected, since a login redirect has no
 * business guessing what an off-site path was supposed to mean.
 *
 * Pure: no request, no session, no imports. Safe to call from anywhere.
 */

/** Never navigated to — only used to tell "same origin" from "somewhere else". */
const RESOLUTION_ORIGIN = "http://redirect.invalid";

export function safeCallbackPath(
  value: string | null | undefined,
  fallback = "/",
): string {
  if (typeof value !== "string") return fallback;

  const candidate = value.trim();
  if (candidate === "" || !candidate.startsWith("/")) return fallback;

  let url: URL;
  try {
    url = new URL(candidate, RESOLUTION_ORIGIN);
  } catch {
    return fallback;
  }

  // The check that matters: `//evil.com` parses to a different origin despite
  // its leading slash, and so does `/\evil.com` once the parser folds the
  // backslash. Both leave here as the fallback.
  if (url.origin !== RESOLUTION_ORIGIN) return fallback;

  const path = `${url.pathname}${url.search}${url.hash}`;

  // Checking the *input* is not enough, because the answer is a fresh string
  // that gets parsed again by the browser — against the school's origin, not
  // this one. `/..//evil.com` resolves here to a same-origin URL whose pathname
  // is `//evil.com`, so it passes the check above and then leaves as a
  // protocol-relative URL: exactly the redirect this function exists to stop.
  // A leading `//` is the only shape that does this, since `pathname` is
  // already normalised by the parser and always begins with a slash.
  if (path.startsWith("//")) return fallback;

  return path;
}
