import type { NextConfig } from "next";

/**
 * Response headers every route carries.
 *
 * This app is an administration console: one click inside it deletes a pupil,
 * cancels a receipt or changes what a family is charged. That makes the headers
 * below load-bearing rather than hygiene — `frame-ancestors` in particular,
 * because without it any page on the internet can put the console in an
 * invisible iframe and borrow a signed-in director's clicks.
 *
 * ── Why there is no `script-src` ─────────────────────────────────────────────
 * A script policy worth having needs a per-request nonce threaded through the
 * document, and this app renders an inline script before first paint to resolve
 * `mode: "system"` (see modules/appearance). Shipping `script-src` with
 * `'unsafe-inline'` to accommodate that would be a policy that reads strict and
 * defends nothing. The directives here are the ones that are exact — each either
 * fully closes its attack or is absent.
 */
const SECURITY_HEADERS = [
  {
    key: "Content-Security-Policy",
    value: [
      // Clickjacking. The console is never legitimately framed.
      "frame-ancestors 'none'",
      // Stops an injected <base> silently re-pointing every relative URL.
      "base-uri 'self'",
      // Forms post to this app or nowhere — a hijacked action cannot exfiltrate.
      "form-action 'self'",
      "object-src 'none'",
      // Crests and portraits are stored as data: URIs, and a school may paste an
      // https: link to one — see lib/images.ts.
      "img-src 'self' data: https:",
    ].join("; "),
  },
  // The older header for the same thing, for anything that predates CSP Level 2.
  { key: "X-Frame-Options", value: "DENY" },
  // A stored data: URI must never be sniffed into something executable.
  { key: "X-Content-Type-Options", value: "nosniff" },
  /*
    Paths in this app name people: /students/<id>, /families/<id>. Sending a
    full URL to a third party as a Referer would leak that a particular record
    was open, so cross-origin requests get the origin alone and plain-HTTP ones
    get nothing.
  */
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Nothing here needs a camera, a microphone or a location.
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  /*
    Ignored by browsers when served over plain HTTP (RFC 6797 §8.1), so this is
    safe for a school running the app on a LAN and takes effect the moment one
    puts it behind TLS.
  */
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains",
  },
];

const nextConfig: NextConfig = {
  // Volunteers the framework and its version to anyone scanning. No reason to.
  poweredByHeader: false,

  /*
    The dev server blocks cross-origin requests to its own assets, and reaching
    it by LAN address is cross-origin even on the same machine. Listed so the
    console can be shown on a phone or another desk without HMR breaking.
    Development only — `next start` ignores it.
  */
  allowedDevOrigins: ["10.1.15.2"],

  headers() {
    return Promise.resolve([{ source: "/:path*", headers: SECURITY_HEADERS }]);
  },
};

export default nextConfig;
