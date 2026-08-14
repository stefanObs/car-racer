/**
 * Car visuals from preloaded GLBs (`public/models/cars/{id}.glb`).
 * Collision uses `CAR_MODELS.collisionRadius` (silhouette circle).
 */
import { CircleGeometry, Group, Mesh, MeshBasicMaterial } from "three";
import { CARS, type CarId, type GearClass } from "../data/cars";
import type { CarState } from "../sim/vehicle";
import { applyEquippedPartVisuals } from "./carParts";
import { carMeshRearZ, makeFxGroups, upgradeCarFx } from "./attachCarFx";
import { cloneGltfCar, hasGltfCar } from "./loadCarGltf";
import { hasFxModels } from "./loadFxGltf";

export type ComicCarParts = {
  root: Group;
  body: Mesh;
  smoke: Group;
  sparks: Group;
  nitro: Group;
  shield: Group;
  lastHeading: number;
};

export function carGearClass(car: CarState): GearClass {
  const id = (car.modelId ?? "blitz") as CarId;
  return CARS[id]?.gearClass ?? "sport";
}

export function buildComicCar(car: CarState): ComicCarParts {
  const id = (car.modelId ?? "blitz") as CarId;
  if (!hasGltfCar(id)) {
    throw new Error(`Car GLB not loaded: ${id}. Call preloadCarModels() before building cars.`);
  }
  if (!hasFxModels()) {
    throw new Error("FX GLBs not loaded. Call preloadFxModels() before building cars.");
  }
  return buildFromGltf(car, id);
}

function buildFromGltf(car: CarState, id: CarId): ComicCarParts {
  const root = new Group();
  const gear = CARS[id]?.gearClass ?? "sport";
  root.userData.gearClass = gear;
  root.userData.fromGltf = true;

  const parts = car.equippedParts ?? [];
  const gltf = cloneGltfCar(id, car.paint, car.sticker || "none")!;
  const hull = gltf.children[0] ?? gltf;
  applyEquippedPartVisuals(hull, id, parts, { paint: car.paint });
  root.add(gltf);

  const body = new Mesh();
  body.visible = false;
  root.add(body);

  const rearZ = carMeshRearZ(root);
  root.userData.fxRearZ = rearZ;
  const fx = makeFxGroups(rearZ);
  fx.smoke.userData.tripoFx = true;
  root.add(groundBlob(1.4), fx.smoke, fx.sparks, fx.nitro, fx.shield);
  const visual = { root, body, ...fx, lastHeading: car.heading };
  upgradeCarFx(visual);
  return visual;
}

function groundBlob(radius: number): Mesh {
  const blob = new Mesh(
    new CircleGeometry(radius, 20),
    new MeshBasicMaterial({ color: 0x1b1b1f, transparent: true, opacity: 0.32 }),
  );
  blob.name = "carGroundBlob";
  blob.rotation.x = -Math.PI / 2;
  blob.position.y = 0.03;
  return blob;
}
