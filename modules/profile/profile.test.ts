import { beforeEach, describe, expect, it, vi } from "vitest";

import { getDictionaryFor } from "@/lib/i18n/server";
import { credentialsStillValid } from "@/lib/mobile-token";
import {
  passwordChangeSchema,
  profileSchema,
} from "@/modules/profile/validation";

/**
 * The account's own settings — the only screen in the app where a user acts on
 * themselves.
 *
 * That makes it unusual twice over. There is no id to validate, because the
 * user id comes from the session and nothing in the request names a subject.
 * And it holds the one action whose *point* is to invalidate credentials:
 * changing a password moves `credentialsChangedAt`, and `lib/dal.ts` refuses
 * every credential minted before it.
 *
 * Before that column existed, deactivating an account was the only way to evict
 * anybody — a reset moved the hash and nothing else, so a stolen session cookie
 * kept working until it expired and a stolen refresh token kept renewing itself
 * for sixty days. The tests below are about keeping that closed.
 */

const t = getDictionaryFor("en");

// ─────────────────────────────────────────────────────────────────────────────

const calls: { model: string; op: string; args: unknown }[] = [];
let answers: Record<string, unknown> = {};
/** What `verifyPassword` should say about the submitted current password. */
let currentPasswordCorrect = true;

const db = new Proxy(
  {},
  {
    get: (_target, model: string) =>
      new Proxy(
        {},
        {
          get: (_d, op: string) => async (args: unknown) => {
            calls.push({ model, op, args });
            const key = `${model}.${op}`;
            if (key in answers) return answers[key];
            return op === "findUnique" ? null : {};
          },
        },
      ),
  },
);

vi.mock("@/lib/db", () => ({ db, auditClient: {} }));
vi.mock("@/lib/audit", () => ({ recordEvent: async () => {} }));

vi.mock("@/lib/auth", () => ({
  hashPassword: async (plain: string) => `hashed:${plain}`,
  verifyPassword: async () => currentPasswordCorrect,
}));

vi.mock("@/lib/dal", () => ({
  requireAuth: async () => ({
    organization: { id: "org-1" },
    currentSchool: { id: "school-1" },
    user: { id: "user-1" },
    can: () => true,
    canOrg: () => true,
    canInSchool: () => true,
  }),
}));

vi.mock("@/lib/i18n/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/i18n/server")>()),
  getDictionary: async () => t,
}));

vi.mock("next/cache", () => ({ refresh: () => {} }));

const { changeOwnPasswordAction, updateOwnProfileAction } = await import(
  "@/modules/profile/actions"
);

const of = (model: string, op: string) =>
  calls.filter((call) => call.model === model && call.op === op);

const only = (model: string, op: string) => {
  const matches = of(model, op);
  expect(matches, `${model}.${op}`).toHaveLength(1);
  return matches[0]!;
};

const IDLE = { status: "idle" } as never;

function passwordForm(extra: Record<string, string> = {}) {
  const form = new FormData();
  form.set("currentPassword", "old-secret-1");
  form.set("newPassword", "a-much-longer-secret");
  form.set("confirmPassword", "a-much-longer-secret");
  for (const [key, value] of Object.entries(extra)) form.set(key, value);
  return form;
}

function profileForm(extra: Record<string, string> = {}) {
  const form = new FormData();
  form.set("firstName", "Karim");
  form.set("lastName", "Alaoui");
  form.set("phone", "0661234567");
  form.set("jobTitle", "Directeur");
  form.set("bio", "");
  form.set("avatarUrl", "");
  form.set("birthDate", "");
  for (const [key, value] of Object.entries(extra)) form.set(key, value);
  return form;
}

beforeEach(() => {
  calls.length = 0;
  answers = { "user.findUnique": { passwordHash: "hashed:old-secret-1" } };
  currentPasswordCorrect = true;
});

// ── Changing a password ──────────────────────────────────────────────────────

