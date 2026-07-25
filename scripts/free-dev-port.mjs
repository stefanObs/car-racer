#!/usr/bin/env node
/**
 * Free the Vite dev port without `pkill -f vite`.
 * Broad pkill matches the agent/shell argv (which often contains "vite") and
 * kills the agent mid-command — looks like a stuck test agent.
 */
import { execFileSync } from "node:child_process";
import { realpathSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";

/** Match :5173 as a whole port, not substrings of :15173 / :51730. */
export function lineHasPort(line, p) {
  return new RegExp(`:${p}(?:\\s|$)`).test(line);
}

export function pidsFromSsOutput(out, p) {
  const pids = new Set();
  for (const line of out.split("\n")) {
    if (!lineHasPort(line, p) || !line.includes("pid=")) continue;
    for (const m of line.matchAll(/pid=(\d+)/g)) pids.add(Number(m[1]));
  }
  return [...pids];
}

export function pidsFromNetstatOutput(out, p) {
  const pids = new Set();
  const re = new RegExp(`[:.]${p}\\s+.+LISTENING\\s+(\\d+)`, "i");
  for (const line of out.split("\n")) {
    const m = line.match(re);
    if (m) pids.add(Number(m[1]));
  }
  return [...pids];
}

function pidsOnPort(p) {
  try {
    return pidsFromSsOutput(execFileSync("ss", ["-ltnp"], { encoding: "utf8" }), p);
  } catch {
    try {
      return pidsFromNetstatOutput(execFileSync("netstat", ["-ano"], { encoding: "utf8" }), p);
    } catch {
      return [];
    }
  }
}

export async function freeDevPort(port = 5173) {
  if (!Number.isFinite(port) || port <= 0) {
    throw new Error(`Invalid port: ${port}`);
  }

  const pids = pidsOnPort(port);
  if (pids.length === 0) {
    return { freed: [], message: `Port ${port} is free.` };
  }

  for (const pid of pids) {
    try {
      process.kill(pid, "SIGTERM");
    } catch (err) {
      console.warn(`Could not signal pid ${pid}: ${err.message}`);
    }
  }

  const deadline = Date.now() + 3000;
  while (Date.now() < deadline && pidsOnPort(port).length > 0) {
    await delay(100);
  }

  const left = pidsOnPort(port);
  for (const pid of left) {
    try {
      process.kill(pid, "SIGKILL");
    } catch {
      /* already gone */
    }
  }

  const busy = pidsOnPort(port);
  return {
    freed: pids,
    message: busy.length === 0 ? `Port ${port} is free.` : `Port ${port} still busy.`,
    ok: busy.length === 0,
  };
}

function isCliEntry() {
  const entry = process.argv[1];
  if (!entry) return false;
  try {
    return realpathSync(resolve(entry)) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

if (isCliEntry()) {
  const port = Number(process.argv[2] ?? process.env.PORT ?? 5173);
  try {
    const result = await freeDevPort(port);
    for (const pid of result.freed) {
      console.log(`Stopped pid ${pid} (port ${port}).`);
    }
    console.log(result.message);
    process.exit(result.ok === false ? 1 : 0);
  } catch (err) {
    console.error(err.message ?? err);
    process.exit(1);
  }
}
