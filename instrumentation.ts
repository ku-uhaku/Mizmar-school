/**
 * Runs once, before the server takes its first request.
 *
 * All it does is open the connection pool — see `warmConnection` in lib/db.ts.
 * It belongs at boot rather than beside the client, because `lib/db.ts` is
 * evaluated lazily by whichever request happens to import it first, and that
 * request would then be the one paying for the connect and the handshake.
 *
 * Node runtime only. The Edge runtime has no database connection to open, and
 * importing the Prisma client there would fail the build.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { warmConnection } = await import("@/lib/db");
  await warmConnection();
}
