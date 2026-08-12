#!/usr/bin/env node
/**
 * Runs the web app and the native app together — `npm run dev:all`.
 *
 * ── Why a script and not two terminals ──────────────────────────────────────
 * The two halves are not independent: the phone has no server of its own, so
 * every screen in `mobile/` is reading `app/api/mobile/v1/**` on the Next dev
 * server. Starting one without the other gives you an app that loads and then
 * fails on its first request, which reads as a bug in whatever screen you had
 * open rather than as a missing process.
 *
 * ── Why no dependency ───────────────────────────────────────────────────────
 * `concurrently` does this and a good deal more. What is actually needed is
 * about forty lines — spawn two children, prefix their output, and make sure
 * neither outlives the other — and a dev-only dependency in the root package is
 * a thing every contributor installs forever.
 *
 * ── The check before the spawn ──────────────────────────────────────────────
 * `mobile/app.json` carries `extra.apiUrl`, and a phone on the school wifi
 * cannot reach `localhost` — that address belongs to the phone. It is the one
 * misconfiguration that produces a working web app, a launching native app, and
 * nothing but network errors inside it, so it is worth a line of warning at
 * startup rather than twenty minutes of confusion.
 */

import { spawn } from "node:child_process";
import { connect } from "node:net";
import { networkInterfaces } from "node:os";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

// ── The apiUrl sanity check ──────────────────────────────────────────────────

/** Every non-internal IPv4 address this machine answers on. */
function localAddresses() {
  return Object.values(networkInterfaces())
    .flat()
    .filter((net) => net && net.family === "IPv4" && !net.internal)
    .map((net) => net.address);
}

function checkApiUrl() {
  let apiUrl;
  try {
    const config = JSON.parse(
      readFileSync(join(root, "mobile", "app.json"), "utf8"),
    );
    apiUrl = config?.expo?.extra?.apiUrl;
  } catch {
    return; // No config to check is not this script's problem to report.
  }

  if (!apiUrl) return;

  const host = new URL(apiUrl).hostname;
  const addresses = localAddresses();

  if (host === "localhost" || host === "127.0.0.1") {
    warn(
      `mobile/app.json points at ${apiUrl}.`,
      "That works in the Expo web preview and fails on a real phone, where",
      "localhost is the phone itself. Use this machine's LAN address:",
      ...addresses.map((address) => `  http://${address}:3000`),
    );
    return;
  }

  // A LAN address that is no longer this machine's — somebody else's commit, or
  // a router that has handed out a new lease since.
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host) && !addresses.includes(host)) {
    warn(
      `mobile/app.json points at ${apiUrl}, which is not an address this`,
      "machine currently answers on. The phone will not reach the server.",
      "This machine is on:",
      ...addresses.map((address) => `  http://${address}:3000`),
    );
  }
}

function warn(...lines) {
  const bar = "─".repeat(72);
  console.warn(`\n\x1b[33m${bar}\n  ${lines.join("\n  ")}\n${bar}\x1b[0m\n`);
}

// ── The two children ─────────────────────────────────────────────────────────

const COLOURS = { web: "\x1b[36m", mobile: "\x1b[35m" };
const RESET = "\x1b[0m";

const children = [];
let shuttingDown = false;

/**
 * Starts one half and prefixes every line it prints.
 *
 * `shell: true` because on Windows `npm` and `npx` are `.cmd` shims, which
 * `spawn` cannot execute directly. The arguments here are all literals from
 * this file, so there is nothing user-supplied reaching a shell.
 */
function start(name, command, args, cwd) {
  const child = spawn(command, args, {
    cwd,
    shell: true,
    stdio: ["inherit", "pipe", "pipe"],
    env: { ...process.env, FORCE_COLOR: "1" },
    // Its own process group, so `stopAll` can signal the whole tree rather than
    // just the shell wrapper. Windows has no groups and uses `taskkill /T`
    // instead, where this flag would detach the console and is not wanted.
    detached: process.platform !== "win32",
  });

  const prefix = `${COLOURS[name]}[${name}]${RESET} `;
  const relay = (stream, out) => {
    let rest = "";
    stream.on("data", (chunk) => {
      const lines = (rest + chunk.toString()).split("\n");
      // The last piece has no newline yet — hold it until the rest arrives, so
      // a progress line is not split across two prefixes.
      rest = lines.pop() ?? "";
      for (const line of lines) out.write(prefix + line + "\n");
    });
    stream.on("end", () => {
      if (rest) out.write(prefix + rest + "\n");
    });
  };

  relay(child.stdout, process.stdout);
  relay(child.stderr, process.stderr);

  child.on("exit", (code, signal) => {
    if (shuttingDown) return;
    // One half going down takes the other with it. A dev server left running
    // alone is worse than none: the next `npm run dev:all` finds its port taken
    // and, on SQLite, its write lock held.
    console.log(`${prefix}exited (${signal ?? code}) — stopping the other.`);
    stopAll();
    process.exitCode = code ?? 1;
  });

  children.push(child);
  return child;
}

