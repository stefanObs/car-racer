import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { resolve } from "node:path";

describe("start scripts", () => {
  it("keeps cross-platform launchers present", () => {
    const root = resolve(import.meta.dirname, "..");
    expect(existsSync(resolve(root, "start.sh"))).toBe(true);
    expect(existsSync(resolve(root, "start.bat"))).toBe(true);
    expect(existsSync(resolve(root, "start.ps1"))).toBe(true);
  });
});
