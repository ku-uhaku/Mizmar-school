import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  ACCENTS,
  FONT_FAMILIES,
  FONT_SIZES,
  RADII,
  THEME_MODES,
} from "@/modules/appearance/enums";
import {
  DEFAULT_UI_PREFS,
  UI_PREFS_COOKIE,
  normalizeUiPrefs,
  parseUiPrefsCookie,
  serializeUiPrefs,
  uiPrefsToDataAttributes,
  type UiPrefs,
} from "@/modules/appearance/prefs";

/**
 * L'apparence — and the one `dangerouslySetInnerHTML` in the app.
 *
 * `AppearanceScript` writes a `<script>` that runs before first paint, because
 * `mode: "system"` is the one preference the server cannot resolve: without it
 * the page renders light and snaps to dark on hydration. It interpolates the
 * stored mode into that script body.
 *
 * Two facts make that worth a test file of its own.
 *
 * **There is no `script-src`.** `next.config.ts` says so and says why — a policy
 * worth having needs a per-request nonce threaded through the document, and
 * this very script is what makes that awkward. So nothing would stop an
 * injection here.
 *
 * **`JSON.stringify` is not an escape for this position.** It quotes a string
 * for a JavaScript parser, and the thing that ends a `<script>` element is the
 * *HTML* parser seeing `</script>` — inside a JS string literal or not. The only
 * thing standing between the `ui-prefs` cookie and script execution is that
 * `normalizeUiPrefs` picks from an allowlist.
 *
 * `lib/security.test.ts` tests that allowlist at the source. This tests the
 * sink: what the script actually says, for every value the enum admits — so
 * widening the enum, or dropping the normalisation, fails a test *where the
 * injection would happen*.
 */

// ─────────────────────────────────────────────────────────────────────────────

const cookieWrites: { name: string; value: string; options: unknown }[] = [];
const profileWrites: unknown[] = [];
let signedIn = true;
let forwardedProto = "https";

vi.mock("next/headers", () => ({
  cookies: async () => ({
    set: (name: string, value: string, options: unknown) => {
      cookieWrites.push({ name, value, options });
    },
    get: () => undefined,
  }),
  headers: async () => new Headers({ "x-forwarded-proto": forwardedProto }),
}));

vi.mock("next/cache", () => ({ refresh: () => {} }));

vi.mock("@/lib/dal", () => ({
  getAuthContext: async () => (signedIn ? { user: { id: "user-1" } } : null),
}));

vi.mock("@/lib/db", () => ({
  db: {
    profile: {
      updateMany: async (args: unknown) => {
        profileWrites.push(args);
        return { count: 1 };
      },
    },
  },
  auditClient: {},
}));

const { AppearanceScript } = await import(
  "@/modules/appearance/components/appearance-provider"
);
const { saveAppearanceAction, setLocaleAction } = await import(
  "@/modules/appearance/actions"
);

/** The script body `AppearanceScript` would put on the page. */
function scriptFor(mode: UiPrefs["mode"]): string {
  const element = AppearanceScript({ mode }) as unknown as {
    props: { dangerouslySetInnerHTML: { __html: string } };
  };
  return element.props.dangerouslySetInnerHTML.__html;
}

beforeEach(() => {
  cookieWrites.length = 0;
  profileWrites.length = 0;
  signedIn = true;
  forwardedProto = "https";
});

// ── The script that runs before first paint ──────────────────────────────────

describe("AppearanceScript", () => {
  it("carries the mode as a quoted literal", () => {
    for (const mode of THEME_MODES) {
      expect(scriptFor(mode), mode).toContain(`"${mode}"`);
    }
  });

  it("never closes its own element, for any mode the enum admits", () => {
    // The assertion that would catch a widened enum. `</script>` ends the
    // element wherever the HTML parser finds it — being inside a JavaScript
    // string literal does not help.
    for (const mode of THEME_MODES) {
      expect(scriptFor(mode).toLowerCase(), mode).not.toContain("</script");
      expect(scriptFor(mode), mode).not.toContain("<!--");
    }
  });

  it("admits only modes that cannot break out of it", () => {
    // Stated as a property of the enum rather than of the rendering, because
    // this is the file where adding "dark</script><script>…" would matter.
    for (const mode of THEME_MODES) {
      expect(mode, mode).toMatch(/^[a-z]+$/);
    }
  });

  it("never lets a hostile cookie reach the page", () => {
    // The whole path, end to end: a cookie somebody set, through the
    // normalisation, into the script body.
    for (const payload of [
      "</script><script>alert(1)</script>",
      "dark</script>",
      '";alert(1);var x="',
      "<!--<script>",
      " alert(1)",
    ]) {
      const prefs = parseUiPrefsCookie(JSON.stringify({ mode: payload }));
      const script = scriptFor(prefs.mode);

      expect(script, payload).not.toContain("alert(1)");
      expect(script.toLowerCase(), payload).not.toContain("</script");
      expect(prefs.mode, payload).toBe(DEFAULT_UI_PREFS.mode);
    }
  });

  it("resolves the system preference rather than guessing it", () => {
    // The reason the script exists at all: the server cannot know the OS
    // setting, and rendering light and snapping to dark is the flash it avoids.
    expect(scriptFor("system")).toContain("prefers-color-scheme: dark");
  });

  it("swallows its own failures", () => {
    // It runs before anything else on the page; throwing here would take the
    // document with it, over a colour.
    for (const mode of THEME_MODES) {
      expect(scriptFor(mode), mode).toContain("catch");
    }
  });

  it("touches only the root element's own theme", () => {
    const script = scriptFor("dark");
    expect(script).toContain("documentElement");
    expect(script).toContain("colorScheme");
  });
});

