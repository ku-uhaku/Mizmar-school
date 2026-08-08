import { describe, expect, it, beforeEach, afterEach } from "vitest";

import { safeCallbackPath } from "@/lib/safe-redirect";
import {
  bearerToken,
  credentialsStamp,
  credentialsStillValid,
  issueTokens,
  verifyMobileToken,
} from "@/lib/mobile-token";
import { PERMISSIONS, ALL_PERMISSION_CODES, isPermissionCode } from "@/lib/permissions";
import { boolField, field, listField } from "@/lib/server-action";
import { failure, success, IDLE } from "@/lib/action-state";
import {
  normalizeUiPrefs,
  parseUiPrefsCookie,
  DEFAULT_UI_PREFS,
} from "@/modules/appearance/prefs";
import { THEME_MODES } from "@/modules/appearance/enums";

/**
 * The security core.
 *
 * Everything here is shared by every module, so a regression in this file is a
 * regression in all thirty-five of them at once. The cases are chosen to pin the
 * *reasons* the code gives for itself — the open-redirect shapes `safeRedirect`
 * names in its own comment, the token-kind confusion `mobile-token` exists to
 * stop — rather than to re-state what the implementation obviously does.
 */

// ── Open redirect ────────────────────────────────────────────────────────────

describe("safeCallbackPath", () => {
  it("keeps an ordinary in-app path", () => {
    expect(safeCallbackPath("/students")).toBe("/students");
    expect(safeCallbackPath("/students/abc123")).toBe("/students/abc123");
  });

  it("preserves query and hash, which carry filter state", () => {
    expect(safeCallbackPath("/students?page=2&q=ali")).toBe(
      "/students?page=2&q=ali",
    );
    expect(safeCallbackPath("/classes#term-2")).toBe("/classes#term-2");
  });

  it.each([
    ["protocol-relative", "//evil.com"],
    ["protocol-relative with path", "//evil.com/login"],
    ["backslash the parser folds into a slash", "/\\evil.com"],
    ["double backslash", "\\\\evil.com"],
    ["absolute http", "http://evil.com"],
    ["absolute https", "https://evil.com/pwn"],
    ["scheme-ful but slash-leading looking", "/\\/evil.com"],
    ["javascript scheme", "javascript:alert(1)"],
    ["data scheme", "data:text/html,<script>alert(1)</script>"],
    ["whitespace-padded absolute", "   https://evil.com"],
    ["tab-smuggled protocol-relative", "/\t/evil.com"],
  ])("drops %s", (_label, value) => {
    expect(safeCallbackPath(value)).toBe("/");
  });

  it.each([
    "/..//evil.com",
    "/../\\evil.com",
    "/a/b/../../..//evil.com",
    "/..//evil.com/login",
    "/./..//evil.com",
    "/students/../..//evil.com",
  ])(
    "drops %s, which the URL parser normalises back into a protocol-relative URL",
    (value) => {
      // Regression: the origin check alone passed these. `new URL("/..//evil.com",
      // origin)` is same-origin — its *pathname* is `//evil.com`, and returning
      // that hands the browser a protocol-relative URL to resolve against the
      // school's own host. So the answer is re-checked, not only the input.
      expect(safeCallbackPath(value)).toBe("/");
    },
  );

  it("drops anything that is not a string", () => {
    expect(safeCallbackPath(null)).toBe("/");
    expect(safeCallbackPath(undefined)).toBe("/");
    // A repeated ?callbackUrl= gives Next an array, not a string.
    expect(safeCallbackPath(["/a", "/b"] as unknown as string)).toBe("/");
  });

  it("drops the empty and whitespace-only cases", () => {
    expect(safeCallbackPath("")).toBe("/");
    expect(safeCallbackPath("   ")).toBe("/");
  });

  it("honours a caller's own fallback", () => {
    expect(safeCallbackPath("//evil.com", "/dashboard")).toBe("/dashboard");
    expect(safeCallbackPath(null, "/dashboard")).toBe("/dashboard");
  });

  it("never returns a value another origin could resolve against", () => {
    // The property that actually matters, stated once over the whole corpus:
    // whatever comes back must resolve to the same origin it is joined to.
    const hostile = [
      "//evil.com",
      "/\\evil.com",
      "https://evil.com",
      "\\/evil.com",
      "/%2F%2Fevil.com",
      "/..//evil.com",
    ];
    for (const value of hostile) {
      const result = safeCallbackPath(value);
      expect(new URL(result, "http://school.test").origin).toBe(
        "http://school.test",
      );
    }
  });
});

// ── Bearer tokens ────────────────────────────────────────────────────────────

