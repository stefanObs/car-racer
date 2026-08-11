import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buggyNoseFromSticker,
  bumperHeadlightPerchLocal,
  DOG_HEAD_CONTACT_X,
  DOG_HEAD_CONTACT_Y,
  DOG_HEAD_SCALE,
  DOG_HEAD_YAW,
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

  it("treats Skull and SkullHorn as cosmetic but bumper EyeRed/Headlight as car parts", () => {
    expect(isBuggySkullCosmeticName("Skull")).toBe(true);
    expect(isBuggySkullCosmeticName("SkullHorn")).toBe(true);
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

  it("keeps the dog head at baked bumper-ornament size", () => {
    expect(DOG_HEAD_SCALE).toBe(1);
  });

  it("uses bake yaw so the snout already aims at buggy forward (−X)", () => {
    expect(DOG_HEAD_YAW).toBe(0);
  });

  it("seats the dog neck on the headlight bar without floating", () => {
    expect(DOG_HEAD_CONTACT_X).toBeLessThanOrEqual(0);
    expect(DOG_HEAD_CONTACT_Y).toBeLessThanOrEqual(0);
    expect(Math.abs(DOG_HEAD_CONTACT_Y * DOG_HEAD_SCALE)).toBeLessThan(0.02);
  });

  it("keeps dog authored UVs + GLB albedo (no planar face atlas)", () => {
    // RCA lock: planar XY + buggy-dog-head.png stretched the mesh look.
    const src = readFileSync(resolve("src/render/buggyNose.ts"), "utf8");
    expect(src).not.toMatch(/ensureDogFaceUvs/);
    expect(src).not.toMatch(/dogStatue/);
    expect(src).toMatch(/std\.map/);
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