describe("changeOwnPasswordAction", () => {
  it("writes the hash and the stamp together, never one without the other", async () => {
    // A hash moved on its own is what let a stolen cookie keep working.
    const state = await changeOwnPasswordAction(IDLE, passwordForm());

    expect(state.status).toBe("success");
    const data = (only("user", "update").args as {
      data: Record<string, unknown>;
    }).data;
    expect(data["passwordHash"]).toBe("hashed:a-much-longer-secret");
    expect(data["credentialsChangedAt"]).toBeInstanceOf(Date);
  });

  it("evicts every credential minted before the change", async () => {
    // The property the stamp exists for, asserted against the function
    // `lib/dal.ts` actually calls.
    await changeOwnPasswordAction(IDLE, passwordForm());
    const changedAt = (only("user", "update").args as {
      data: { credentialsChangedAt: Date };
    }).data.credentialsChangedAt;

    // A session from before — including the one that just made the change.
    expect(credentialsStillValid(0, changedAt)).toBe(false);
    expect(
      credentialsStillValid(changedAt.getTime() - 1, changedAt),
    ).toBe(false);
    // And one minted from the new stamp.
    expect(credentialsStillValid(changedAt.getTime(), changedAt)).toBe(true);
  });

  it("says that it signs the user out, rather than leaving them to find out", async () => {
    // Somebody who reads "Password changed." and then lands on a login box
    // concludes it did not take, and tries the old one.
    const state = await changeOwnPasswordAction(IDLE, passwordForm());
    expect(state.message).toBe(t.profile.passwordChanged);
    expect(state.message).toMatch(/sign in again/i);
  });

  it("acts on the caller's own account and no other", async () => {
    // No id travels in the request, so there is none to spoof.
    const form = passwordForm();
    form.set("userId", "somebody-else");
    await changeOwnPasswordAction(IDLE, form);

    expect(only("user", "update").args).toMatchObject({
      where: { id: "user-1" },
    });
    expect(only("user", "findUnique").args).toMatchObject({
      where: { id: "user-1" },
    });
  });

  it("re-reads the hash rather than trusting the session", async () => {
    await changeOwnPasswordAction(IDLE, passwordForm());
    expect(only("user", "findUnique").args).toMatchObject({
      select: { passwordHash: true },
    });
  });

  it("refuses a wrong current password", async () => {
    // Knowing the current one is the whole authorization for this action.
    currentPasswordCorrect = false;
    const state = await changeOwnPasswordAction(IDLE, passwordForm());

    expect(state.status).toBe("error");
    expect(of("user", "update")).toEqual([]);
  });

  it("names the field it refused on, so the form can point at it", async () => {
    currentPasswordCorrect = false;
    const state = await changeOwnPasswordAction(IDLE, passwordForm());
    expect(state.fieldErrors).toMatchObject({
      currentPassword: t.profile.wrongCurrentPassword,
    });
  });

  it("refuses two new passwords that disagree", async () => {
    const state = await changeOwnPasswordAction(
      IDLE,
      passwordForm({ confirmPassword: "something-else-entirely" }),
    );

    expect(state.status).toBe("error");
    expect(of("user", "update")).toEqual([]);
    // Checked before the hash is even read.
    expect(of("user", "findUnique")).toEqual([]);
  });

  it("refuses a new password that is too short", async () => {
    const state = await changeOwnPasswordAction(
      IDLE,
      passwordForm({ newPassword: "short", confirmPassword: "short" }),
    );

    expect(state.status).toBe("error");
    expect(of("user", "update")).toEqual([]);
  });

  it("requires the current password to have been typed at all", async () => {
    const state = await changeOwnPasswordAction(
      IDLE,
      passwordForm({ currentPassword: "" }),
    );

    expect(state.status).toBe("error");
    expect(of("user", "findUnique")).toEqual([]);
  });

  it("never echoes a password back to the form", async () => {
    // `formValues` is deliberately absent from every refusal here: a form that
    // came back with the password in it would put it in the HTML, and from
    // there into any page cache that saw the response.
    currentPasswordCorrect = false;
    const state = await changeOwnPasswordAction(IDLE, passwordForm());

    const serialised = JSON.stringify(state);
    expect(serialised).not.toContain("old-secret-1");
    expect(serialised).not.toContain("a-much-longer-secret");
  });

  it("stores nothing but the hash", async () => {
    await changeOwnPasswordAction(IDLE, passwordForm());
    const data = (only("user", "update").args as {
      data: Record<string, unknown>;
    }).data;

    expect(Object.keys(data).sort()).toEqual([
      "credentialsChangedAt",
      "passwordHash",
    ]);
    expect(JSON.stringify(data)).not.toContain("a-much-longer-secret".slice(0, 5) + "!");
  });

  it("refuses an account that has gone", async () => {
    answers = {};
    const state = await changeOwnPasswordAction(IDLE, passwordForm());
    expect(state.status).toBe("error");
    expect(of("user", "update")).toEqual([]);
  });
});

// ── The profile itself ───────────────────────────────────────────────────────

