import { describe, expect, it } from "vitest";
import {
  addPlacement,
  applyTrackEditorPatchToLevel,
  clearanceGaugeFitsTrack,
  cloneTrackEditorDoc,
  defaultFlyCamera,
  deletePlacement,
  emptyTrackEditorDoc,
  FLY_SPEED,
  flyForward,
  flyFlatForward,
  formatTrackEditorPatch,
  movePlacement,
  nudgePlacement,
  parseTrackEditorPatch,
  restoreTrackEditor,
  selectPlacement,
  snapshotTrackEditor,
  stepFlyCamera,
  trackEditorDocFromLevel,
  TRACK_EDITOR_DEFAULT_LEVEL_ID,
  TRACK_EDITOR_GAUGE_KIND,
  TRACK_EDITOR_PATCH_HEADER,
  trackEditorDirty,
  yawPlacement,
} from "../src/core/trackEditor";
import { CUP_LEVELS } from "../src/data/levels";
import { buildTrackFromLevel } from "../src/track/buildTrack";
import {
  CAR_LATERAL_WIDTH_M,
  GAUGE_WIDTH_RATIO,
  gaugeBoxSize,
  isTrackEditorPlaceKind,
  smallestCarIdForGauge,
  smallestCarLateralWidth,
  TRACK_EDITOR_PALETTE,
} from "../src/data/trackEditorCatalog";
import { TRACK_PROP_IDS } from "../src/data/trackModels";
import { escapeOpensSettings } from "../src/ui/settingsEsc";
import { renderTrackEditorHtml } from "../src/ui/trackEditorHtml";

describe("F8 track editor catalog", () => {
  it("uses 80% of the narrowest car mesh width for the gauge", () => {
    expect(smallestCarIdForGauge()).toBe("bison");
    expect(smallestCarLateralWidth()).toBe(CAR_LATERAL_WIDTH_M.bison);
    expect(smallestCarLateralWidth()).toBeCloseTo(1.702, 3);
    const box = gaugeBoxSize();
    expect(box.width).toBeCloseTo(CAR_LATERAL_WIDTH_M.bison * GAUGE_WIDTH_RATIO, 3);
    expect(box.width).toBeCloseTo(1.362, 3);
    expect(box.height).toBeCloseTo(1.05, 2);
    expect(box.depth).toBeCloseTo(1.4, 2);
  });

  it("lists every track-kit id plus the gauge", () => {
    const ids = TRACK_EDITOR_PALETTE.map((p) => p.id);
    expect(ids).toContain("gauge");
    for (const id of TRACK_PROP_IDS) {
      expect(ids, id).toContain(id);
      expect(isTrackEditorPlaceKind(id)).toBe(true);
    }
    expect(isTrackEditorPlaceKind("gauge")).toBe(true);
    expect(isTrackEditorPlaceKind("not-a-prop")).toBe(false);
    expect(TRACK_EDITOR_PALETTE[0]?.label).toBe("Durchfahrt");
  });
});

describe("F8 fly camera", () => {
  it("moves along look when flying forward", () => {
    const cam = { x: 0, y: 10, z: 0, yaw: 0, pitch: 0 };
    const next = stepFlyCamera(
      cam,
      { forward: 1, right: 0, up: 0, lookYaw: 0, lookPitch: 0, sprint: false },
      1,
    );
    const f = flyForward(cam);
    expect(next.x).toBeCloseTo(f.x * FLY_SPEED, 5);
    expect(next.z).toBeCloseTo(f.z * FLY_SPEED, 5);
    expect(next.z).toBeGreaterThan(1);
  });

  it("moves on the XZ plane even when looking down", () => {
    const cam = { x: 0, y: 10, z: 0, yaw: 0, pitch: -0.8 };
    const next = stepFlyCamera(
      cam,
      { forward: 1, right: 0, up: 0, lookYaw: 0, lookPitch: 0, sprint: false },
      1,
    );
    const flat = flyFlatForward(cam.yaw);
    expect(next.x).toBeCloseTo(flat.x * FLY_SPEED, 5);
    expect(next.z).toBeCloseTo(flat.z * FLY_SPEED, 5);
    expect(next.y).toBeCloseTo(10, 5);
  });

  it("starts behind the start heading like chase cam", () => {
    const cam = defaultFlyCamera({ x: 0, z: 0 }, 0);
    expect(cam.x).toBeCloseTo(-18, 5);
    expect(cam.z).toBeCloseTo(0, 5);
    const ahead = stepFlyCamera(
      cam,
      { forward: 1, right: 0, up: 0, lookYaw: 0, lookPitch: 0, sprint: false },
      0.1,
    );
    expect(ahead.x).toBeGreaterThan(cam.x);
  });
});