describe("bearerToken", () => {
  it("pulls the credential out of a well-formed header", () => {
    expect(bearerToken("Bearer abc.def.ghi")).toBe("abc.def.ghi");
  });

  it("accepts any casing of the scheme, as RFC 7235 requires", () => {
    expect(bearerToken("bearer tok")).toBe("tok");
    expect(bearerToken("BEARER tok")).toBe("tok");
    expect(bearerToken("BeArEr tok")).toBe("tok");
  });

  it("rejects other schemes", () => {
    expect(bearerToken("Basic dXNlcjpwYXNz")).toBeNull();
    expect(bearerToken("Token abc")).toBeNull();
  });

  it("rejects a header with no credential", () => {
    expect(bearerToken("Bearer")).toBeNull();
    expect(bearerToken("Bearer ")).toBeNull();
    expect(bearerToken("Bearer    ")).toBeNull();
    expect(bearerToken("")).toBeNull();
    expect(bearerToken(null)).toBeNull();
  });
});

describe("mobile tokens", () => {
  const ORIGINAL_SECRET = process.env["AUTH_SECRET"];

  beforeEach(() => {
    process.env["AUTH_SECRET"] = "test-secret-not-the-real-one";
  });

  afterEach(() => {
    if (ORIGINAL_SECRET === undefined) delete process.env["AUTH_SECRET"];
    else process.env["AUTH_SECRET"] = ORIGINAL_SECRET;
  });

  it("round-trips the user id it was issued for", async () => {
    const { accessToken, refreshToken, expiresIn } =
      await issueTokens("user-1");

    expect(await verifyMobileToken(accessToken, "access")).toMatchObject({
      userId: "user-1",
    });
    expect(await verifyMobileToken(refreshToken, "refresh")).toMatchObject({
      userId: "user-1",
    });
    expect(expiresIn).toBe(2 * 60 * 60);
  });

  it("carries the credentials stamp it was minted with", async () => {
    const changedAt = new Date("2026-03-01T10:00:00Z");
    const { accessToken, refreshToken } = await issueTokens("user-1", changedAt);

    for (const [token, kind] of [
      [accessToken, "access"],
      [refreshToken, "refresh"],
    ] as const) {
      const verified = await verifyMobileToken(token, kind);
      expect(verified?.credentialsStamp).toBe(changedAt.getTime());
    }
  });

  it("stamps zero for an account whose password has never changed", async () => {
    const { accessToken } = await issueTokens("user-1");
    const verified = await verifyMobileToken(accessToken, "access");
    expect(verified?.credentialsStamp).toBe(0);
  });

  it("refuses a refresh token presented as an access token", async () => {
    // The whole point of the `typ` claim: a 60-day credential lifted from a
    // phone's storage must not authenticate a request on its own.
    const { refreshToken } = await issueTokens("user-1");
    expect(await verifyMobileToken(refreshToken, "access")).toBeNull();
  });

  it("refuses an access token presented as a refresh token", async () => {
    const { accessToken } = await issueTokens("user-1");
    expect(await verifyMobileToken(accessToken, "refresh")).toBeNull();
  });

  it("refuses a token signed with another secret", async () => {
    const { accessToken } = await issueTokens("user-1");
    process.env["AUTH_SECRET"] = "a-different-secret";
    expect(await verifyMobileToken(accessToken, "access")).toBeNull();
  });

  it("refuses a tampered payload", async () => {
    const { accessToken } = await issueTokens("user-1");
    const [header, payload, signature] = accessToken.split(".");
    const forged = Buffer.from(
      JSON.stringify({
        typ: "access",
        sub: "another-user",
        iss: "school-admin",
        aud: "school-mobile",
        exp: Math.floor(Date.now() / 1000) + 3600,
      }),
    ).toString("base64url");

    expect(payload).not.toBe(forged);
    expect(
      await verifyMobileToken(`${header}.${forged}.${signature}`, "access"),
    ).toBeNull();
  });

  it("refuses an unsigned `alg: none` token", async () => {
    const header = Buffer.from(
      JSON.stringify({ alg: "none", typ: "JWT" }),
    ).toString("base64url");
    const payload = Buffer.from(
      JSON.stringify({
        typ: "access",
        sub: "user-1",
        iss: "school-admin",
        aud: "school-mobile",
        exp: Math.floor(Date.now() / 1000) + 3600,
      }),
    ).toString("base64url");

    expect(await verifyMobileToken(`${header}.${payload}.`, "access")).toBeNull();
  });

  it.each([
    ["empty", ""],
    ["not a jwt", "hello"],
    ["two segments", "a.b"],
    ["four segments", "a.b.c.d"],
    ["garbage base64", "!!!.???.***"],
  ])("refuses a malformed token (%s) without throwing", async (_l, token) => {
    await expect(verifyMobileToken(token, "access")).resolves.toBeNull();
  });

  it("fails loudly rather than signing with a fallback key", async () => {
    delete process.env["AUTH_SECRET"];
    await expect(issueTokens("user-1")).rejects.toThrow("AUTH_SECRET is not set");
  });
});

