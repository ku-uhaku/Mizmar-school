import Constants from "expo-constants";

import { getItem, removeItem, setItem } from "./storage";

/**
 * The one place the app talks to the school server.
 *
 * Two things live here that must not be spread around the screens: where the
 * tokens are kept, and what happens when the access token expires. Every screen
 * calls `api()` and neither knows nor cares.
 */

const ACCESS_KEY = "almanar.access";
const REFRESH_KEY = "almanar.refresh";

/**
 * Read from app.json rather than hardcoded: a phone on the school's wifi cannot
 * reach `localhost`, so this has to be the machine's LAN address in development
 * and the real host in production.
 */
export const API_URL: string =
  (Constants.expoConfig?.extra as { apiUrl?: string } | undefined)?.apiUrl ??
  "http://localhost:3000";

const BASE = `${API_URL}/api/mobile/v1`;

export type ApiErrorBody = {
  error: { code: string; message: string; retryAfterSeconds?: number };
};

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly retryAfterSeconds?: number;

  constructor(status: number, body: ApiErrorBody | null) {
    super(body?.error.message ?? "Erreur réseau");
    this.status = status;
    this.code = body?.error.code ?? "unknown";
    this.retryAfterSeconds = body?.error.retryAfterSeconds;
    this.name = "ApiError";
  }
}

// ── Token storage ────────────────────────────────────────────────────────────

export async function saveTokens(tokens: {
  accessToken: string;
  refreshToken: string;
}): Promise<void> {
  await Promise.all([
    setItem(ACCESS_KEY, tokens.accessToken),
    setItem(REFRESH_KEY, tokens.refreshToken),
  ]);
}

export async function clearTokens(): Promise<void> {
  await Promise.all([
    removeItem(ACCESS_KEY),
    removeItem(REFRESH_KEY),
  ]);
}

export async function hasSession(): Promise<boolean> {
  return (await getItem(REFRESH_KEY)) !== null;
}

// ── Requests ─────────────────────────────────────────────────────────────────

async function request(
  path: string,
  init: RequestInit,
  accessToken: string | null,
): Promise<Response> {
  return fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
      ...init.headers,
    },
  });
}

/**
 * Refreshes in flight, and only once.
 *
 * Without this, the four queries a screen fires on mount all see 401 at the
 * same moment and all four try to refresh — and since the server rotates the
 * refresh token, three of them would present one that has just been superseded
 * and sign the user out. Everybody waits on the same promise instead.
 */
let refreshInFlight: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    try {
      const refreshToken = await getItem(REFRESH_KEY);
      if (!refreshToken) return null;

      const response = await fetch(`${BASE}/auth/refresh`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      });

      if (!response.ok) {
        await clearTokens();
        return null;
      }

      const tokens = (await response.json()) as {
        accessToken: string;
        refreshToken: string;
      };
      await saveTokens(tokens);
      return tokens.accessToken;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

/**
 * A call to the school server, with the token handling done.
 *
 * On a 401 it refreshes once and retries; if that fails the tokens are gone and
 * the caller gets a 401 to act on — which is what sends the app back to the
 * sign-in screen.
 */
export async function api<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  let accessToken = await getItem(ACCESS_KEY);
  let response = await request(path, init, accessToken);

  if (response.status === 401) {
    accessToken = await refreshAccessToken();
    if (accessToken) response = await request(path, init, accessToken);
  }

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as ApiErrorBody | null;
    throw new ApiError(response.status, body);
  }

  return (await response.json()) as T;
}

/**
 * Changes the signed-in account's password and keeps the seat.
 *
 * The server evicts every credential issued before the change — this phone's
 * included — and answers with a fresh pair, so storing it here is not an
 * optimisation but the thing that stops the next call 401-ing. Any other device
 * still gets signed out, which is the point of changing a password.
 */
export async function changePassword(
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  const tokens = await api<{ accessToken: string; refreshToken: string }>(
    "/me/password",
    {
      method: "POST",
      body: JSON.stringify({ currentPassword, newPassword }),
    },
  );

  await saveTokens(tokens);
}

/** Sign-in. The only call that carries no token. */
export async function login(
  email: string,
  password: string,
): Promise<void> {
  const response = await fetch(`${BASE}/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as ApiErrorBody | null;
    throw new ApiError(response.status, body);
  }

  await saveTokens(
    (await response.json()) as { accessToken: string; refreshToken: string },
  );
}
