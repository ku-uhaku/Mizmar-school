import "server-only";

/**
 * A thin client for OpenWA (https://github.com/rmyndharis/OpenWA), the WhatsApp
 * gateway that runs beside the app. Everything it needs is in the environment,
 * never the database: an API key is a secret, and the school has no business
 * editing where the gateway lives.
 *
 * ── The one distinction the worker needs ────────────────────────────────────
 * A failed send is either the *recipient's* fault (a number not on WhatsApp — a
 * credit is refunded, the message will never work) or the *session's* (the
 * phone is unpaired, the gateway is down — the message is fine and must be
 * retried once it is back). Treating the second as the first would burn a
 * school's whole batch on an outage.
 */

export type SendResult =
  | { ok: true }
  | { ok: false; kind: "recipient" | "session"; error: string };

type Config = { url: string; apiKey: string; session: string };

function config(): Config | null {
  const url = process.env.OPENWA_URL?.replace(/\/+$/, "");
  const apiKey = process.env.OPENWA_API_KEY;
  const session = process.env.OPENWA_SESSION;
  return url && apiKey && session ? { url, apiKey, session } : null;
}

export function isGatewayConfigured(): boolean {
  return config() !== null;
}

export async function sendText(phone: string, text: string): Promise<SendResult> {
  const settings = config();
  if (!settings) {
    return { ok: false, kind: "session", error: "OpenWA is not configured" };
  }

  try {
    const response = await fetch(
      `${settings.url}/api/sessions/${encodeURIComponent(settings.session)}/messages/send-text`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": settings.apiKey,
        },
        body: JSON.stringify({ chatId: `${phone}@c.us`, text }),
        signal: AbortSignal.timeout(30_000),
      },
    );
    if (response.ok) return { ok: true };

    const detail = (await response.text().catch(() => "")).slice(0, 300);
    // A 4xx other than auth / not-found / throttling is the gateway rejecting
    // this recipient or body, which no retry will change.
    const recipient =
      response.status >= 400 &&
      response.status < 500 &&
      ![401, 403, 404, 429].includes(response.status);
    return {
      ok: false,
      kind: recipient ? "recipient" : "session",
      error: `HTTP ${response.status} ${detail}`.trim(),
    };
  } catch (error) {
    return {
      ok: false,
      kind: "session",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export type GatewayStatus = "READY" | "DISCONNECTED" | "UNCONFIGURED";

/** Whether the paired phone is connected — shown before a manager sends. */
export async function gatewayStatus(): Promise<GatewayStatus> {
  const settings = config();
  if (!settings) return "UNCONFIGURED";

  try {
    const response = await fetch(
      `${settings.url}/api/sessions/${encodeURIComponent(settings.session)}`,
      {
        headers: { "X-API-Key": settings.apiKey },
        signal: AbortSignal.timeout(8_000),
        cache: "no-store",
      },
    );
    if (!response.ok) return "DISCONNECTED";
    const body = (await response.json().catch(() => null)) as {
      status?: unknown;
    } | null;
    const status =
      typeof body?.status === "string" ? body.status.toLowerCase() : "";
    return ["ready", "connected", "working"].includes(status)
      ? "READY"
      : "DISCONNECTED";
  } catch {
    return "DISCONNECTED";
  }
}