/**
 * Stops both halves — and everything they started.
 *
 * ── Why `child.kill()` is not enough ────────────────────────────────────────
 * Both children are spawned with `shell: true`, because on Windows `npm` and
 * `npx` are `.cmd` shims that `spawn` cannot execute directly. That means the
 * process this script holds is the *shell*, and `next dev` and Metro are its
 * grandchildren. Killing the shell leaves them running.
 *
 * The failure that produces is unpleasant and looks like a bug in the app:
 * Ctrl-C appears to work, both servers keep holding ports 3000 and 8081, and
 * the next `npm run dev:all` reports "Port 3000 is in use" and starts a second
 * web server on 3001 that the phone is not pointed at. Worse, the orphan's
 * stdout is now a broken pipe — so it goes on serving pages while every render
 * that writes a log line kills its worker, which surfaces as
 * "Jest worker encountered N child process exceptions" on whatever page you
 * happen to load next.
 *
 * So the whole tree goes: `taskkill /T` on Windows, the process group
 * elsewhere. Failures are swallowed — a child that has already exited is the
 * ordinary case here, not an error.
 */
function stopAll() {
  if (shuttingDown) return;
  shuttingDown = true;

  for (const child of children) {
    if (child.exitCode !== null || child.pid === undefined) continue;

    try {
      if (process.platform === "win32") {
        spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], {
          stdio: "ignore",
        });
      } else {
        // Negative pid = the whole process group, which `detached` gave it.
        process.kill(-child.pid, "SIGTERM");
      }
    } catch {
      // Already gone. Nothing to stop is the goal, not a problem.
      child.kill();
    }
  }
}

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    stopAll();
    process.exit(0);
  });
}

// ── Is anything already there? ───────────────────────────────────────────────

/** Whether something is listening on a local port. */
function portTaken(port) {
  return new Promise((resolve) => {
    const socket = connect({ host: "127.0.0.1", port });
    const done = (taken) => {
      socket.destroy();
      resolve(taken);
    };
    socket.setTimeout(600);
    socket.once("connect", () => done(true));
    socket.once("timeout", () => done(false));
    socket.once("error", () => done(false));
  });
}

/**
 * Refuses to start on top of servers that are already running.
 *
 * ── Why this is worth a preflight rather than letting Next cope ─────────────
 * Next does cope, and that is the problem: a web server whose port is taken
 * prints one grey warning and quietly moves to 3001. Everything then *looks*
 * fine, while the phone — which reads a fixed `apiUrl` — is still pointed at
 * whatever is on 3000. That is usually an orphan from a previous run, left
 * behind because the shell was killed hard enough that no shutdown handler
 * ran, and an orphan is not merely stale: its stdout is a broken pipe, so it
 * serves pages while every render that logs kills its worker. What reaches the
 * screen is "Jest worker encountered N child process exceptions" on some
 * unrelated page, which reads as a bug in the app and is not one.
 *
 * One clear sentence at startup beats an afternoon of that.
 */
async function checkPorts() {
  const held = [];
  for (const [port, what] of [
    [3000, "the web app"],
    [8081, "Metro"],
  ]) {
    if (await portTaken(port)) held.push({ port, what });
  }

  if (held.length === 0) return;

  const how =
    process.platform === "win32"
      ? [
          "Find and stop it with:",
          ...held.map(
            ({ port }) =>
              `  netstat -ano | findstr :${port}      then  taskkill /PID <pid> /T /F`,
          ),
        ]
      : [
          "Find and stop it with:",
          ...held.map(({ port }) => `  lsof -ti :${port} | xargs kill`),
        ];

  warn(
    ...held.map(
      ({ port, what }) => `Port ${port} is already in use — ${what} is running.`,
    ),
    "",
    "Starting now would put the web app on 3001, where the phone is not",
    "looking. Most likely an orphan from a previous run.",
    "",
    ...how,
  );
  process.exit(1);
}

// ── Go ───────────────────────────────────────────────────────────────────────

await checkPorts();
checkApiUrl();

console.log(
  `${COLOURS.web}[web]${RESET}    http://localhost:3000\n` +
    `${COLOURS.mobile}[mobile]${RESET} Metro on http://localhost:8081 — press a/i/w in this terminal\n`,
);

start("web", "npm", ["run", "dev"], root);
start("mobile", "npx", ["expo", "start"], join(root, "mobile"));