// ── The allowlist, at the sink's own door ────────────────────────────────────

describe("normalizeUiPrefs", () => {
  it("answers a complete set from nothing at all", () => {
    for (const input of [undefined, null, {}, "string", 42, []]) {
      expect(normalizeUiPrefs(input), String(input)).toEqual(DEFAULT_UI_PREFS);
    }
  });

  it("keeps every value the enums declare", () => {
    for (const mode of THEME_MODES) {
      expect(normalizeUiPrefs({ mode }).mode, mode).toBe(mode);
    }
    for (const accent of ACCENTS) {
      expect(normalizeUiPrefs({ accent }).accent, accent).toBe(accent);
    }
    for (const fontFamily of FONT_FAMILIES) {
      expect(
        normalizeUiPrefs({ fontFamily }).fontFamily,
        fontFamily,
      ).toBe(fontFamily);
    }
    for (const fontSize of FONT_SIZES) {
      expect(normalizeUiPrefs({ fontSize }).fontSize, fontSize).toBe(fontSize);
    }
    for (const radius of RADII) {
      expect(normalizeUiPrefs({ radius }).radius, radius).toBe(radius);
    }
  });

  it("replaces anything else, field by field", () => {
    // One bad value must not discard the four good ones beside it: a cookie
    // written by an older build should not reset somebody's whole theme.
    const prefs = normalizeUiPrefs({
      mode: "dark",
      accent: "not-a-colour",
      fontFamily: "inter",
      fontSize: 12,
      radius: null,
    });

    expect(prefs.mode).toBe("dark");
    expect(prefs.fontFamily).toBe("inter");
    expect(prefs.accent).toBe(DEFAULT_UI_PREFS.accent);
    expect(prefs.fontSize).toBe(DEFAULT_UI_PREFS.fontSize);
    expect(prefs.radius).toBe(DEFAULT_UI_PREFS.radius);
  });

  it("answers only declared values, whatever it is given", () => {
    const prefs = normalizeUiPrefs({
      mode: "__proto__",
      accent: "constructor",
      fontFamily: "toString",
      fontSize: "valueOf",
      radius: "hasOwnProperty",
    });

    expect(THEME_MODES).toContain(prefs.mode);
    expect(ACCENTS).toContain(prefs.accent);
    expect(FONT_FAMILIES).toContain(prefs.fontFamily);
    expect(FONT_SIZES).toContain(prefs.fontSize);
    expect(RADII).toContain(prefs.radius);
  });
});

describe("the cookie", () => {
  it("round-trips a complete set", () => {
    const prefs: UiPrefs = {
      mode: "dark",
      accent: "violet",
      fontFamily: "mono",
      fontSize: "lg",
      radius: "none",
    };
    expect(parseUiPrefsCookie(serializeUiPrefs(prefs))).toEqual(prefs);
  });

  it("falls back for anything that is not a set of preferences", () => {
    for (const value of [
      undefined,
      "",
      "not json",
      "null",
      '"a string"',
      "[1,2,3]",
      "{",
    ]) {
      expect(parseUiPrefsCookie(value), String(value)).toEqual(
        DEFAULT_UI_PREFS,
      );
    }
  });

  it("is not a way to reach an object's prototype", () => {
    expect(parseUiPrefsCookie('{"__proto__":{"polluted":true}}')).toEqual(
      DEFAULT_UI_PREFS,
    );
    expect(({} as Record<string, unknown>)["polluted"]).toBeUndefined();
  });

  it("starts on the system setting, so a first visit matches the machine", () => {
    expect(DEFAULT_UI_PREFS.mode).toBe("system");
  });
});

