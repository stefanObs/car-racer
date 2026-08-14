/**
 * Swap procedural sphere FX for shared Tripo comic chunks on every car visual.
 * Placement uses the car mesh rear (−Z), not a Blitz-only offset.
 */
import { Box3, Group, Object3D } from "three";
import type { ComicCarParts } from "./comicCarMesh";
import { cloneFxChunk, hasFxModels, type FxChunkId } from "./loadFxGltf";

export function carMeshRearZ(root: Object3D): number {
  const car = root.children.find((c) => c.name.startsWith("gltf-")) ?? root;
  car.updateMatrixWorld(true);
  const box = new Box3().setFromObject(car);
  if (!Number.isFinite(box.min.z)) return -1.7;
  return box.min.z;
}

function clearGroup(group: Group): void {
  while (group.children.length) group.remove(group.children[0]!);
}

/** Shared comic FX for every car. `cloneChunk` is injectable for unit tests. */
export function makeFxGroups(
  nitroZ: number,
  cloneChunk: (id: FxChunkId) => Object3D = cloneFxChunk,
): { smoke: Group; sparks: Group; nitro: Group; shield: Group } {
  const smoke = new Group();
  smoke.name = "fx-smoke";
  const puffIds: FxChunkId[] = ["smokePuff", "smokePuff", "smokeHeavy", "smokeHeavy"];
  for (const id of puffIds) {
    const puff = cloneChunk(id);
    puff.visible = false;
    smoke.add(puff);
  }

  const sparks = new Group();
  sparks.name = "fx-sparks";
  for (let i = 0; i < 8; i++) {
    const spark = cloneChunk("repairSpark");
    spark.visible = false;
    sparks.add(spark);
  }

  const nitro = new Group();
  nitro.name = "fx-nitro";
  for (let i = 0; i < 5; i++) {
    const id: FxChunkId = i % 2 === 0 ? "nitroOrange" : "nitroCyan";
    const trail = cloneChunk(id);
    trail.position.set((i - 2) * 0.12, 0.34, nitroZ - 0.2 - i * 0.28);
    trail.visible = false;
    nitro.add(trail);
  }

  // Empty — no on-car shield mesh (Tripo plaque is overhead round flash only).
  const shield = new Group();
  shield.name = "fx-shield";
  shield.visible = false;
  return { smoke, sparks, nitro, shield };
}

/** Ensure Tripo FX chunks are mounted (smoke / sparks / nitro). Strips any on-car shield mesh. */
export function upgradeCarFx(visual: ComicCarParts): void {
  // Always strip on-car shield meshes (immunity has no chassis mesh).
  clearGroup(visual.shield);
  visual.shield.visible = false;
  visual.shield.name = "fx-shield";

  if (!hasFxModels()) return;
  const rearZ = carMeshRearZ(visual.root);
  visual.root.userData.fxRearZ = rearZ;
  if (visual.smoke.userData.tripoFx) {
    // Already Tripo — refresh nitro sit to current hull rear.
    visual.nitro.children.forEach((trail, i) => {
      trail.position.set((i - 2) * 0.12, 0.34, rearZ - 0.2 - i * 0.28);
    });
    return;
  }
  const fx = makeFxGroups(rearZ);
  clearGroup(visual.smoke);
  for (const child of [...fx.smoke.children]) visual.smoke.add(child);
  clearGroup(visual.sparks);
  for (const child of [...fx.sparks.children]) visual.sparks.add(child);
  clearGroup(visual.nitro);
  for (const child of [...fx.nitro.children]) visual.nitro.add(child);
  visual.smoke.name = "fx-smoke";
  visual.sparks.name = "fx-sparks";
  visual.nitro.name = "fx-nitro";
  visual.smoke.userData.tripoFx = true;
}

export function fxRearZOf(visual: ComicCarParts): number {
  const z = visual.root.userData.fxRearZ;
  return typeof z === "number" ? z : -1.7;
}
