#!/usr/bin/env node
/**
 * Free the Vite dev port without `pkill -f vite`.
 * Broad pkill matches the agent/shell argv (which often contains "vite") and
 * kills the agent mid-command — looks like a stuck test agent.
 */
import { execFileSync } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

const port = Number(process.argv[2] ?? process.env.PORT ?? 5173);
if (!Number.isFinite(port) || port <= 0) {
  console.error(`Invalid port: ${process.argv[2]}`);
  process.exit(1);
}

function pidsOnPort(p) {
  try {
    const out = execFileSync("ss", ["-ltnp"], { encoding: "utf8" });
    const pids = new Set();
    for (const line of out.split("\n")) {
      if (!line.includes(`:${p}`) || !line.includes("pid=")) continue;
      for (const m of line.matchAll(/pid=(\d+)/g)) pids.add(Number(m[1]));
    }
    return [...pids];
  } catch {
    return [];
  }
}

const pids = pidsOnPort(port);
if (pids.length === 0) {
  console.log(`Port ${port} is free.`);
  process.exit(0);
}

for (const pid of pids) {
  try {
    process.kill(pid, "SIGTERM");
    console.log(`Sent SIGTERM to pid ${pid} (port ${port}).`);
  } catch (err) {
    console.warn(`Could not signal pid ${pid}: ${err.message}`);
  }
}

const deadline = Date.now() + 3000;
while (Date.now() < deadline && pidsOnPort(port).length > 0) {
  await delay(100);
}

const left = pidsOnPort(port);
if (left.length > 0) {
  for (const pid of left) {
    try {
      process.kill(pid, "SIGKILL");
      console.log(`Sent SIGKILL to pid ${pid} (port ${port}).`);
    } catch {
      /* already gone */
    }
  }
}

console.log(pidsOnPort(port).length === 0 ? `Port ${port} is free.` : `Port ${port} still busy.`);
process.exit(pidsOnPort(port).length === 0 ? 0 : 1);
