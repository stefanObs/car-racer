import {
  CircleGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  SphereGeometry,
  TorusGeometry,
} from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { CARS, type CarId, type GearClass } from "../data/cars";
import type { CarState } from "../sim/vehicle";
import { buildCarOverlays } from "./carOverlays";
import { comicToon, withOutline } from "./comicMaterials";
import { ComicPalette } from "./palette";

export type ComicCarParts = {
  root: Group;
  body: Mesh;
  smoke: Group;
  sparks: Group;
  nitro: Group;
};

/** Resolve silhouette class from car state (player modelId or AI carId). */
export function carGearClass(car: CarState): GearClass {
  const id = (car.modelId ?? "blitz") as CarId;
  return CARS[id]?.gearClass ?? "sport";
}

/** Asphalt-Comic car — distinct silhouettes per gear class (CONCEPT §5). */
export function buildComicCar(car: CarState): ComicCarParts {
  const gear = carGearClass(car);
  return gear === "pickup" ? buildPickupCar(car) : buildSportCar(car);
}

function buildSportCar(car: CarState): ComicCarParts {
  const root = new Group();
  root.userData.gearClass = "sport";
  const paint = comicToon(car.paint);
  const paintShade = comicToon(shadePaint(car.paint));
  const dark = comicToon(ComicPalette.cabin);
  const glass = comicToon(0x12151c);

  root.add(groundBlob(1.35));

  const body = withOutline(new RoundedBoxGeometry(1.65, 0.42, 2.55, 5, 0.2), paint, 0.065);
  body.position.set(0, 0.52, 0.08);

  const belly = withOutline(new RoundedBoxGeometry(1.55, 0.28, 2.35, 5, 0.18), paintShade, 0.05);
  belly.position.set(0, 0.34, 0.05);

  const nose = withOutline(new SphereGeometry(0.55, 14, 12), paint, 0.055);
  nose.scale.set(1.35, 0.55, 1.1);
  nose.position.set(0, 0.48, 1.45);

  const tail = withOutline(new SphereGeometry(0.62, 14, 12), paint, 0.055);
  tail.scale.set(1.4, 0.58, 0.9);
  tail.position.set(0, 0.5, -1.25);

  const cabin = withOutline(new SphereGeometry(0.72, 14, 12), glass, 0.06);
  cabin.scale.set(1.05, 0.72, 1.15);
  cabin.position.set(0, 0.95, -0.05);

  const roof = withOutline(new RoundedBoxGeometry(0.95, 0.08, 0.85, 3, 0.06), dark, 0.045);
  roof.position.set(0, 1.28, -0.08);

  const wing = withOutline(new RoundedBoxGeometry(1.7, 0.09, 0.4, 3, 0.05), dark, 0.07);
  wing.position.set(0, 1.28, -1.22);
  const standL = withOutline(new CylinderGeometry(0.05, 0.06, 0.42, 8), dark, 0.04);
  standL.position.set(-0.58, 1.05, -1.12);
  const standR = withOutline(new CylinderGeometry(0.05, 0.06, 0.42, 8), dark, 0.04);
  standR.position.set(0.58, 1.05, -1.12);

  const diffuser = withOutline(new RoundedBoxGeometry(1.2, 0.18, 0.35, 2, 0.05), dark, 0.045);
  diffuser.position.set(0, 0.28, -1.55);
  addDualExhaust(root, 0.28, -1.72);
  addTailLights(root, 0.58, -1.5, 0.09);
  addHeadlights(root, 0.5, 1.78, 0.12);
  addWheels(root, 0.36, 0.78, [0.92, -1.02]);

  const overlays = buildCarOverlays({
    paint: car.paint,
    sticker: car.sticker || "none",
    variant: `${car.modelId ?? car.id}-sport`,
  });
  const fx = makeFxGroups();
  root.add(body, belly, nose, tail, cabin, roof, wing, standL, standR, diffuser, overlays, fx.smoke, fx.sparks, fx.nitro);
  return { root, body, ...fx };
}

