import { describe, expect, it } from "vitest";
import { buggyNoseFromSticker, noseAnchorLocal } from "../src/render/buggyNose";
import { Group, Mesh, SphereGeometry, MeshBasicMaterial, Vector3 } from "three";
import { emptyKit } from "../src/meta/save";

describe("buggy nose helpers", () => {
  it("maps sticker ids to nose variants", () => {
    expect(buggyNoseFromSticker("none")).toBe("none");
    expect(buggyNoseFromSticker("flames")).toBe("skull");
    expect(buggyNoseFromSticker("bolt")).toBe("bird");
    expect(buggyNoseFromSticker("star")).toBe("dog");
  });

  it("defaults Käferkraft kit to bare bumper (no front prop)", () => {
    expect(emptyKit("kaeferkraft").sticker).toBe("none");
  });

  it("anchors nose in root-local space near skull meshes", () => {
    const root = new Group();
    const skull = new Mesh(new SphereGeometry(0.2, 8, 8), new MeshBasicMaterial({ name: "Skull" }));
    skull.position.set(-1.2, 0.4, 0);
    root.add(skull);
    root.updateMatrixWorld(true);
    const anchor = noseAnchorLocal(root, [skull]);
    expect(anchor.distanceTo(new Vector3(-1.2, 0.4, 0))).toBeLessThan(0.05);
  });
});
