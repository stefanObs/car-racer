/** @vitest-environment happy-dom */

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  formatMeshInspectClipboard,
  formatMeshInspectLine,
  formatMeshInspectLines,
  meshInspectPointerAction,
  type MeshInspectHit,
} from "../src/core/meshInspect";
import { applyMeshInspectMode, isMeshInspectMode, renderMeshInspectPanelHtml } from "../src/dev/meshInspectPanel";

describe("F5 mesh inspect panel", () => {
  it("formats element then mesh-space coordinates", () => {
    const hit: MeshInspectHit = { name: "StockWheel_FL", x: -0.6732, y: 0.2864, z: 1.0211 };
    expect(formatMeshInspectLine(hit)).toBe("StockWheel_FL  -0.673, 0.286, 1.021");
  });

  it("lists every hit and uses (nichts) when empty", () => {
    expect(formatMeshInspectLines([])).toBe("(nichts)");
    expect(
      formatMeshInspectLines([
        { name: "BodyPaint", x: 0, y: 0.5, z: -1 },
        { name: "StockWheel_FL", x: -0.6, y: 0.3, z: 1 },
      ]),
    ).toBe("BodyPaint  0.000, 0.500, -1.000\nStockWheel_FL  -0.600, 0.300, 1.000");
  });

  it("clipboard text matches the info panel body", () => {
    const hits = [{ name: "BodyPaint", x: 0.12, y: 0.55, z: -0.8 }];
    expect(formatMeshInspectClipboard(hits)).toBe("Mesh-Raum (m)\nBodyPaint  0.120, 0.550, -0.800");
  });

  it("maps LMB to orbit and RMB to copy", () => {
    expect(meshInspectPointerAction(0)).toBe("orbit");
    expect(meshInspectPointerAction(2)).toBe("copy");
    expect(meshInspectPointerAction(1)).toBe("ignore");
  });

  it("renders each element with coordinates behind it", () => {
    const html = renderMeshInspectPanelHtml([
      { name: "BodyPaint", x: 0, y: 1, z: 0 },
      { name: "carPart-rear_spoiler", x: 0, y: 0.71, z: -1.62 },
    ]);
    expect(html).toContain("Mesh-Raum (m)");
    expect(html).toContain("BodyPaint  0.000, 1.000, 0.000");
    expect(html).toContain("carPart-rear_spoiler  0.000, 0.710, -1.620");
    expect(html).toContain("RMB kopieren");
  });

  it("toggles the studio chrome class", () => {
    const el = document.createElement("div");
    expect(isMeshInspectMode(el)).toBe(false);
    applyMeshInspectMode(el, true);
    expect(isMeshInspectMode(el)).toBe(true);
    applyMeshInspectMode(el, false);
    expect(isMeshInspectMode(el)).toBe(false);
  });

  it("hides garage chrome but keeps the inspect panel", () => {
    const css = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), "../src/ui/styles.css"), "utf8");
    expect(css).toContain("html.dev-mesh-inspect-mode .ui-root");
    expect(css).toContain(".dev-mesh-inspect");
    expect(css).toContain("html.dev-mesh-inspect-mode .dev-badge");
  });
});