/** Boxy pick-up: tall cab, open bed, bull bar, big tires — readable vs sport. */
function buildPickupCar(car: CarState): ComicCarParts {
  const root = new Group();
  root.userData.gearClass = "pickup";
  const paint = comicToon(car.paint);
  const paintShade = comicToon(shadePaint(car.paint));
  const dark = comicToon(ComicPalette.cabin);
  const chrome = comicToon(0xc0c4cc);
  const glass = comicToon(0x1a2030);

  root.add(groundBlob(1.55));

  // Chassis / lower body — longer, taller, flatter
  const body = withOutline(new RoundedBoxGeometry(1.85, 0.55, 2.9, 3, 0.12), paint, 0.07);
  body.position.set(0, 0.62, 0);

  const belly = withOutline(new RoundedBoxGeometry(1.75, 0.32, 2.7, 3, 0.1), paintShade, 0.05);
  belly.position.set(0, 0.38, 0);

  // Tall forward cabin (pickup cab)
  const cabin = withOutline(new RoundedBoxGeometry(1.7, 0.85, 1.15, 3, 0.1), paint, 0.065);
  cabin.position.set(0, 1.2, 0.55);

  const windshield = withOutline(new RoundedBoxGeometry(1.45, 0.55, 0.12, 2, 0.04), glass, 0.04);
  windshield.position.set(0, 1.25, 1.12);
  windshield.rotation.x = -0.25;

  const roof = withOutline(new RoundedBoxGeometry(1.55, 0.12, 1.05, 2, 0.05), dark, 0.045);
  roof.position.set(0, 1.65, 0.5);

  // Open cargo bed
  const bedFloor = withOutline(new RoundedBoxGeometry(1.65, 0.12, 1.35, 2, 0.05), paintShade, 0.045);
  bedFloor.position.set(0, 0.78, -1.05);
  const railL = withOutline(new RoundedBoxGeometry(0.1, 0.45, 1.3, 2, 0.04), dark, 0.04);
  railL.position.set(-0.8, 1.05, -1.05);
  const railR = withOutline(new RoundedBoxGeometry(0.1, 0.45, 1.3, 2, 0.04), dark, 0.04);
  railR.position.set(0.8, 1.05, -1.05);
  const tailgate = withOutline(new RoundedBoxGeometry(1.65, 0.4, 0.12, 2, 0.04), paint, 0.045);
  tailgate.position.set(0, 0.98, -1.7);

  // Roll bar over bed
  const roll = withOutline(new RoundedBoxGeometry(1.5, 0.1, 0.1, 2, 0.03), chrome, 0.04);
  roll.position.set(0, 1.55, -0.15);
  const postL = withOutline(new CylinderGeometry(0.05, 0.05, 0.7, 8), chrome, 0.03);
  postL.position.set(-0.65, 1.2, -0.15);
  const postR = withOutline(new CylinderGeometry(0.05, 0.05, 0.7, 8), chrome, 0.03);
  postR.position.set(0.65, 1.2, -0.15);

  // Bull bar
  const bull = withOutline(new RoundedBoxGeometry(1.7, 0.35, 0.22, 2, 0.06), chrome, 0.05);
  bull.position.set(0, 0.55, 1.55);
  const bullBar = withOutline(new RoundedBoxGeometry(1.55, 0.08, 0.08, 1, 0.03), dark, 0.03);
  bullBar.position.set(0, 0.72, 1.62);

  addDualExhaust(root, 0.32, -1.85);
  addTailLights(root, 0.7, -1.78, 0.11);
  addHeadlights(root, 0.62, 1.72, 0.14);
  // Bigger tires, higher stance
  addWheels(root, 0.48, 0.92, [0.95, -1.15]);

  const overlays = buildCarOverlays({
    paint: car.paint,
    sticker: car.sticker || "none",
    variant: `${car.modelId ?? car.id}-pickup`,
  });
  overlays.position.y = 0.15;
  overlays.scale.set(1.05, 1.15, 1.08);

  const fx = makeFxGroups();
  fx.nitro.position.z = -0.15;
  root.add(
    body,
    belly,
    cabin,
    windshield,
    roof,
    bedFloor,
    railL,
    railR,
    tailgate,
    roll,
    postL,
    postR,
    bull,
    bullBar,
    overlays,
    fx.smoke,
    fx.sparks,
    fx.nitro,
  );
  return { root, body, ...fx };
}

