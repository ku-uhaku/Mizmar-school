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

function stopAll() {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) {
    if (child.exitCode === null) child.kill();
  }
}

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    stopAll();
    process.exit(0);
  });
}

// ── Go ───────────────────────────────────────────────────────────────────────

checkApiUrl();

console.log(
  `${COLOURS.web}[web]${RESET}    http://localhost:3000\n` +
    `${COLOURS.mobile}[mobile]${RESET} Metro on http://localhost:8081 — press a/i/w in this terminal\n`,
);

start("web", "npm", ["run", "dev"], root);
start("mobile", "npx", ["expo", "start"], join(root, "mobile"));
