import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

describe("free-dev-port", () => {
  it("matches exact listener ports only", async () => {
    const mod = await import(pathToFileURL(resolve(root, "scripts/free-dev-port.mjs")).href);
    expect(mod.lineHasPort("LISTEN 0 0.0.0.0:5173 0.0.0.0:*", 5173)).toBe(true);
    expect(mod.lineHasPort("LISTEN 0 0.0.0.0:51730 0.0.0.0:*", 5173)).toBe(false);
    expect(mod.lineHasPort("LISTEN 0 0.0.0.0:15173 0.0.0.0:*", 5173)).toBe(false);
    expect(mod.pidsFromSsOutput('users:(("node",pid=42,fd=24)) 0.0.0.0:5173', 5173)).toEqual([42]);
    expect(mod.pidsFromNetstatOutput("  TCP    0.0.0.0:5173    0.0.0.0:0    LISTENING       99", 5173)).toEqual([
      99,
    ]);
  });

  it("start scripts free :5173 before vite so busy-port cannot block boot", () => {
    const sh = readFileSync(resolve(root, "start.sh"), "utf8");
    const ps1 = readFileSync(resolve(root, "start.ps1"), "utf8");
    expect(sh).toContain("scripts/free-dev-port.mjs 5173");
    expect(sh.indexOf("free-dev-port")).toBeLessThan(sh.indexOf("npm run dev"));
    expect(ps1).toContain("scripts/free-dev-port.mjs 5173");
    expect(ps1.indexOf("free-dev-port")).toBeLessThan(ps1.indexOf("npm run dev"));
  });
});