function groundBlob(radius: number): Mesh {
  const blob = new Mesh(
    new CircleGeometry(radius, 20),
    new MeshBasicMaterial({ color: 0x1b1b1f, transparent: true, opacity: 0.35 }),
  );
  blob.rotation.x = -Math.PI / 2;
  blob.position.y = 0.03;
  return blob;
}

function addDualExhaust(root: Group, y: number, z: number): void {
  const exGeo = new CylinderGeometry(0.09, 0.1, 0.2, 10);
  for (const lx of [-0.22, 0.22] as const) {
    const ex = withOutline(exGeo.clone(), comicToon(0x9aa0a6), 0.035);
    ex.rotation.x = Math.PI / 2;
    ex.position.set(lx, y, z);
    root.add(ex);
  }
}

function addTailLights(root: Group, y: number, z: number, r: number): void {
  const lightMat = comicToon(0xff2a2a, { emissive: 0xff2a2a, emissiveIntensity: 0.6 });
  for (const lx of [-0.55, -0.35, 0.35, 0.55] as const) {
    const light = withOutline(new SphereGeometry(r, 12, 12), lightMat, 0.03);
    light.position.set(lx, y, z);
    root.add(light);
  }
}

function addHeadlights(root: Group, y: number, z: number, r: number): void {
  const headMat = comicToon(0xfff6d8, { emissive: 0xffe066, emissiveIntensity: 0.4 });
  for (const lx of [-0.55, 0.55] as const) {
    const head = withOutline(new SphereGeometry(r, 12, 12), headMat, 0.03);
    head.position.set(lx, y, z);
    root.add(head);
  }
}

function addWheels(root: Group, tireR: number, trackHalf: number, zs: readonly [number, number]): void {
  for (const [wx, wz] of [
    [-trackHalf, zs[0]],
    [trackHalf, zs[0]],
    [-trackHalf, zs[1]],
    [trackHalf, zs[1]],
  ] as const) {
    const tire = withOutline(new TorusGeometry(tireR, tireR * 0.38, 10, 20), comicToon(ComicPalette.tire), 0.045);
    tire.rotation.y = Math.PI / 2;
    tire.position.set(wx, tireR, wz);
    const rim = new Mesh(new CylinderGeometry(tireR * 0.55, tireR * 0.55, 0.2, 12), comicToon(0xd8dce4));
    rim.rotation.z = Math.PI / 2;
    rim.position.set(wx, tireR, wz);
    root.add(tire, rim);
  }
}

function makeFxGroups(): Pick<ComicCarParts, "smoke" | "sparks" | "nitro"> {
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
    trail.position.set((i - 2) * 0.12, 0.34, -1.8 - i * 0.28);
    trail.visible = false;
    nitro.add(trail);
  }
  return { smoke, sparks, nitro };
}

function shadePaint(paint: string): number {
  try {
    const c = Number.parseInt(paint.replace("#", ""), 16);
    if (!Number.isFinite(c)) return 0x7a1f1f;
    const r = Math.max(0, ((c >> 16) & 255) - 45);
    const g = Math.max(0, ((c >> 8) & 255) - 45);
    const b = Math.max(0, (c & 255) - 45);
    return (r << 16) | (g << 8) | b;
  } catch {
    return 0x7a1f1f;
  }
}
