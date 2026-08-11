/**
 * Car visuals from preloaded GLBs (`public/models/cars/{id}.glb`).
 * Collision uses `CAR_MODELS.collisionRadius` (silhouette circle).
 */
import { CircleGeometry, Group, Mesh, MeshBasicMaterial, SphereGeometry } from "three";
import { CARS, type CarId, type GearClass } from "../data/cars";
import type { CarState } from "../sim/vehicle";
import { applyBlitzWheelScale, applyEquippedPartVisuals } from "./blitzParts";
import { mountCarWheels, type WheelMount } from "./carWheels";
import { comicToon } from "./comicMaterials";
import { cloneGltfCar, hasGltfCar } from "./loadCarGltf";
import { upgradeCarFx } from "./attachCarFx";
import { ComicPalette } from "./palette";

export type ComicCarParts = {
  root: Group;
  body: Mesh;
  smoke: Group;
  sparks: Group;
  nitro: Group;
  wheels: WheelMount[];
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
  applyEquippedPartVisuals(hull, id, parts);
  const wheels = mountCarWheels(gltf, id);
  applyBlitzWheelScale(gltf, id, parts);
  root.add(gltf);

  const body = new Mesh();
  body.visible = false;
  root.add(body);

  const fx = makeFxGroups(-1.7);
  root.add(groundBlob(1.4), fx.smoke, fx.sparks, fx.nitro);
  const visual = { root, body, ...fx, wheels, lastHeading: car.heading };
  upgradeCarFx(visual);
  return visual;
}

function groundBlob(radius: number): Mesh {
  const blob = new Mesh(
    new CircleGeometry(radius, 20),
    new MeshBasicMaterial({ color: 0x1b1b1f, transparent: true, opacity: 0.32 }),
  );
  blob.rotation.x = -Math.PI / 2;
  blob.position.y = 0.03;
  return blob;
}

function makeFxGroups(nitroZ: number): Pick<ComicCarParts, "smoke" | "sparks" | "nitro"> {
  const smoke = new Group();
  for (let i = 0; i < 6; i++) {
    const puff = new Mesh(new SphereGeometry(0.22 + i * 0.05, 10, 10), comicToon(ComicPalette.smoke));
    puff.visible = false;
    smoke.add(puff);
  }
  const sparks = new Group();
  for (let i = 0; i < 8; i++) {
    const spark = new Mesh(
      new SphereGeometry(0.07, 6, 6),
      comicToon(ComicPalette.repairSpark, { emissive: ComicPalette.repairSpark }),
    );
    spark.visible = false;
    sparks.add(spark);
  }
  const nitro = new Group();
  for (let i = 0; i < 5; i++) {
    const trail = new Mesh(
      new SphereGeometry(0.16, 8, 8),
      comicToon(i % 2 === 0 ? ComicPalette.nitroOrange : ComicPalette.nitroCyan, {
        emissive: i % 2 === 0 ? ComicPalette.nitroOrange : ComicPalette.nitroCyan,
        emissiveIntensity: 0.65,
      }),
    );
    trail.scale.set(1, 0.7, 1.6 + i * 0.2);
    trail.position.set((i - 2) * 0.12, 0.34, nitroZ - i * 0.28);
    trail.visible = false;
    nitro.add(trail);
  }
  return { smoke, sparks, nitro };
}
