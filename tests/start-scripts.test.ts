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

  it("uses platform-specific Node home on Unix (linux/darwin folder)", () => {
    const sh = readFileSync(resolve(root, "start.sh"), "utf8");
    expect(sh).toContain('NODE_HOME="$TOOLS_DIR/node-v${NODE_VERSION}-${PLATFORM}"');
    expect(sh).toContain("detect_platform");
    expect(sh).toContain("darwin");
  });

  it("uses platform-specific Node home on Windows too", () => {
    const ps1 = readFileSync(resolve(root, "start.ps1"), "utf8");
    expect(ps1).toContain("Get-NodePlatform");
    expect(ps1).toContain('node-v$NodeVersion-$Platform');
    expect(ps1).toContain("win-arm64");
  });

  it("exposes safe port free helper instead of pkill -f vite", () => {
    const pkg = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));
    expect(pkg.scripts["free:dev"]).toContain("free-dev-port");
    expect(existsSync(resolve(root, "scripts/free-dev-port.mjs"))).toBe(true);
    const helper = readFileSync(resolve(root, "scripts/free-dev-port.mjs"), "utf8");
    expect(helper).toContain("pkill -f vite");
    expect(helper).toContain("ss");
  });
});
