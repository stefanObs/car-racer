import { describe, expect, it } from "vitest";
import {
  buggyNoseFromSticker,
  bumperHeadlightPerchLocal,
  isBuggySkullCosmeticName,
  noseAnchorLocal,
} from "../src/render/buggyNose";
import { BoxGeometry, Group, Mesh, SphereGeometry, MeshBasicMaterial, Vector3 } from "three";
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

  it("treats Skull as cosmetic but bumper EyeRed/Headlight as car parts", () => {
    expect(isBuggySkullCosmeticName("Skull")).toBe(true);
    expect(isBuggySkullCosmeticName("EyeRed")).toBe(false);
    expect(isBuggySkullCosmeticName("Headlight")).toBe(false);
  });

  it("perches Vogel on the BodyPaint bar nearest headlight height", () => {
    const root = new Group();
    const left = new Mesh(new SphereGeometry(0.08, 6, 6), new MeshBasicMaterial({ name: "Headlight" }));
    left.position.set(-1.3, 0.0, -0.21);
    const right = new Mesh(new SphereGeometry(0.08, 6, 6), new MeshBasicMaterial({ name: "Headlight" }));
    right.position.set(-1.3, 0.0, 0.21);
    // Between headlights (near lamp Y).
    const between = new Mesh(new BoxGeometry(0.05, 0.06, 0.7), new MeshBasicMaterial({ name: "BodyPaint" }));
    between.position.set(-1.305, -0.09, 0);
    // Lower skid lip — must not win.
    const lip = new Mesh(new BoxGeometry(0.07, 0.06, 0.7), new MeshBasicMaterial({ name: "BodyPaint" }));
    lip.position.set(-1.335, -0.22, 0);
    const cage = new Mesh(new BoxGeometry(0.2, 0.32, 0.8), new MeshBasicMaterial({ name: "Dark" }));
    cage.position.set(-1.18, 0.15, 0);
    root.add(left, right, between, lip, cage);
    root.updateMatrixWorld(true);
    const perch = bumperHeadlightPerchLocal(root);
    expect(perch.x).toBeCloseTo(-1.305, 1);
    expect(perch.z).toBeCloseTo(0, 1);
    expect(perch.y).toBeCloseTo(-0.06, 1);
    expect(perch.y).toBeGreaterThan(-0.12);
  });

  it("uses the same headlight bar perch for Hund as for Vogel", () => {
    const root = new Group();
    const left = new Mesh(new SphereGeometry(0.08, 6, 6), new MeshBasicMaterial({ name: "Headlight" }));
    left.position.set(-1.3, 0.0, -0.21);
    const right = new Mesh(new SphereGeometry(0.08, 6, 6), new MeshBasicMaterial({ name: "Headlight" }));
    right.position.set(-1.3, 0.0, 0.21);
    const between = new Mesh(new BoxGeometry(0.05, 0.06, 0.7), new MeshBasicMaterial({ name: "BodyPaint" }));
    between.position.set(-1.305, -0.09, 0);
    root.add(left, right, between);
    root.updateMatrixWorld(true);
    const perch = bumperHeadlightPerchLocal(root);
    // Hund must sit on this bar (not the skull anchor ~y 0.4).
    expect(perch.y).toBeLessThan(0.05);
    expect(perch.x).toBeLessThan(-1.2);
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
