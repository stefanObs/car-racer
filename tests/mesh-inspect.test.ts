/** @vitest-environment happy-dom */

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  carPartIdFromObjectName,
  formatMeshInspectClipboard,
  formatMeshInspectLine,
  formatMeshInspectLines,
  formatMeshInspectPatch,
  MESH_INSPECT_PATCH_HEADER,
  meshInspectDragExceeded,
  meshInspectDragMode,
  meshInspectEscapeStep,
  meshInspectGestureAfterDrag,
  meshInspectNudgeDelta,
  meshInspectPointerAction,
  meshInspectPoseChanged,
  meshInspectScaleFactor,
  meshInspectToolFromKey,
  meshInspectYawDelta,
  meshInspectWantParent,
  parseMeshInspectPatch,
  type MeshInspectHit,
} from "../src/core/meshInspect";
import {
  applyMeshInspectMode,
  isMeshInspectMode,
  meshInspectHint,
  renderMeshInspectPanelHtml,
} from "../src/dev/meshInspectPanel";

describe("F5 mesh inspect panel", () => {
  it("formats element then mesh-space coordinates", () => {
    const hit: MeshInspectHit = { name: "StockWheel_FL", x: -0.6732, y: 0.2864, z: 1.0211 };
    expect(formatMeshInspectLine(hit)).toBe("StockWheel_FL  -0.673, 0.286, 1.021");
  });

  it("formats locked vs free scale on the selection line", () => {
    expect(
      formatMeshInspectLine({ name: "Waist", x: 1, y: 2, z: 3, sx: 1.5, sy: 1.5, sz: 1.5 }),
    ).toBe("Waist  1.000, 2.000, 3.000  ×1.50");
    expect(
      formatMeshInspectLine({ name: "Waist", x: 1, y: 2, z: 3, sx: 1.5, sy: 0.8, sz: 1.5 }),
    ).toBe("Waist  1.000, 2.000, 3.000  ×1.50, 0.80, 1.50");
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
    expect(
      formatMeshInspectClipboard(hits, { name: "Waist", id: "a", x: 1, y: 2, z: 3 }),
    ).toBe("Mesh-Raum (m)\nWaist  1.000, 2.000, 3.000");
  });

  it("round-trips an F5 bake patch the agent can apply", () => {
    expect(carPartIdFromObjectName("carPart-reinforced_frame")).toBe("reinforced_frame");
    expect(carPartIdFromObjectName("carPart-reinforced_frame-1")).toBe("reinforced_frame");
    const from = { x: 0, y: 0.5, z: 0.4, yaw: 0, pitch: 0, roll: 0, sx: 1, sy: 1, sz: 1 };
    const to = { ...from, y: 0.6, yaw: 15, sx: 1.2, sy: 1.2, sz: 1.2 };
    expect(meshInspectPoseChanged(from, to)).toBe(true);
    expect(meshInspectPoseChanged(from, from)).toBe(false);
    const text = formatMeshInspectPatch({
      car: "donnerbuechse",
      nodes: [
        {
          name: "StockEngine",
          path: "StockEngine",
          file: "public/models/cars/donnerbuechse.glb",
          apply: "glb-node",
          from,
          to,
        },
      ],
    });
    expect(text.startsWith(MESH_INSPECT_PATCH_HEADER)).toBe(true);
    const parsed = parseMeshInspectPatch(text);
    expect(parsed?.car).toBe("donnerbuechse");
    expect(parsed?.nodes[0]?.name).toBe("StockEngine");
    expect(parsed?.nodes[0]?.to.y).toBeCloseTo(0.6);
    expect(parsed?.nodes[0]?.to.yaw).toBeCloseTo(15);
    expect(parsed?.nodes[0]?.to.sx).toBeCloseTo(1.2);
  });

  it("maps LMB to orbit and RMB to copy unless place mode is on", () => {
    expect(meshInspectPointerAction(0)).toBe("orbit");
    expect(meshInspectPointerAction(2)).toBe("copy");
    expect(meshInspectPointerAction(1)).toBe("orbit");
    expect(meshInspectPointerAction(0, { edit: true })).toBe("selectOrMove");
    expect(meshInspectPointerAction(0, { edit: true, altKey: true })).toBe("orbit");
    expect(meshInspectPointerAction(2, { edit: true })).toBe("copy");
  });

  it("treats a short click as select and a drag on the selection as move", () => {
    expect(meshInspectDragExceeded(1, 1)).toBe(false);
    expect(meshInspectDragExceeded(4, 0)).toBe(true);
    expect(
      meshInspectGestureAfterDrag({
        edit: true,
        hasSelection: true,
        hitIsSelection: true,
        hitEmpty: false,
      }),
    ).toBe("move");
    expect(
      meshInspectGestureAfterDrag({
        edit: true,
        hasSelection: true,
        hitIsSelection: false,
        hitEmpty: true,
      }),
    ).toBe("orbit");
    expect(
      meshInspectGestureAfterDrag({
        edit: true,
        hasSelection: true,
        hitIsSelection: true,
        hitEmpty: false,
        tool: "rotate",
      }),
    ).toBe("rotate");
    expect(
      meshInspectGestureAfterDrag({
        edit: true,
        hasSelection: true,
        hitIsSelection: true,
        hitEmpty: false,
        hasEdge: true,
      }),
    ).toBe("moveEdge");
    expect(
      meshInspectGestureAfterDrag({
        edit: true,
        hasSelection: true,
        hitIsSelection: true,
        hitEmpty: false,
        hasEdge: true,
        tool: "scaleUniform",
      }),
    ).toBe("scaleUniform");
    expect(
      meshInspectGestureAfterDrag({
        edit: true,
        hasSelection: true,
        hitIsSelection: true,
        hitEmpty: false,
        tool: "scaleFree",
      }),
    ).toBe("scaleFree");
    expect(meshInspectEscapeStep({ hasEdge: true, hasSelection: true, edit: true })).toBe("clearEdge");
  });

  it("nudges in mesh space and steps Esc through selection then place then studio", () => {
    expect(meshInspectNudgeDelta("ArrowRight", {})).toEqual({ x: 0.05, y: 0, z: 0 });
    expect(meshInspectNudgeDelta("ArrowUp", { shift: true })).toEqual({ x: 0, y: 0, z: 0.01 });
    expect(meshInspectNudgeDelta("PageDown", { ctrl: true })).toEqual({ x: 0, y: -0.25, z: 0 });
    expect(meshInspectDragMode({ shift: true })).toBe("keepY");
    expect(meshInspectDragMode({ ctrl: true })).toBe("onlyY");
    expect(meshInspectWantParent({ shift: true })).toBe(true);
    expect(meshInspectWantParent({ ctrl: true })).toBe(false);
    expect(meshInspectEscapeStep({ hasSelection: true, edit: true })).toBe("clearSelection");
    expect(meshInspectEscapeStep({ hasSelection: false, edit: true })).toBe("leaveEdit");
    expect(meshInspectEscapeStep({ hasSelection: false, edit: false })).toBe("leaveStudio");
    expect(meshInspectToolFromKey("KeyR")).toBe("rotate");
    expect(meshInspectToolFromKey("KeyG")).toBe("move");
    expect(meshInspectToolFromKey("KeyS")).toBe("scaleUniform");
    expect(meshInspectToolFromKey("KeyX")).toBe("scaleFree");
    expect(meshInspectYawDelta("BracketLeft", {})).toBeCloseTo((5 * Math.PI) / 180);
    expect(meshInspectScaleFactor("Equal", {})).toBeCloseTo(1.05);
    expect(meshInspectScaleFactor("Minus", { shift: true })).toBeCloseTo(1 / 1.01);
  });

  it("renders each element with coordinates behind it", () => {
    const html = renderMeshInspectPanelHtml([
      { name: "BodyPaint", x: 0, y: 1, z: 0 },
      { name: "carPart-rear_spoiler", x: 0, y: 0.71, z: -1.62 },
    ]);
    expect(html).toContain("Mesh-Raum (m)");
    expect(html).toContain("BodyPaint  0.000, 1.000, 0.000");
    expect(html).toContain("carPart-rear_spoiler  0.000, 0.710, -1.620");
    expect(html).toContain("RMB/C kopieren");
    expect(html).toContain("Platzieren AUS");
    expect(html).toContain("Komponenten");
    expect(html).toContain("Keine Komponenten");
  });

  it("shows the selected origin and place-mode hint", () => {
    const html = renderMeshInspectPanelHtml([], {
      edit: true,
      selection: { name: "Waist", id: "u1", x: 0.1, y: 1, z: -0.5 },
      catalog: [
        { id: "eng", name: "StockEngine", depth: 0 },
        { id: "u1", name: "Waist", depth: 1 },
      ],
    });
    expect(html).toContain("Platzieren AN");
    expect(html).toContain("Waist  0.100, 1.000, -0.500");
    expect(html).toContain("Ziehen versetzen");
    expect(html).toContain("Drehen");
    expect(html).toContain("1:1");
    expect(html).toContain("Strecken");
    expect(html).toContain("Kante");
    expect(html).toContain("StockEngine");
    expect(html).toContain('data-mesh-inspect-select="eng"');
    expect(html).toContain('data-mesh-inspect-select="u1"');
    expect(html).toMatch(/class="is-on" data-mesh-inspect-select="u1"/);
    expect(meshInspectHint({ edit: false })).toContain("Liste wählt Teil");
    expect(meshInspectHint({ edit: true, dirtyCount: 2 })).toContain("Patch an den Agenten");
    expect(meshInspectHint({ edit: true, selection: { name: "Waist", id: "u1", x: 0, y: 0, z: 0 }, tool: "scaleUniform" })).toContain("Ziehen 1:1");
    expect(meshInspectHint({ edit: true, selection: { name: "Waist", id: "u1", x: 0, y: 0, z: 0 }, tool: "scaleFree" })).toContain("Ziehen strecken");
    const copyHtml = renderMeshInspectPanelHtml([], { edit: true, dirtyCount: 1 });
    expect(copyHtml).toContain("Änderung kopieren");
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
    expect(css).toContain(".dev-mesh-inspect-edit");
    expect(css).toContain(".dev-mesh-inspect-tools");
    expect(css).toContain(".dev-mesh-inspect-catalog");
  });

  it("does not snap garage pitch when releasing the mouse in F5 studio", () => {
    const presenter = readFileSync(
      resolve(dirname(fileURLToPath(import.meta.url)), "../src/render/garagePresenter.ts"),
      "utf8",
    );
    const app = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), "../src/app/GameApp.ts"), "utf8");
    expect(presenter).toMatch(/setPitchInspect\([\s\S]*?if \(this\.meshInspect\) return;/);
    expect(app).toContain("if (this.renderer.isMeshInspect()) return;");
  });

  it("builds the pick marker as a small outlined toon ball", () => {
    const presenter = readFileSync(
      resolve(dirname(fileURLToPath(import.meta.url)), "../src/render/garagePresenter.ts"),
      "utf8",
    );
    expect(presenter).toContain("withOutline(");
    expect(presenter).toContain("comicToon(");
    expect(presenter).toContain("MESH_INSPECT_MARKER_RADIUS");
    expect(presenter).not.toMatch(/SphereGeometry\(0\.07/);
  });
});
