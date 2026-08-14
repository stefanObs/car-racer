/**
 * Swap procedural sphere FX for shared Tripo comic chunks on every car visual.
 * Placement uses the car mesh rear (−Z), not a Blitz-only offset.
 */
import { Box3, Group, Object3D } from "three";
import type { ComicCarParts } from "./comicCarMesh";
import { cloneFxChunk, hasFxModels, NITRO_FLAME_FRAMES, type FxChunkId } from "./loadFxGltf";

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

/** Twin exhaust jets: each jet holds A/B Tripo flame frames for flicker. */
const NITRO_JET_LAYOUT: Array<{
  color: "orange" | "cyan";
  x: number;
  y: number;
  zOff: number;
  scale: number;
}> = [
  { color: "orange", x: -0.32, y: 0.22, zOff: 0.02, scale: 0.92 },
  { color: "cyan", x: 0.32, y: 0.22, zOff: 0.02, scale: 0.92 },
  { color: "orange", x: -0.22, y: 0.3, zOff: -0.42, scale: 1.05 },
  { color: "cyan", x: 0.22, y: 0.3, zOff: -0.42, scale: 1.05 },
];

const FRAME_IDS = NITRO_FLAME_FRAMES;

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
  for (const jet of NITRO_JET_LAYOUT) {
    const jetRoot = new Group();
    jetRoot.name = `fx-nitroJet-${jet.color}`;
    jetRoot.position.set(jet.x, jet.y, nitroZ + jet.zOff);
    jetRoot.scale.setScalar(jet.scale);
    jetRoot.userData.nitroBaseZ = jetRoot.position.z;
    jetRoot.userData.nitroBaseScale = jet.scale;
    jetRoot.userData.nitroJet = true;
    jetRoot.visible = false;

    const [idA, idB] = FRAME_IDS[jet.color];
    const frameA = cloneChunk(idA);
    const frameB = cloneChunk(idB);
    frameA.name = `fx-${idA}`;
    frameB.name = `fx-${idB}`;
    frameA.userData.nitroFrame = 0;
    frameB.userData.nitroFrame = 1;
    frameA.visible = true;
    frameB.visible = false;
    jetRoot.add(frameA, frameB);
    nitro.add(jetRoot);
  }

  // Empty — no on-car shield mesh (Tripo plaque is overhead round flash only).
  const shield = new Group();
  shield.name = "fx-shield";
  shield.visible = false;
  return { smoke, sparks, nitro, shield };
}

function placeNitroJets(nitro: Group, rearZ: number): void {
  nitro.children.forEach((trail, i) => {
    const jet = NITRO_JET_LAYOUT[i];
    if (!jet) return;
    trail.position.set(jet.x, jet.y, rearZ + jet.zOff);
    trail.userData.nitroBaseZ = trail.position.z;
  });
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
    placeNitroJets(visual.nitro, rearZ);
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
