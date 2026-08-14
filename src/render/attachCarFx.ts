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

  // Empty shell — Tripo lap-shield is the overhead round counter only.
  // On-car immunity keeps the procedural cyan bubble from comicCarMesh.
  const shield = new Group();
  shield.name = "fx-shield";
  return { smoke, sparks, nitro, shield };
}

/** Replace sphere placeholders with Tripo chunks when preloaded; otherwise keep spheres. */
export function upgradeCarFx(visual: ComicCarParts): void {
  if (visual.smoke.userData.tripoFx) return;
  if (!hasFxModels()) return;
  const rearZ = carMeshRearZ(visual.root);
  visual.root.userData.fxRearZ = rearZ;
  const fx = makeFxGroups(rearZ);
  clearGroup(visual.smoke);
  for (const child of [...fx.smoke.children]) visual.smoke.add(child);
  clearGroup(visual.sparks);
  for (const child of [...fx.sparks.children]) visual.sparks.add(child);
  clearGroup(visual.nitro);
  for (const child of [...fx.nitro.children]) visual.nitro.add(child);
  // Keep procedural fx-shield bubble — do not mount Tripo crest inside the cabin.
  visual.smoke.name = "fx-smoke";
  visual.sparks.name = "fx-sparks";
  visual.nitro.name = "fx-nitro";
  visual.shield.name = "fx-shield";
  visual.smoke.userData.tripoFx = true;
}

export function fxRearZOf(visual: ComicCarParts): number {
  const z = visual.root.userData.fxRearZ;
  return typeof z === "number" ? z : -1.7;
}