// ── Evicting a credential ────────────────────────────────────────────────────

describe("credentialsStillValid", () => {
  const CHANGED = new Date("2026-03-01T10:00:00Z");

  it("accepts any credential for an account whose password never changed", () => {
    expect(credentialsStillValid(0, null)).toBe(true);
    expect(credentialsStillValid(0, undefined)).toBe(true);
    expect(credentialsStillValid(Date.now(), null)).toBe(true);
  });

  it("rejects a credential minted before the change", () => {
    // The whole point: a stolen session cookie or a sixty-day refresh token
    // stops working the moment the password behind it is reset.
    expect(credentialsStillValid(CHANGED.getTime() - 1, CHANGED)).toBe(false);
    expect(credentialsStillValid(0, CHANGED)).toBe(false);
  });

  it("accepts the credential issued by the change itself", () => {
    expect(credentialsStillValid(CHANGED.getTime(), CHANGED)).toBe(true);
  });

  it("accepts a credential minted after the change", () => {
    expect(credentialsStillValid(CHANGED.getTime() + 1000, CHANGED)).toBe(true);
  });

  it("treats a token predating the claim as older than any reset", () => {
    // Tokens minted before this mechanism existed carry no claim and read as 0,
    // so the first password change after deployment invalidates them too.
    expect(credentialsStillValid(0, new Date(1))).toBe(false);
  });

  it("survives a second change, so resetting twice does not re-admit anyone", () => {
    const first = new Date("2026-03-01T10:00:00Z");
    const second = new Date("2026-03-02T10:00:00Z");
    const issuedAfterFirst = credentialsStamp(first);

    expect(credentialsStillValid(issuedAfterFirst, first)).toBe(true);
    expect(credentialsStillValid(issuedAfterFirst, second)).toBe(false);
  });
});

describe("credentialsStamp", () => {
  it("reads a missing change date as zero", () => {
    expect(credentialsStamp(null)).toBe(0);
    expect(credentialsStamp(undefined)).toBe(0);
  });

  it("round-trips a date through the stamp", () => {
    const date = new Date("2026-03-01T10:00:00Z");
    expect(credentialsStamp(date)).toBe(date.getTime());
    expect(credentialsStillValid(credentialsStamp(date), date)).toBe(true);
  });
});

// ── Permission catalogue ─────────────────────────────────────────────────────

describe("permission catalogue", () => {
  it("is not empty", () => {
    expect(ALL_PERMISSION_CODES.length).toBeGreaterThan(0);
  });

  it("has no duplicate codes across modules", () => {
    // Two modules claiming one code means granting one silently grants the
    // other — the catalogue is a closed union precisely so that cannot happen.
    const seen = new Map<string, string[]>();
    for (const [key, code] of Object.entries(PERMISSIONS)) {
      seen.set(code, [...(seen.get(code) ?? []), key]);
    }
    const clashes = [...seen.entries()].filter(([, keys]) => keys.length > 1);
    expect(clashes).toEqual([]);
  });

  it("spells every code as `<group>.<action>`", () => {
    for (const code of ALL_PERMISSION_CODES) {
      // Groups are camelCase where the domain is two words (`schoolYear.view`).
      expect(code, `bad shape: ${code}`).toMatch(
        /^[a-z][a-zA-Z0-9-]*(?:\.[a-z][a-zA-Z0-9-]*)+$/,
      );
    }
  });

  it("recognises only codes the app actually checks", () => {
    for (const code of ALL_PERMISSION_CODES) {
      expect(isPermissionCode(code)).toBe(true);
    }
    expect(isPermissionCode("student.delete-everything")).toBe(false);
    expect(isPermissionCode("")).toBe(false);
    expect(isPermissionCode("__proto__")).toBe(false);
  });

  it("does not answer true for inherited Object properties", () => {
    // `ALL_PERMISSION_CODES.includes` is an array scan, not a key lookup — this
    // pins that it stays one.
    expect(isPermissionCode("toString")).toBe(false);
    expect(isPermissionCode("constructor")).toBe(false);
  });
});

// ── FormData helpers ─────────────────────────────────────────────────────────

