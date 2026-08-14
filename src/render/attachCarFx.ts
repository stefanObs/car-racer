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
  // Twin exhaust jets: pipe stubs sit at the bumper, flames stream −Z.
  const jets: Array<{ id: FxChunkId; x: number; y: number; zOff: number; scale: number }> = [
    { id: "nitroOrange", x: -0.32, y: 0.22, zOff: 0.02, scale: 0.92 },
    { id: "nitroCyan", x: 0.32, y: 0.22, zOff: 0.02, scale: 0.92 },
    { id: "nitroOrange", x: -0.22, y: 0.3, zOff: -0.42, scale: 1.05 },
    { id: "nitroCyan", x: 0.22, y: 0.3, zOff: -0.42, scale: 1.05 },
  ];
  for (const jet of jets) {
    const trail = cloneChunk(jet.id);
    trail.position.set(jet.x, jet.y, nitroZ + jet.zOff);
    trail.scale.setScalar(jet.scale);
    trail.userData.nitroBaseZ = trail.position.z;
    trail.userData.nitroBaseScale = jet.scale;
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
    // Already Tripo — refresh nitro sit to current hull rear (twin exhaust).
    const jets = [
      { x: -0.32, y: 0.22, zOff: 0.02 },
      { x: 0.32, y: 0.22, zOff: 0.02 },
      { x: -0.22, y: 0.3, zOff: -0.42 },
      { x: 0.22, y: 0.3, zOff: -0.42 },
    ];
    visual.nitro.children.forEach((trail, i) => {
      const jet = jets[i];
      if (!jet) return;
      trail.position.set(jet.x, jet.y, rearZ + jet.zOff);
      trail.userData.nitroBaseZ = trail.position.z;
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
