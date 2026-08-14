/** @vitest-environment happy-dom */
import { describe, expect, it } from "vitest";
import { BoxGeometry, Group, Mesh, MeshBasicMaterial, PerspectiveCamera, Sprite } from "three";
import {
  createLapBillboard,
  formatLapBillboardLabel,
  LAP_BILLBOARD_FLASH_SEC,
  LAP_BILLBOARD_NAME,
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

  it("creates a named camera-facing sprite", () => {
    const sprite = createLapBillboard();
    expect(sprite).toBeInstanceOf(Sprite);
    expect(sprite.name).toBe(LAP_BILLBOARD_NAME);
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

    const sprite = createLapBillboard();
    const cam = new PerspectiveCamera();
    cam.position.set(10, 3, 5);
    syncLapBillboard(sprite, root, cam, 2, 5, true, 0);

    expect(sprite.position.y).toBeGreaterThanOrEqual(2.75);
    expect(sprite.position.z).toBeGreaterThan(-5);
    expect(sprite.userData.lapLabel).toBe("2/5");
  });

  it("updates the canvas when the lap changes", () => {
    const sprite = createLapBillboard();
    setLapBillboardLabel(sprite, 3, 5);
    expect(sprite.userData.lapLabel).toBe("3/5");
  });
});
