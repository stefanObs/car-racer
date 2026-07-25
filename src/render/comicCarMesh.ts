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

/** Asphalt-Comic car — category silhouettes from car-category-targets.png. */
export function buildComicCar(car: CarState): ComicCarParts {
  const gear = carGearClass(car);
  switch (gear) {
    case "pickup":
      return buildPickupCar(car);
    case "buggy":
      return buildBuggyCar(car);
    case "hotrod":
      return buildHotRodCar(car);
    case "armor":
      return buildArmorCar(car);
    default:
      return buildSportCar(car);
  }
}

/** Blitz — low modern GT / coupe with wing + hood vents. */
function buildSportCar(car: CarState): ComicCarParts {
  const root = new Group();
  root.userData.gearClass = "sport";
  const paint = comicToon(car.paint);
  const paintShade = comicToon(shadePaint(car.paint));
  const dark = comicToon(ComicPalette.cabin);
  const glass = comicToon(0x12151c);

  root.add(groundBlob(1.35));

  const body = withOutline(new RoundedBoxGeometry(1.7, 0.38, 2.6, 5, 0.18), paint, 0.042);
  body.position.set(0, 0.48, 0.06);

  const belly = withOutline(new RoundedBoxGeometry(1.55, 0.26, 2.4, 5, 0.16), paintShade, 0.036);
  belly.position.set(0, 0.3, 0.04);

  const nose = withOutline(new SphereGeometry(0.52, 14, 12), paint, 0.038);
  nose.scale.set(1.45, 0.48, 1.15);
  nose.position.set(0, 0.44, 1.48);

  const haunch = withOutline(new SphereGeometry(0.7, 14, 12), paint, 0.038);
  haunch.scale.set(1.45, 0.55, 0.95);
  haunch.position.set(0, 0.48, -1.2);

  const cabin = withOutline(new SphereGeometry(0.68, 14, 12), glass, 0.04);
  cabin.scale.set(1.0, 0.68, 1.05);
  cabin.position.set(0, 0.88, -0.08);

  const roof = withOutline(new RoundedBoxGeometry(0.9, 0.07, 0.8, 3, 0.04), dark, 0.045);
  roof.position.set(0, 1.18, -0.1);

  // Hood vents (target sheet)
  for (const lx of [-0.28, 0.28] as const) {
    const vent = withOutline(new RoundedBoxGeometry(0.28, 0.06, 0.55, 2, 0.03), dark, 0.03);
    vent.position.set(lx, 0.68, 0.85);
    root.add(vent);
  }

  const wing = withOutline(new RoundedBoxGeometry(1.75, 0.08, 0.42, 3, 0.036), dark, 0.042);
  wing.position.set(0, 1.22, -1.28);
  const standL = withOutline(new CylinderGeometry(0.05, 0.06, 0.4, 8), dark, 0.04);
  standL.position.set(-0.58, 1.0, -1.18);
  const standR = withOutline(new CylinderGeometry(0.05, 0.06, 0.4, 8), dark, 0.04);
  standR.position.set(0.58, 1.0, -1.18);

  const diffuser = withOutline(new RoundedBoxGeometry(1.25, 0.16, 0.32, 2, 0.036), dark, 0.045);
  diffuser.position.set(0, 0.26, -1.55);
  addDualExhaust(root, 0.26, -1.72);
  addTailLights(root, 0.55, -1.52, 0.085);
  addHeadlights(root, 0.46, 1.82, 0.11);
  addWheels(root, { frontR: 0.34, rearR: 0.36, track: 0.8, zs: [0.95, -1.05] });

  const overlays = buildCarOverlays({
    paint: car.paint,
    sticker: car.sticker || "none",
    variant: `${car.modelId ?? car.id}-sport`,
    gearClass: "sport",
  });
  const fx = makeFxGroups(-1.75);
  root.add(body, belly, nose, haunch, cabin, roof, wing, standL, standR, diffuser, overlays, fx.smoke, fx.sparks, fx.nitro);
  return { root, body, ...fx };
}

