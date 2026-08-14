/** @vitest-environment happy-dom */
import { describe, expect, it } from "vitest";
import {
  BoxGeometry,
  DataTexture,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  NearestFilter,
  RGBAFormat,
  SRGBColorSpace,
} from "three";
import { addFxOutlines, applyFxMaterials, FX_OUTLINE_THICKNESS } from "../src/render/loadFxGltf";

describe("FX material comic pass", () => {
  it("applies flat comic materials, nearest maps, and ink outlines", () => {
    expect(FX_OUTLINE_THICKNESS).toBeGreaterThan(0.01);
    const data = new Uint8Array([255, 0, 0, 255]);
    const map = new DataTexture(data, 1, 1, RGBAFormat);
    map.needsUpdate = true;
    const mesh = new Mesh(new BoxGeometry(0.4, 0.2, 0.5), new MeshStandardMaterial({ map }));
    const root = new Group();
    root.add(mesh);

    applyFxMaterials(root, "smokePuff");
    addFxOutlines(root);

    const mat = mesh.material as MeshBasicMaterial;
    expect(mat).toBeInstanceOf(MeshBasicMaterial);
    expect(mat.map).toBeTruthy();
    expect(mat.map!.magFilter).toBe(NearestFilter);
    expect(mat.map!.minFilter).toBe(NearestFilter);
    expect(mat.map!.colorSpace).toBe(SRGBColorSpace);
    expect(mesh.children.some((c) => (c as Mesh).userData.fxOutline)).toBe(true);
  });
});
