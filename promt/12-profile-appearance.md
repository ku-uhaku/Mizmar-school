# 12 — `profile` and `appearance`

**Prereqs:** 09, 05.
**Tables:** none — both write the signed-in user's own `Profile` row.
**Routes:** `/profile`, `/appearance`.

---

Two small self-service modules. **Neither has permission codes** — you are always
allowed to edit yourself. `requireAuth()` and then scope every write to
`ctx.user.id`. Never accept a `userId` from the request; that is the entire
attack surface of these two screens.

**`profile`** — first name, last name, phone, job title, bio, birth date, avatar
(via `image-field`, 256 KB cap, re-validated server-side), and change password
(current + new + confirm, bcrypt, invalidate other sessions).
Nav: `/profile`, icon `profile`, section `account`, order 10.

**`appearance`** — theme mode (`light|dark|system`), accent, font family
(`geist|inter|system|mono`), font size (`sm|md|lg|xl`), radius
(`none|sm|md|lg|xl`), and language. Writes the `Profile` appearance columns
**and** the `ui-prefs` cookie in the same action, so the next first paint is
correct with no flash.
Nav: `/appearance`, icon `appearance`, section `account`, order 20.

Live preview: changing a control updates the page immediately (optimistic), and
the action persists. Do not require a save-and-reload to see the theme.

**Gate:** set Arabic + dark + large, hard-refresh, and confirm there is **no
flash** of the wrong theme or direction. Then sign in as a different user and
confirm their settings are untouched.