/** Bison — crew-cab pickup with bed, bull bar, hood scoop. */
function buildPickupCar(car: CarState): ComicCarParts {
  const root = new Group();
  root.userData.gearClass = "pickup";
  const paint = comicToon(car.paint);
  const paintShade = comicToon(shadePaint(car.paint));
  const dark = comicToon(ComicPalette.cabin);
  const chrome = comicToon(0xc0c4cc);
  const glass = comicToon(0x1a2030);

  root.add(groundBlob(1.6));

  const body = withOutline(new RoundedBoxGeometry(1.9, 0.55, 3.0, 3, 0.1), paint, 0.042);
  body.position.set(0, 0.68, 0);

  const belly = withOutline(new RoundedBoxGeometry(1.8, 0.3, 2.85, 3, 0.08), paintShade, 0.036);
  belly.position.set(0, 0.42, 0);

  // Longer crew cab
  const cabin = withOutline(new RoundedBoxGeometry(1.75, 0.95, 1.45, 3, 0.1), paint, 0.042);
  cabin.position.set(0, 1.3, 0.55);

  const windshield = withOutline(new RoundedBoxGeometry(1.5, 0.58, 0.12, 2, 0.04), glass, 0.04);
  windshield.position.set(0, 1.35, 1.28);
  windshield.rotation.x = -0.22;

  const sideGlass = withOutline(new RoundedBoxGeometry(0.08, 0.45, 1.15, 2, 0.03), glass, 0.03);
  sideGlass.position.set(0.9, 1.35, 0.55);

  const roof = withOutline(new RoundedBoxGeometry(1.6, 0.12, 1.35, 2, 0.036), dark, 0.045);
  roof.position.set(0, 1.8, 0.5);

  const scoop = withOutline(new RoundedBoxGeometry(0.55, 0.14, 0.7, 2, 0.04), dark, 0.035);
  scoop.position.set(0, 1.0, 1.15);

  const bedFloor = withOutline(new RoundedBoxGeometry(1.7, 0.12, 1.25, 2, 0.036), paintShade, 0.045);
  bedFloor.position.set(0, 0.85, -1.15);
  const railL = withOutline(new RoundedBoxGeometry(0.1, 0.5, 1.2, 2, 0.04), dark, 0.04);
  railL.position.set(-0.82, 1.12, -1.15);
  const railR = withOutline(new RoundedBoxGeometry(0.1, 0.5, 1.2, 2, 0.04), dark, 0.04);
  railR.position.set(0.82, 1.12, -1.15);
  const tailgate = withOutline(new RoundedBoxGeometry(1.7, 0.45, 0.12, 2, 0.04), paint, 0.045);
  tailgate.position.set(0, 1.05, -1.75);

  const bull = withOutline(new RoundedBoxGeometry(1.75, 0.4, 0.25, 2, 0.04), dark, 0.036);
  bull.position.set(0, 0.6, 1.62);
  const bullBar = withOutline(new RoundedBoxGeometry(1.55, 0.08, 0.08, 1, 0.03), chrome, 0.03);
  bullBar.position.set(0, 0.82, 1.7);

  addDualExhaust(root, 0.35, -1.9);
  addTailLights(root, 0.75, -1.82, 0.1);
  addHeadlights(root, 0.7, 1.78, 0.13);
  addWheels(root, { frontR: 0.5, rearR: 0.52, track: 0.95, zs: [1.0, -1.2] });

  const overlays = buildCarOverlays({
    paint: car.paint,
    sticker: car.sticker || "none",
    variant: `${car.modelId ?? car.id}-pickup`,
    gearClass: "pickup",
  });
  const fx = makeFxGroups(-1.95);
  root.add(
    body,
    belly,
    cabin,
    windshield,
    sideGlass,
    roof,
    scoop,
    bedFloor,
    railL,
    railR,
    tailgate,
    bull,
    bullBar,
    overlays,
    fx.smoke,
    fx.sparks,
    fx.nitro,
  );
  return { root, body, ...fx };
}

