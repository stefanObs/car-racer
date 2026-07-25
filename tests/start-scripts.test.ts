import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

describe("start scripts", () => {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

  it("keeps cross-platform launchers present", () => {
    expect(existsSync(resolve(root, "start.sh"))).toBe(true);
    expect(existsSync(resolve(root, "start.bat"))).toBe(true);
    expect(existsSync(resolve(root, "start.ps1"))).toBe(true);
  });

  it("bootstraps portable Node into .tools when missing", () => {
    const sh = readFileSync(resolve(root, "start.sh"), "utf8");
    const ps1 = readFileSync(resolve(root, "start.ps1"), "utf8");
    expect(sh).toContain(".tools");
    expect(sh).toContain("nodejs.org/dist");
    expect(ps1).toContain(".tools");
    expect(ps1).toContain("nodejs.org/dist");
    expect(ps1).toContain("Invoke-WebRequest");
  });

  it("uses platform-specific Node home on Unix (linux-x64 folder)", () => {
    const sh = readFileSync(resolve(root, "start.sh"), "utf8");
    expect(sh).toContain('NODE_HOME="$TOOLS_DIR/node-v${NODE_VERSION}-${PLATFORM}"');
    expect(sh).toContain("detect_platform");
  });
});
