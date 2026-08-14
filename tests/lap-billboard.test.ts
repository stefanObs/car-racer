/** @vitest-environment happy-dom */
import { describe, expect, it } from "vitest";
import { BoxGeometry, Group, Mesh, MeshBasicMaterial, PerspectiveCamera } from "three";
import {
  createLapBillboard,
  formatLapBillboardLabel,
  LAP_BILLBOARD_FLASH_SEC,
  LAP_BILLBOARD_NAME,
  LAP_NUMBER_BADGE_Z,
  LAP_SHIELD_FACE_YAW,
  LAP_SHIELD_FLASH_SCALE,
  lapBillboardFlashUntil,
  lapBillboardFlashVisible,
  setLapBillboardLabel,
  syncLapBillboard,
} from "../src/render/lapBillboard";

describe("lap billboard", () => {
  it("formats plaque text as current/total", () => {
    expect(formatLapBillboardLabel(1, 5)).toBe("1/5");
    expect(formatLapBillboardLabel(6, 5)).toBe("5/5");
  });

  it("keeps the Tripo shield flash compact and camera-facing (−Z after yaw)", () => {
    expect(LAP_SHIELD_FLASH_SCALE).toBeLessThan(0.8);
    expect(LAP_SHIELD_FACE_YAW).toBeCloseTo(-Math.PI / 2, 5);
    expect(LAP_NUMBER_BADGE_Z).toBeLessThan(0);
  });

  it("creates a named group plaque", () => {
    const plaque = createLapBillboard();
    expect(plaque).toBeInstanceOf(Group);
    expect(plaque.name).toBe(LAP_BILLBOARD_NAME);
  });

  it("only starts a flash when lap increases (finish-line crossing)", () => {
    expect(lapBillboardFlashUntil(undefined, 1, 10)).toBeNull();
    expect(lapBillboardFlashUntil(1, 1, 10)).toBeNull();
    expect(lapBillboardFlashUntil(1, 2, 10)).toBeCloseTo(10 + LAP_BILLBOARD_FLASH_SEC, 5);
    expect(lapBillboardFlashVisible(12.2, 11)).toBe(true);
    expect(lapBillboardFlashVisible(12.2, 12.3)).toBe(false);
  });

  it("sits above the car roof AABB, not at the root origin inside the mesh", () => {
    const root = new Group();
    const body = new Mesh(new BoxGeometry(2, 1.2, 4), new MeshBasicMaterial());
    body.position.y = 0.6;
    root.add(body);
    root.position.set(10, 0, -5);
    root.updateMatrixWorld(true);

    const plaque = createLapBillboard();
    const cam = new PerspectiveCamera();
    cam.position.set(10, 3, 5);
    syncLapBillboard(plaque, root, cam, 2, 5, true, 0);

    expect(plaque.position.y).toBeGreaterThanOrEqual(2.75);
    expect(plaque.position.z).toBeGreaterThan(-5);
    expect(plaque.userData.lapLabel).toBe("2/5");
  });

  it("updates the number badge when the lap changes", () => {
    const plaque = createLapBillboard();
    setLapBillboardLabel(plaque, 3, 5);
    expect(plaque.userData.lapLabel).toBe("3/5");
  });
});