/** Käferkraft — open dune buggy with roll cage + fat tires. */
function buildBuggyCar(car: CarState): ComicCarParts {
  const root = new Group();
  root.userData.gearClass = "buggy";
  const paint = comicToon(car.paint);
  const paintShade = comicToon(shadePaint(car.paint));
  const dark = comicToon(ComicPalette.cabin);
  const chrome = comicToon(0xa8adb6);

  root.add(groundBlob(1.4));

  // Tub / body
  const body = withOutline(new RoundedBoxGeometry(1.35, 0.45, 1.9, 3, 0.12), paint, 0.042);
  body.position.set(0, 0.55, 0.1);

  const nose = withOutline(new RoundedBoxGeometry(1.2, 0.35, 0.7, 3, 0.1), paintShade, 0.04);
  nose.position.set(0, 0.55, 1.15);

  const seat = withOutline(new RoundedBoxGeometry(0.7, 0.35, 0.55, 2, 0.06), dark, 0.035);
  seat.position.set(0, 0.85, 0.05);

  // Roll cage
  const cageMat = chrome;
  const hoop = withOutline(new TorusGeometry(0.75, 0.06, 8, 16, Math.PI), cageMat, 0.035);
  hoop.rotation.z = Math.PI / 2;
  hoop.rotation.y = Math.PI / 2;
  hoop.position.set(0, 1.35, -0.15);
  const barTop = withOutline(new CylinderGeometry(0.05, 0.05, 1.4, 8), cageMat, 0.03);
  barTop.rotation.z = Math.PI / 2;
  barTop.position.set(0, 1.75, -0.15);
  const barA = withOutline(new CylinderGeometry(0.045, 0.045, 1.1, 8), cageMat, 0.03);
  barA.position.set(-0.55, 1.15, 0.55);
  barA.rotation.x = 0.45;
  const barB = withOutline(new CylinderGeometry(0.045, 0.045, 1.1, 8), cageMat, 0.03);
  barB.position.set(0.55, 1.15, 0.55);
  barB.rotation.x = 0.45;
  const barRear = withOutline(new CylinderGeometry(0.05, 0.05, 1.0, 8), cageMat, 0.03);
  barRear.position.set(0, 1.2, -0.85);

  // Exposed rear engine
  const engine = withOutline(new RoundedBoxGeometry(0.7, 0.45, 0.55, 2, 0.06), dark, 0.04);
  engine.position.set(0, 0.75, -1.15);
  const intake = withOutline(new CylinderGeometry(0.12, 0.16, 0.35, 10), chrome, 0.03);
  intake.position.set(0, 1.1, -1.15);

  addHeadlights(root, 0.55, 1.45, 0.14);
  addWheels(root, { frontR: 0.48, rearR: 0.55, track: 0.85, zs: [0.85, -0.95] });

  const overlays = buildCarOverlays({
    paint: car.paint,
    sticker: car.sticker || "none",
    variant: `${car.modelId ?? car.id}-buggy`,
    gearClass: "buggy",
  });
  const fx = makeFxGroups(-1.45);
  root.add(body, nose, seat, hoop, barTop, barA, barB, barRear, engine, intake, overlays, fx.smoke, fx.sparks, fx.nitro);
  return { root, body, ...fx };
}

/** Donnerbüchse — classic hot rod, long hood, exposed V8, fat rears. */
function buildHotRodCar(car: CarState): ComicCarParts {
  const root = new Group();
  root.userData.gearClass = "hotrod";
  const paint = comicToon(car.paint);
  const paintShade = comicToon(shadePaint(car.paint));
  const dark = comicToon(ComicPalette.cabin);
  const chrome = comicToon(0xd0d4dc);
  const glass = comicToon(0x151820);

  root.add(groundBlob(1.45));

  // Long low body
  const body = withOutline(new RoundedBoxGeometry(1.55, 0.4, 2.85, 4, 0.14), paint, 0.042);
  body.position.set(0, 0.5, 0.05);

  const belly = withOutline(new RoundedBoxGeometry(1.4, 0.22, 2.6, 3, 0.1), paintShade, 0.036);
  belly.position.set(0, 0.32, 0);

  // Long hood
  const hood = withOutline(new RoundedBoxGeometry(1.35, 0.32, 1.35, 3, 0.1), paint, 0.04);
  hood.position.set(0, 0.72, 0.85);

  // Chopped cabin
  const cabin = withOutline(new RoundedBoxGeometry(1.25, 0.55, 0.85, 3, 0.08), paint, 0.04);
  cabin.position.set(0, 0.95, -0.55);
  const windshield = withOutline(new RoundedBoxGeometry(1.1, 0.4, 0.1, 2, 0.03), glass, 0.035);
  windshield.position.set(0, 1.05, -0.1);
  windshield.rotation.x = -0.35;
  const roof = withOutline(new RoundedBoxGeometry(1.1, 0.08, 0.7, 2, 0.03), dark, 0.04);
  roof.position.set(0, 1.28, -0.55);

  // Exposed V8
  const block = withOutline(new RoundedBoxGeometry(0.7, 0.55, 0.85, 2, 0.05), chrome, 0.04);
  block.position.set(0, 1.05, 0.55);
  const blower = withOutline(new CylinderGeometry(0.18, 0.22, 0.45, 10), chrome, 0.035);
  blower.position.set(0, 1.5, 0.55);
  for (const side of [-1, 1] as const) {
    const pipe = withOutline(new CylinderGeometry(0.07, 0.08, 0.9, 8), chrome, 0.03);
    pipe.rotation.z = side * 0.55;
    pipe.position.set(side * 0.55, 0.95, 0.35);
    root.add(pipe);
  }

  addDualExhaust(root, 0.35, -1.55);
  addTailLights(root, 0.55, -1.4, 0.08);
  addHeadlights(root, 0.55, 1.75, 0.12);
  addWheels(root, { frontR: 0.32, rearR: 0.52, track: 0.78, zs: [1.05, -1.05] });

  const overlays = buildCarOverlays({
    paint: car.paint,
    sticker: car.sticker || "none",
    variant: `${car.modelId ?? car.id}-hotrod`,
    gearClass: "hotrod",
  });
  const fx = makeFxGroups(-1.6);
  root.add(body, belly, hood, cabin, windshield, roof, block, blower, overlays, fx.smoke, fx.sparks, fx.nitro);
  return { root, body, ...fx };
}

