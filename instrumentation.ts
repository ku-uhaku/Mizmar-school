/**
 * Runs once, before the server takes its first request.
 *
 * The one thing that has to happen here is WAL mode — see `ensureWalMode` in
 * lib/db.ts for why a school cannot really run without it. It belongs at boot
 * rather than beside the client, because it is a statement on a connection and
 * `lib/db.ts` is evaluated lazily by whichever request happens to import it
 * first; that request would then be the one paying for it, and in the meantime
 * everything else would already be contending on the old journal.
 *
 * Node runtime only. The Edge runtime has no SQLite to configure, and importing
 * the Prisma client there would fail the build.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { ensureWalMode } = await import("@/lib/db");
  await ensureWalMode();
}
