/**
 * Runs once, before the server takes its first request.
 *
 * It opens the connection pool — see `warmConnection` in lib/db.ts. That
 * belongs at boot rather than beside the client, because `lib/db.ts` is
 * evaluated lazily by whichever request happens to import it first, and that
 * request would then be the one paying for the connect and the handshake.
 *
 * It also starts the WhatsApp sender, but only when OpenWA is configured — see
 * modules/messaging/worker.ts. A deployment without it runs no loop at all.
 *
 * Node runtime only. The Edge runtime has no database connection to open, and
 * importing the Prisma client there would fail the build.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { warmConnection } = await import("@/lib/db");
  await warmConnection();

  const { isGatewayConfigured } = await import("@/modules/messaging/openwa");
  if (isGatewayConfigured()) {
    const { startMessagingWorker } = await import(
      "@/modules/messaging/worker"
    );
    startMessagingWorker();
  }
}