describe("F8 snapshot / reset / patch", () => {
  it("round-trips snapshot restore and dirty flag", () => {
    const start = emptyTrackEditorDoc();
    const snap = snapshotTrackEditor(start);
    const placed = addPlacement(start, TRACK_EDITOR_GAUGE_KIND, 4, 0, -2, 0.5);
    expect(trackEditorDirty(placed, snap)).toBe(true);
    const reset = restoreTrackEditor(snap);
    expect(trackEditorDirty(reset, snap)).toBe(false);
    expect(reset.placements).toHaveLength(0);
    const clone = cloneTrackEditorDoc(placed);
    clone.placements[0]!.x = 99;
    expect(placed.placements[0]!.x).toBe(4);
  });

  it("formats and parses an F8 TRACK PATCH", () => {
    let doc = emptyTrackEditorDoc("blitz_cup_02_kuestenline");
    doc = { ...doc, panoramaKind: "beach", panoramaOffsetY: 2.5, panoramaHeightScale: 1.1 };
    doc = addPlacement(doc, "crane", 12, 0, -4.2, 1.57);
    doc = addPlacement(doc, "gauge", 0, 0, 8, 0);
    doc = movePlacement(doc, "p-1", 12.25, -4.2);
    doc = yawPlacement(doc, "p-1", 0);
    const text = formatTrackEditorPatch(doc);
    expect(text.startsWith(TRACK_EDITOR_PATCH_HEADER)).toBe(true);
    expect(text).toContain("level: blitz_cup_02_kuestenline");
    expect(text).toContain("panoramaKind: beach");
    expect(text).toContain("panoramaOffsetY: 2.5");
    expect(text).toContain("kind=crane");
    expect(text).toContain("kind=gauge");
    const parsed = parseTrackEditorPatch(text);
    expect(parsed).toBeTruthy();
    expect(parsed!.levelId).toBe("blitz_cup_02_kuestenline");
    expect(parsed!.panoramaKind).toBe("beach");
    expect(parsed!.panoramaOffsetY).toBeCloseTo(2.5, 5);
    expect(parsed!.panoramaHeightScale).toBeCloseTo(1.1, 5);
    expect(parsed!.placements).toHaveLength(2);
    expect(parsed!.placements[0]!.kind).toBe("crane");
    expect(parsed!.placements[0]!.x).toBeCloseTo(12.25, 2);
    expect(parsed!.placements[1]!.kind).toBe("gauge");
    const gone = deletePlacement(doc, "p-2");
    expect(gone.placements).toHaveLength(1);
    expect(gone.selectedId).toBeNull();
  });

  it("defaults to Hafenstart and rejects a foreign header", () => {
    expect(TRACK_EDITOR_DEFAULT_LEVEL_ID).toBe("blitz_cup_01_hafenstart");
    expect(parseTrackEditorPatch("CRASH CIRCUIT F5 PATCH v1\nlevel: x")).toBeNull();
  });

  it("does not open Einstellungen from the editor screen", () => {
    expect(escapeOpensSettings("trackEditor")).toBe(false);
    expect(escapeOpensSettings("garage")).toBe(true);
  });

  it("renders German overlay chrome", () => {
    const html = renderTrackEditorHtml({
      tracks: [{ id: "blitz_cup_01_hafenstart", displayName: "Hafenstart" }],
      doc: emptyTrackEditorDoc(),
      copied: false,
    });
    expect(html).toContain("Strecken-Editor");
    expect(html).toContain("Durchfahrt");
    expect(html).toContain("Kopieren");
    expect(html).toContain("Zurücksetzen");
    expect(html).toContain("Panorama Höhe");
    expect(html).toContain("Panorama Kuppel");
    expect(html).toContain('data-editor-pano-kind');
    expect(html).toContain('data-act="editor-copy"');
  });

  it("nudges a selected placement on all axes", () => {
    let doc = addPlacement(emptyTrackEditorDoc(), "crane", 1, 0, 2, 0);
    doc = selectPlacement(doc, "p-1");
    doc = nudgePlacement(doc, "p-1", 0.5, 0.25, -0.3);
    expect(doc.placements[0]).toMatchObject({ x: 1.5, y: 0.25, z: 1.7 });
  });

  it("bakes an F8 patch onto a cup level", () => {
    const level = CUP_LEVELS[0]!;
    const patchText = [
      TRACK_EDITOR_PATCH_HEADER,
      "instruction: test",
      "level: blitz_cup_01_hafenstart",
      "panoramaOffsetY: 16",
      "panoramaHeightScale: 1.5",
      "placements:",
      "- kind=gauge x=71.98 y=0 z=9.4 yaw=0",
    ].join("\n");
    const doc = parseTrackEditorPatch(patchText)!;
    const baked = applyTrackEditorPatchToLevel(level, doc);
    expect(baked.panorama).toEqual({ offsetY: 16, heightScale: 1.5 });
    expect(baked.clearanceGauges).toEqual([{ x: 71.98, y: 0, z: 9.4, yaw: 0 }]);
    expect(baked.sceneryPlacements).toBeUndefined();
    const roundTrip = trackEditorDocFromLevel(baked);
    expect(roundTrip.panoramaOffsetY).toBe(16);
    expect(roundTrip.placements).toHaveLength(1);
    expect(roundTrip.placements[0]!.kind).toBe("gauge");
  });

  it("keeps Hafenstart baked panorama and clearance gauge from the F8 patch", () => {
    const level = CUP_LEVELS[0]!;
    expect(level.panorama).toEqual({ offsetY: 16, heightScale: 1.5 });
    expect(level.clearanceGauges).toEqual([{ x: 71.98, y: 0, z: 9.4, yaw: 0 }]);
    const editorDoc = trackEditorDocFromLevel(level);
    expect(editorDoc.panoramaOffsetY).toBe(16);
    expect(editorDoc.placements[0]).toMatchObject({ kind: "gauge", x: 71.98, z: 9.4 });
  });

  it("validates a Durchfahrt box fully on asphalt", () => {
    const track = buildTrackFromLevel(CUP_LEVELS[0]!);
    expect(clearanceGaugeFitsTrack(track, { x: 0, y: 0, z: 0, yaw: 0 })).toBe(true);
  });
});
