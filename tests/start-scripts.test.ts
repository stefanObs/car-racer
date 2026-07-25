import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

describe("start scripts", () => {
  it("keeps cross-platform launchers present", () => {
    const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
    expect(existsSync(resolve(root, "start.sh"))).toBe(true);
    expect(existsSync(resolve(root, "start.bat"))).toBe(true);
    expect(existsSync(resolve(root, "start.ps1"))).toBe(true);
  });
});
