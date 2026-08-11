import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { getBounds } from "@gltf-transform/functions";
import { CAR_IDS, type CarId } from "../src/data/cars";
import { CAR_MODELS } from "../src/data/carModels";

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);

type Xz = { x: number; z: number };

function rotateY(v: Xz, yaw: number): Xz {
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  return { x: v.x * c + v.z * s, z: -v.x * s + v.z * c };
}

function yawedExtents(sx: number, sz: number, yaw: number): { sx: number; sz: number } {
  const c = Math.abs(Math.cos(yaw));
  const s = Math.abs(Math.sin(yaw));
  return { sx: sx * c + sz * s, sz: sx * s + sz * c };
}

/** Cabin is rear (taller opposite the nose) except pickup/armor where the cab is the front. */
function cabinIsRear(id: CarId): boolean {
  return id === "blitz" || id === "donnerbuechse" || id === "kaeferkraft";
}

async function meshNoseLocal(id: CarId): Promise<{ sx: number; sz: number; nose: Xz }> {
  const doc = await io.read(resolve(`public/models/cars/${id}.glb`));
  const b = getBounds(doc.getRoot().listScenes()[0]!);
  const sx = b.max[0]! - b.min[0]!;
  const sz = b.max[2]! - b.min[2]!;
  const midX = (b.min[0]! + b.max[0]!) / 2;
  const midZ = (b.min[2]! + b.max[2]!) / 2;
  let maxYNegX = -Infinity;
  let maxYPosX = -Infinity;
  let maxYNegZ = -Infinity;
  let maxYPosZ = -Infinity;
  for (const mesh of doc.getRoot().listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      const pos = prim.getAttribute("POSITION");
      if (!pos) continue;
      for (let i = 0; i < pos.getCount(); i++) {
        const v = pos.getElement(i, []);
        const y = v[1]!;
        if (v[0]! < midX) maxYNegX = Math.max(maxYNegX, y);
        else maxYPosX = Math.max(maxYPosX, y);
        if (v[2]! < midZ) maxYNegZ = Math.max(maxYNegZ, y);
        else maxYPosZ = Math.max(maxYPosZ, y);
      }
    }
  }
  const longOnX = sx > sz;
  const tallerPos = longOnX ? maxYPosX >= maxYNegX : maxYPosZ >= maxYNegZ;
  const noseTowardPos = cabinIsRear(id) ? !tallerPos : tallerPos;
  const nose: Xz = longOnX
    ? { x: noseTowardPos ? 1 : -1, z: 0 }
    : { x: 0, z: noseTowardPos ? 1 : -1 };
  return { sx, sz, nose };
}

describe("car meshes point nose-first in race heading", () => {
  it("after CAR_MODELS.yaw, longest drive axis is Z and heading follows the visual nose", async () => {
    const raceYaw = (heading: number, extraYaw: number) => Math.PI / 2 - heading + extraYaw;

    for (const id of CAR_IDS) {
      const { sx, sz, nose } = await meshNoseLocal(id);
      const yaw = CAR_MODELS[id].yaw;
      const driven = yawedExtents(sx, sz, yaw);
      expect(driven.sz, `${id} should not be sideways after yaw`).toBeGreaterThan(driven.sx);

      const visualNose = rotateY(nose, yaw);
      expect(visualNose.z, `${id} visual nose should be +Z after yaw`).toBeGreaterThan(0.85);
      expect(Math.abs(visualNose.x), `${id} visual nose should not stay on X`).toBeLessThan(0.35);

      for (const heading of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
        const worldNose = rotateY(nose, raceYaw(heading, yaw));
        const move: Xz = { x: Math.cos(heading), z: Math.sin(heading) };
        const alongNose = worldNose.x * move.x + worldNose.z * move.z;
        expect(alongNose, `${id} heading=${heading}`).toBeGreaterThan(0.85);
      }
    }
  });
});