describe("updateOwnProfileAction", () => {
  it("writes the caller's own profile", async () => {
    const state = await updateOwnProfileAction(IDLE, profileForm());

    expect(state.status).toBe("success");
    expect(only("profile", "upsert").args).toMatchObject({
      where: { userId: "user-1" },
      create: { userId: "user-1", firstName: "Karim" },
      update: { firstName: "Karim" },
    });
  });

  it("takes the user from the session, whatever the form says", async () => {
    const form = profileForm();
    form.set("userId", "somebody-else");
    await updateOwnProfileAction(IDLE, form);

    const args = only("profile", "upsert").args as {
      create: Record<string, unknown>;
      update: Record<string, unknown>;
    };
    expect(args.create["userId"]).toBe("user-1");
    expect(args.update).not.toHaveProperty("userId");
  });

  it("creates a profile for an account that has none yet", async () => {
    // An upsert rather than an update: a user seeded without a profile still
    // has to be able to fill one in.
    await updateOwnProfileAction(IDLE, profileForm());
    expect(only("profile", "upsert").args).toHaveProperty("create");
  });

  it("requires a name", async () => {
    const state = await updateOwnProfileAction(
      IDLE,
      profileForm({ firstName: "" }),
    );
    expect(state.status).toBe("error");
    expect(of("profile", "upsert")).toEqual([]);
  });

  it("refuses an avatar that is not an image", async () => {
    // The one field here that is rendered as a URL — in the header, on every
    // screen, for the whole session.
    for (const avatarUrl of [
      "javascript:alert(1)",
      "data:text/html;base64,AA",
      "http://example.com/me.png",
    ]) {
      calls.length = 0;
      const state = await updateOwnProfileAction(
        IDLE,
        profileForm({ avatarUrl }),
      );
      expect(state.status, avatarUrl).toBe("error");
      expect(of("profile", "upsert"), avatarUrl).toEqual([]);
    }
  });

  it("accepts the two shapes an avatar may take", async () => {
    for (const avatarUrl of [
      "https://example.com/me.png",
      "data:image/png;base64,AAAA",
    ]) {
      calls.length = 0;
      const state = await updateOwnProfileAction(
        IDLE,
        profileForm({ avatarUrl }),
      );
      expect(state.status, avatarUrl).toBe("success");
    }
  });
});

// ── The schemas ──────────────────────────────────────────────────────────────

describe("passwordChangeSchema", () => {
  const submission = (extra: Record<string, unknown> = {}) => ({
    currentPassword: "old-secret-1",
    newPassword: "a-much-longer-secret",
    confirmPassword: "a-much-longer-secret",
    ...extra,
  });

  it("accepts a well-formed change", () => {
    expect(passwordChangeSchema(t).safeParse(submission()).success).toBe(true);
  });

  it("points the mismatch at the confirmation, not the new password", () => {
    // The field the user has to fix is the second one they typed.
    const parsed = passwordChangeSchema(t).safeParse(
      submission({ confirmPassword: "different" }),
    );
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues[0]!.path).toEqual(["confirmPassword"]);
    }
  });

  it("refuses a blank current password", () => {
    expect(
      passwordChangeSchema(t).safeParse(submission({ currentPassword: "" }))
        .success,
    ).toBe(false);
  });

  it("strips anything the form did not declare", () => {
    const parsed = passwordChangeSchema(t).safeParse({
      ...submission(),
      userId: "somebody-else",
      credentialsChangedAt: "1970-01-01",
    });

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data).not.toHaveProperty("userId");
      expect(parsed.data).not.toHaveProperty("credentialsChangedAt");
    }
  });
});

describe("profileSchema", () => {
  const submission = (extra: Record<string, unknown> = {}) => ({
    firstName: "Karim",
    lastName: "Alaoui",
    phone: "",
    jobTitle: "",
    bio: "",
    avatarUrl: "",
    birthDate: "",
    ...extra,
  });

  it("accepts a profile with only the two names", () => {
    expect(profileSchema(t).safeParse(submission()).success).toBe(true);
  });

  it("refuses a birth date in the future", () => {
    const tomorrow = new Date(Date.now() + 86_400_000)
      .toISOString()
      .slice(0, 10);
    expect(
      profileSchema(t).safeParse(submission({ birthDate: tomorrow })).success,
    ).toBe(false);
  });

  it("leaves the birth date optional", () => {
    const parsed = profileSchema(t).safeParse(submission());
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.birthDate).toBeNull();
  });

  it("strips anything the form did not declare", () => {
    // A profile form must not be a way to change an account: not the role, not
    // the school, and certainly not the password.
    const parsed = profileSchema(t).safeParse({
      ...submission(),
      userId: "somebody-else",
      passwordHash: "hashed:whatever",
      isSuperAdmin: true,
      isActive: false,
    });

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      for (const field of [
        "userId",
        "passwordHash",
        "isSuperAdmin",
        "isActive",
      ]) {
        expect(parsed.data, field).not.toHaveProperty(field);
      }
    }
  });
});
