# Al Manar — application mobile

Expo (SDK 57) client for the school administration app. Four small spaces, not a
second copy of the web app:

| Espace | Qui | Ce qu'il montre |
| --- | --- | --- |
| Famille | un parent (guardian avec un compte portail) | ses enfants, notes, absences, scolarité, ramassage |
| Classe | un enseignant | la journée, l'emploi du temps, les appels restants |
| Transport | un chauffeur | ses circuits du jour et la feuille de route |
| Direction | un directeur / manager | effectifs, facturation, répartition par niveau |

The account decides which spaces appear (`/api/mobile/v1/me`); an account with
more than one gets a switcher. Everything is read-only — marking a register or
taking a payment stays on the web app, where it is done properly.

## Running it

The server must be running first:

```bash
cd ..        # the Next app
npm run dev
```

Then point the app at the machine's **LAN address**, not `localhost` — a phone
cannot reach your laptop's loopback. Edit `extra.apiUrl` in `app.json`:

```json
{ "expo": { "extra": { "apiUrl": "http://192.168.1.20:3000" } } }
```

```bash
npm install
npx expo start          # scan the QR code with Expo Go
npx expo start --android
npx expo start --ios
```

## Demo accounts

`npm run db:seed` in the server project prints them. All share `Admin123!`:

- **famille** — `parent.f-2026-0031@famille.ma`
- **chauffeur** — `said.amrani@almanar.ma`
- **enseignant** — `karim.bennis@almanar.ma`
- **direction** — `admin@groupescolaire.ma` (holds three spaces)

## Layout

```
app/                   expo-router routes
  _layout.tsx          QueryClient + safe area
  index.tsx            session gate → /login or /home
  login.tsx
  home.tsx             role-routed home, with the space switcher
  child/[studentId]    one pupil's card
  run/[runId]          one bus run's sheet
src/api/               client (tokens + refresh), typed hooks, DTO mirrors
src/spaces/            the four spaces
src/ui/                theme, formatting, the shared components
```

## Notes

- **Tokens** live in `expo-secure-store` (Keychain / Keystore). The access token
  lasts 2 h and refreshes automatically in `src/api/client.ts`; the refresh is
  de-duplicated so a screen firing four queries at once cannot rotate the token
  four times and sign itself out.
- **Online-first.** The server is SQLite-backed with no sync layer, so there is
  no offline write story. TanStack Query's cache makes a dropped connection
  survivable for reading, and nothing more is promised.
- **French only** for now. The server's dictionaries are not imported here; if
  the app needs `ar`, mirror `lib/i18n` rather than hardcoding a second set of
  strings.
- `metro.config.js` disables package exports — `react-native-web@0.21` reaches
  into `inline-style-prefixer` subpaths that its `exports` map hides. Only the
  web target is affected.