describe("uiPrefsToDataAttributes", () => {
  it("names the attributes the stylesheet selects on", () => {
    // Every value needs matching CSS under `[data-accent]` and friends, so the
    // attribute names are a contract with `app/globals.css`.
    const attributes = uiPrefsToDataAttributes(DEFAULT_UI_PREFS);
    expect(Object.keys(attributes).sort()).toEqual([
      "data-accent",
      "data-font",
      "data-radius",
      "data-size",
    ]);
  });

  it("carries no mode, because that one is a class and not an attribute", () => {
    expect(uiPrefsToDataAttributes(DEFAULT_UI_PREFS)).not.toHaveProperty(
      "data-mode",
    );
  });

  it("emits only values the enums declare", () => {
    // These land in HTML attributes on <html>; anything unbounded would be
    // reflected content.
    const attributes = uiPrefsToDataAttributes(
      normalizeUiPrefs({ accent: "</html>", fontFamily: '"' }),
    );
    expect(ACCENTS).toContain(attributes["data-accent"]);
    expect(FONT_FAMILIES).toContain(attributes["data-font"]);
  });
});

// ── Persisting them ──────────────────────────────────────────────────────────

describe("saveAppearanceAction", () => {
  const prefs: UiPrefs = {
    mode: "dark",
    accent: "violet",
    fontFamily: "mono",
    fontSize: "lg",
    radius: "none",
  };

  it("writes the cookie the next server render reads", async () => {
    await saveAppearanceAction(prefs);

    expect(cookieWrites[0]!.name).toBe(UI_PREFS_COOKIE);
    expect(JSON.parse(cookieWrites[0]!.value)).toEqual(prefs);
  });

  it("normalises before it stores, not after it reads", async () => {
    // The action takes a typed argument, but a Server Action is reachable by
    // direct POST and the type is gone by then.
    await saveAppearanceAction({
      mode: "</script><script>alert(1)</script>",
      accent: "not-a-colour",
    } as unknown as UiPrefs);

    const stored = JSON.parse(cookieWrites[0]!.value);
    expect(stored.mode).toBe(DEFAULT_UI_PREFS.mode);
    expect(stored.accent).toBe(DEFAULT_UI_PREFS.accent);
    expect(cookieWrites[0]!.value).not.toContain("alert(1)");
  });

  it("keeps the cookie out of reach of scripts", async () => {
    await saveAppearanceAction(prefs);
    expect(cookieWrites[0]!.options).toMatchObject({
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: true,
    });
  });

  it("drops `Secure` when the request did not arrive over TLS", async () => {
    /*
      A browser discards a `Secure` cookie that arrives over plain HTTP, so
      deciding this from NODE_ENV cost the school every preference: a
      production build served without TLS wrote the cookie, the browser threw
      it away, and the next server render fell back to French — most visibly
      right after a theme change, which is what makes Next re-render the route.
    */
    forwardedProto = "http";
    await saveAppearanceAction(prefs);
    expect(cookieWrites[0]!.options).toMatchObject({ secure: false });
  });

  it("trusts the client-facing hop of a proxy chain", async () => {
    forwardedProto = "https, http";
    await saveAppearanceAction(prefs);
    expect(cookieWrites[0]!.options).toMatchObject({ secure: true });
  });

  it("mirrors the choice onto the caller's own profile", async () => {
    // The durable copy, so a preference follows the user between devices.
    await saveAppearanceAction(prefs);
    expect(profileWrites[0]).toMatchObject({
      where: { userId: "user-1" },
      data: { themeMode: "dark", accent: "violet", radius: "none" },
    });
  });

  it("writes the normalised values to the profile too", async () => {
    await saveAppearanceAction({
      ...prefs,
      accent: "not-a-colour",
    } as unknown as UiPrefs);

    expect(profileWrites[0]).toMatchObject({
      data: { accent: DEFAULT_UI_PREFS.accent },
    });
  });

  it("works signed out, which is what the login page needs", async () => {
    signedIn = false;
    await saveAppearanceAction(prefs);

    expect(cookieWrites).toHaveLength(1);
    expect(profileWrites).toEqual([]);
  });

  it("writes against the session's user, never an id in the request", async () => {
    await saveAppearanceAction({
      ...prefs,
      userId: "somebody-else",
    } as unknown as UiPrefs);

    expect(profileWrites[0]).toMatchObject({ where: { userId: "user-1" } });
    expect(JSON.stringify(profileWrites[0])).not.toContain("somebody-else");
  });
});

describe("setLocaleAction", () => {
  it("writes the language cookie the root layout reads", async () => {
    await setLocaleAction("ar");

    expect(cookieWrites[0]).toMatchObject({ name: "locale", value: "ar" });
    expect(profileWrites[0]).toMatchObject({
      where: { userId: "user-1" },
      data: { locale: "ar" },
    });
  });

  it("stores it under the same conditions as the appearance cookie", async () => {
    // Both are read on the same render, so one of the two surviving the trip
    // to the browser and not the other is the confusing half of the bug.
    forwardedProto = "http";
    await setLocaleAction("en");
    expect(cookieWrites[0]!.options).toMatchObject({
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: false,
    });
  });

  it("refuses a language the app is not built in", async () => {
    await setLocaleAction("es" as never);
    expect(cookieWrites).toEqual([]);
    expect(profileWrites).toEqual([]);
  });
});