/** Bunker — boxy armored truck with yellow stripe + slit windows. */
function buildArmorCar(car: CarState): ComicCarParts {
  const root = new Group();
  root.userData.gearClass = "armor";
  const paint = comicToon(car.paint);
  const paintShade = comicToon(shadePaint(car.paint));
  const dark = comicToon(ComicPalette.cabin);
  const glass = comicToon(0x0d1016);
  const stripe = comicToon(ComicPalette.repairSpark);

  root.add(groundBlob(1.7));

  const body = withOutline(new RoundedBoxGeometry(2.05, 1.15, 3.1, 2, 0.06), paint, 0.05);
  body.position.set(0, 1.0, 0);

  const belly = withOutline(new RoundedBoxGeometry(1.95, 0.35, 2.95, 2, 0.05), paintShade, 0.04);
  belly.position.set(0, 0.4, 0);

  const nose = withOutline(new RoundedBoxGeometry(1.9, 0.85, 0.55, 2, 0.05), paint, 0.045);
  nose.position.set(0, 0.9, 1.7);

  // Yellow side stripe (target sheet)
  for (const sx of [-1.05, 1.05] as const) {
    const band = withOutline(new RoundedBoxGeometry(0.08, 0.22, 2.6, 1, 0.02), stripe, 0.03);
    band.position.set(sx, 1.05, 0);
    root.add(band);
  }
  const frontBand = withOutline(new RoundedBoxGeometry(1.7, 0.2, 0.08, 1, 0.02), stripe, 0.03);
  frontBand.position.set(0, 1.05, 1.95);

  // Slit windows
  for (const [lx, z] of [
    [-0.45, 1.55],
    [0.45, 1.55],
    [-0.55, 0.4],
    [0.55, 0.4],
    [-0.55, -0.5],
    [0.55, -0.5],
  ] as const) {
    const slit = withOutline(new RoundedBoxGeometry(0.35, 0.16, 0.08, 1, 0.02), glass, 0.025);
    slit.position.set(lx, 1.35, z);
    root.add(slit);
  }

  const bumper = withOutline(new RoundedBoxGeometry(2.0, 0.35, 0.35, 2, 0.05), dark, 0.04);
  bumper.position.set(0, 0.45, 1.95);
  for (const hx of [-0.55, 0.55] as const) {
    const hook = withOutline(new TorusGeometry(0.12, 0.04, 6, 10), dark, 0.025);
    hook.position.set(hx, 0.35, 2.1);
    hook.rotation.y = Math.PI / 2;
    root.add(hook);
  }

  const roof = withOutline(new RoundedBoxGeometry(1.85, 0.12, 2.7, 2, 0.04), paintShade, 0.04);
  roof.position.set(0, 1.62, -0.05);

  addTailLights(root, 0.85, -1.55, 0.09);
  addHeadlights(root, 0.85, 1.95, 0.11);
  addWheels(root, { frontR: 0.48, rearR: 0.5, track: 1.0, zs: [1.05, -1.15] });

  const overlays = buildCarOverlays({
    paint: car.paint,
    sticker: car.sticker || "none",
    variant: `${car.modelId ?? car.id}-armor`,
    gearClass: "armor",
  });
  const fx = makeFxGroups(-1.7);
  root.add(body, belly, nose, frontBand, bumper, roof, overlays, fx.smoke, fx.sparks, fx.nitro);
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

function addWheels(
  root: Group,
  opts: { frontR: number; rearR: number; track: number; zs: readonly [number, number] },
): void {
  const placements: Array<{ wx: number; wz: number; r: number }> = [
    { wx: -opts.track, wz: opts.zs[0], r: opts.frontR },
    { wx: opts.track, wz: opts.zs[0], r: opts.frontR },
    { wx: -opts.track, wz: opts.zs[1], r: opts.rearR },
    { wx: opts.track, wz: opts.zs[1], r: opts.rearR },
  ];
  for (const { wx, wz, r } of placements) {
    const tire = withOutline(new TorusGeometry(r, r * 0.38, 10, 20), comicToon(ComicPalette.tire), 0.045);
    tire.rotation.y = Math.PI / 2;
    tire.position.set(wx, r, wz);
    const rim = new Mesh(new CylinderGeometry(r * 0.55, r * 0.55, 0.22, 12), comicToon(0xd8dce4));
    rim.rotation.z = Math.PI / 2;
    rim.position.set(wx, r, wz);
    root.add(tire, rim);
  }
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
