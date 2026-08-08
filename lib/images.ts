/**
 * What the app accepts in an image column.
 *
 * Every logo and every avatar is a `String?` holding one of two things:
 *
 *   * an `https:` URL — somebody pasted a link to an image hosted elsewhere;
 *   * a `data:` URI — somebody chose a file, which the browser resized and
 *     encoded before it ever left the page (see components/form/image-field).
 *
 * ── Why the picture goes in the database ─────────────────────────────────────
 * There is no object store, and adding one for a few hundred crests and
 * portraits would be infrastructure the rest of this app does not need. Writing
 * to the filesystem is worse than it looks: `public/` is copied at build time,
 * so a runtime upload there is not served in production without a route handler
 * to read it back, and on an ephemeral host it is gone at the next deploy.
 *
 * Keeping the bytes in SQLite means a backup is one file copy, a restore is the
 * same, and `<img src>` works unchanged because a data URI *is* a URL. The cost
 * is row size, which is exactly what `MAX_IMAGE_BYTES` is here to bound — the
 * browser resizes before encoding, so the cap is a guard against a crafted
 * request rather than something an ordinary user meets.
 *
 * Pure data: no server imports, no React. The client picker and the zod schemas
 * both measure with the same function, so the browser cannot believe an image
 * is acceptable that the server will then refuse.
 */

/**
 * The most a stored image may weigh, in bytes of the stored string.
 *
 * 256 KB. A 512-pixel WebP crest lands around 20–40 KB and a 256-pixel avatar
 * under 20 KB, so this leaves room for a large logo without letting a full
 * camera photo through. A thousand pupils with portraits is then about 20 MB of
 * database, which SQLite carries without complaint.
 */
export const MAX_IMAGE_BYTES = 256 * 1024;

/** Longest edge, in pixels, the picker resizes down to before encoding. */
export const IMAGE_MAX_EDGE = { avatar: 256, logo: 512 } as const;

export type ImageKind = keyof typeof IMAGE_MAX_EDGE;

/** The formats the picker will read. */
export const ACCEPTED_IMAGE_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/svg+xml",
] as const;

/** Byte length of a stored value, counted the way the database will store it. */
export function imageByteLength(value: string): number {
  // Not `value.length`: a UTF-8 character can be several bytes, and the cap is
  // about storage rather than about how many characters were typed.
  return new TextEncoder().encode(value).length;
}

export type ImageProblem = "not-an-image" | "too-large" | "bad-url";

/**
 * Whether a value may be stored in an image column, and why not when it may not.
 *
 * `data:` URIs are restricted to image media types. Without that check the
 * column would accept `data:text/html;base64,…`, which is a stored cross-site
 * scripting payload the moment anything renders it outside an `<img>`.
 */
export function checkImageValue(value: string): ImageProblem | null {
  const trimmed = value.trim();
  if (trimmed === "") return null;

  if (trimmed.startsWith("data:")) {
    if (!/^data:image\/[a-z0-9.+-]+;base64,/i.test(trimmed)) {
      return "not-an-image";
    }
    return imageByteLength(trimmed) > MAX_IMAGE_BYTES ? "too-large" : null;
  }

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return "bad-url";
  }

  /*
    `https:` only — `javascript:` and friends must never reach an `src`, and
    plain `http:` is refused for a duller reason: it cannot work.

    The note at the top of this file has always said `https:`, and the check
    accepted both. Every browser blocks a plaintext image on an https page as
    mixed content, so an `http:` crest saved without complaint is a crest that
    silently never appears — and the one place it is most visible is the login
    screen, which is public, where it would also mean an unauthenticated
    plaintext request to somebody else's host for every visitor.

    Refusing it at the form is what tells an administrator to fix the link
    rather than leaving them to wonder why the logo is missing.
  */
  return url.protocol === "https:" ? null : "bad-url";
}

/** Whether a value is safe to hand to an `<img src>`. */
export function isDisplayableImage(value: string | null | undefined): boolean {
  return typeof value === "string" && checkImageValue(value) === null && value.trim() !== "";
}

/** Human-readable size, for the picker's "23 KB" hint. */
export function formatImageSize(bytes: number): string {
  return bytes < 1024
    ? `${bytes} B`
    : `${Math.round(bytes / 1024)} KB`;
}