describe("form field helpers", () => {
  it("trims strings and answers empty for anything missing", () => {
    const form = new FormData();
    form.set("name", "  Amine  ");
    form.set("empty", "   ");

    expect(field(form, "name")).toBe("Amine");
    expect(field(form, "empty")).toBe("");
    expect(field(form, "absent")).toBe("");
  });

  it("answers empty rather than throwing for a File value", () => {
    const form = new FormData();
    form.set("photo", new File(["x"], "x.png"));
    expect(field(form, "photo")).toBe("");
  });

  it("reads the checkbox spellings a browser and a client both send", () => {
    const form = new FormData();
    form.set("a", "on");
    form.set("b", "true");
    form.set("c", "1");
    form.set("d", "off");
    form.set("e", "false");
    form.set("f", "");

    expect(boolField(form, "a")).toBe(true);
    expect(boolField(form, "b")).toBe(true);
    expect(boolField(form, "c")).toBe(true);
    expect(boolField(form, "d")).toBe(false);
    expect(boolField(form, "e")).toBe(false);
    expect(boolField(form, "f")).toBe(false);
    expect(boolField(form, "absent")).toBe(false);
  });

  it("reads a repeated field, and an absent one as empty", () => {
    const form = new FormData();
    form.append("codes", "a");
    form.append("codes", "b");
    form.append("mixed", "keep");
    form.append("mixed", new File(["x"], "x.png"));

    expect(listField(form, "codes")).toEqual(["a", "b"]);
    expect(listField(form, "mixed")).toEqual(["keep"]);
    expect(listField(form, "absent")).toEqual([]);
  });
});

// ── Action results ───────────────────────────────────────────────────────────

describe("action state", () => {
  it("echoes submitted values on failure so a rejected form redraws", () => {
    const state = failure("nope", { email: "required" }, { email: "a@b.c" });
    expect(state.status).toBe("error");
    expect(state.fieldErrors).toEqual({ email: "required" });
    expect(state.values).toEqual({ email: "a@b.c" });
  });

  it("carries no values on success, so the form clears", () => {
    const state = success("done");
    expect(state.status).toBe("success");
    expect(state.values).toBeUndefined();
    expect(state.fieldErrors).toBeUndefined();
  });

  it("keys every result so a repeat submission still fires an effect", () => {
    expect(success().key).toBeTypeOf("number");
    expect(failure().key).toBeTypeOf("number");
    expect(IDLE.key).toBeUndefined();
  });
});

// ── Appearance: the one inline <script> in the app ───────────────────────────

describe("appearance preferences", () => {
  it("keeps `mode` inside a closed set", () => {
    // Load-bearing for XSS: `AppearanceScript` interpolates `mode` into an
    // inline <script>, and JSON.stringify alone does not neutralise `</script>`.
    // The allowlist is what makes that safe, so it is pinned here.
    for (const hostile of [
      "</script><script>alert(1)</script>",
      "dark ",
      "__proto__",
      "",
    ]) {
      expect(THEME_MODES).not.toContain(hostile);
      expect(normalizeUiPrefs({ mode: hostile }).mode).toBe(
        DEFAULT_UI_PREFS.mode,
      );
      expect(THEME_MODES).toContain(normalizeUiPrefs({ mode: hostile }).mode);
    }
  });

  it("falls back field by field, never wholesale", () => {
    const prefs = normalizeUiPrefs({ mode: "dark", accent: "not-a-colour" });
    expect(prefs.mode).toBe("dark");
    expect(prefs.accent).toBe(DEFAULT_UI_PREFS.accent);
  });

  it("survives a hostile or broken cookie", () => {
    expect(parseUiPrefsCookie(undefined)).toEqual(DEFAULT_UI_PREFS);
    expect(parseUiPrefsCookie("not json")).toEqual(DEFAULT_UI_PREFS);
    expect(parseUiPrefsCookie("null")).toEqual(DEFAULT_UI_PREFS);
    expect(parseUiPrefsCookie('"a string"')).toEqual(DEFAULT_UI_PREFS);
    expect(parseUiPrefsCookie("[1,2,3]")).toEqual(DEFAULT_UI_PREFS);
    expect(parseUiPrefsCookie('{"__proto__":{"polluted":true}}')).toEqual(
      DEFAULT_UI_PREFS,
    );
    expect(({} as Record<string, unknown>)["polluted"]).toBeUndefined();
  });

  it("round-trips through the cookie unchanged", () => {
    const prefs = normalizeUiPrefs({
      mode: "dark",
      accent: "blue",
      fontFamily: "geist",
      fontSize: "md",
      radius: "md",
    });
    expect(parseUiPrefsCookie(JSON.stringify(prefs))).toEqual(prefs);
  });
});
