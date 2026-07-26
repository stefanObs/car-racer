/**
 * Car visuals: prefer imported GLB (public/models/cars/{id}.glb) when preloaded.
 * Procedural meshes remain as fallback. Collision uses CAR_MODELS.collisionRadius
 * (silhouette circle — need not match the visual mesh exactly).
 */
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
import { cloneGltfCar, hasGltfCar } from "./loadCarGltf";
import { ComicPalette } from "./palette";

export type ComicCarParts = {
  root: Group;
  body: Mesh;
  smoke: Group;
  sparks: Group;
  nitro: Group;
};

export function carGearClass(car: CarState): GearClass {
  const id = (car.modelId ?? "blitz") as CarId;
  return CARS[id]?.gearClass ?? "sport";
}

export function buildComicCar(car: CarState): ComicCarParts {
  const id = (car.modelId ?? "blitz") as CarId;
  if (hasGltfCar(id)) return buildFromGltf(car, id);
  switch (carGearClass(car)) {
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

function buildFromGltf(car: CarState, id: CarId): ComicCarParts {
  const root = new Group();
  const gear = CARS[id]?.gearClass ?? "sport";
  root.userData.gearClass = gear;
  root.userData.fromGltf = true;

  const gltf = cloneGltfCar(id, car.paint)!;
  root.add(gltf);

  const body = new Mesh();
  body.visible = false;
  root.add(body);

  const stickers = buildCarOverlays({
    paint: car.paint,
    sticker: car.sticker || "none",
    variant: `${id}-gltf`,
    gearClass: gear,
    mode: "stickers-only",
  });
  stickers.scale.setScalar(0.95);
  root.add(stickers);

  const fx = makeFxGroups(-1.7);
  root.add(groundBlob(1.4), fx.smoke, fx.sparks, fx.nitro);
  return { root, body, ...fx };
}

type Mats = {
  paint: ReturnType<typeof comicToon>;
  shade: ReturnType<typeof comicToon>;
  dark: ReturnType<typeof comicToon>;
  glass: ReturnType<typeof comicToon>;
  chrome: ReturnType<typeof comicToon>;
  rim: ReturnType<typeof comicToon>;
};

function mats(paintHex: string): Mats {
  return {
    paint: comicToon(paintHex),
    shade: comicToon(shadePaint(paintHex)),
    dark: comicToon(ComicPalette.cabin),
    glass: comicToon(0x10141c),
    chrome: comicToon(0xc8ccd4),
    rim: comicToon(0x2a2e34),
  };
}

/** Blitz — low modern coupe: wedge nose, hood vent, high wing, slit lamps. */
function buildSportCar(car: CarState): ComicCarParts {
  const root = new Group();
  root.userData.gearClass = "sport";
  const m = mats(car.paint);
  root.add(groundBlob(1.4));

  // Main wedge body (harder edges than spheres)
  const body = withOutline(new RoundedBoxGeometry(1.85, 0.42, 2.7, 2, 0.08), m.paint, 0.05);
  body.position.set(0, 0.52, 0.05);
  const under = withOutline(new RoundedBoxGeometry(1.7, 0.22, 2.5, 2, 0.06), m.shade, 0.04);
  under.position.set(0, 0.28, 0.02);

  // Pointed low nose + front fascia (target sheet 3/4 front)
  const nose = withOutline(new RoundedBoxGeometry(1.65, 0.32, 0.95, 2, 0.06), m.paint, 0.048);
  nose.position.set(0, 0.45, 1.6);
  const grille = withOutline(new RoundedBoxGeometry(1.35, 0.22, 0.12, 1, 0.02), m.dark, 0.04);
  grille.position.set(0, 0.38, 2.05);
  const splitter = withOutline(new RoundedBoxGeometry(1.55, 0.08, 0.4, 1, 0.02), m.dark, 0.04);
  splitter.position.set(0, 0.22, 2.0);

  // Cabin set back
  const cabin = withOutline(new RoundedBoxGeometry(1.45, 0.55, 1.15, 2, 0.06), m.glass, 0.045);
  cabin.position.set(0, 0.95, -0.15);
  const roof = withOutline(new RoundedBoxGeometry(1.25, 0.08, 0.95, 2, 0.03), m.dark, 0.04);
  roof.position.set(0, 1.28, -0.2);
  const aPillarL = withOutline(new RoundedBoxGeometry(0.08, 0.5, 0.55, 1, 0.02), m.dark, 0.03);
  aPillarL.position.set(-0.7, 0.95, 0.35);
  aPillarL.rotation.x = -0.55;
  const aPillarR = withOutline(new RoundedBoxGeometry(0.08, 0.5, 0.55, 1, 0.02), m.dark, 0.03);
  aPillarR.position.set(0.7, 0.95, 0.35);
  aPillarR.rotation.x = -0.55;

  // Wide rear haunches
  const haunchL = withOutline(new RoundedBoxGeometry(0.35, 0.45, 1.0, 2, 0.06), m.paint, 0.04);
  haunchL.position.set(-0.95, 0.55, -0.85);
  const haunchR = withOutline(new RoundedBoxGeometry(0.35, 0.45, 1.0, 2, 0.06), m.paint, 0.04);
  haunchR.position.set(0.95, 0.55, -0.85);

  // Black center hood vent
  const hoodVent = withOutline(new RoundedBoxGeometry(0.55, 0.1, 0.95, 2, 0.03), m.dark, 0.035);
  hoodVent.position.set(0, 0.76, 0.75);
  for (const lx of [-0.12, 0, 0.12] as const) {
    const slit = withOutline(new RoundedBoxGeometry(0.06, 0.04, 0.7, 1, 0.01), m.shade, 0.02);
    slit.position.set(lx, 0.82, 0.75);
    root.add(slit);
  }

  // Large black rear wing
  const wing = withOutline(new RoundedBoxGeometry(1.95, 0.1, 0.5, 2, 0.04), m.dark, 0.05);
  wing.position.set(0, 1.35, -1.35);
  const endL = withOutline(new RoundedBoxGeometry(0.08, 0.35, 0.45, 1, 0.02), m.dark, 0.04);
  endL.position.set(-0.95, 1.25, -1.35);
  const endR = withOutline(new RoundedBoxGeometry(0.08, 0.35, 0.45, 1, 0.02), m.dark, 0.04);
  endR.position.set(0.95, 1.25, -1.35);
  const standL = withOutline(new CylinderGeometry(0.05, 0.06, 0.55, 8), m.dark, 0.035);
  standL.position.set(-0.55, 1.05, -1.2);
  const standR = withOutline(new CylinderGeometry(0.05, 0.06, 0.55, 8), m.dark, 0.035);
  standR.position.set(0.55, 1.05, -1.2);

  const diffuser = withOutline(new RoundedBoxGeometry(1.4, 0.2, 0.4, 1, 0.03), m.dark, 0.04);
  diffuser.position.set(0, 0.28, -1.55);

  addSlitHeadlights(root, 0.5, 2.08, 0.58, 0.11);
  addTailLightBar(root, 0.55, -1.55);
  addDualExhaust(root, 0.28, -1.75);
  addWheels(root, {
    frontR: 0.36,
    rearR: 0.38,
    track: 0.88,
    zs: [1.05, -1.1],
    rim: m.rim,
    spokes: true,
  });

  const overlays = buildCarOverlays({
    paint: car.paint,
    sticker: car.sticker || "none",
    variant: `${car.modelId ?? car.id}-sport`,
    gearClass: "sport",
  });
  overlays.scale.setScalar(0.92);
  const fx = makeFxGroups(-1.8);
  root.add(
    body,
    under,
    nose,
    grille,
    splitter,
    cabin,
    roof,
    aPillarL,
    aPillarR,
    haunchL,
    haunchR,
    hoodVent,
    wing,
    endL,
    endR,
    standL,
    standR,
    diffuser,
    overlays,
    fx.smoke,
    fx.sparks,
    fx.nitro,
  );
  return { root, body, ...fx };
}

/** Bison — tall crew-cab pickup, bull bar, scoop, bed, side steps. */
function buildPickupCar(car: CarState): ComicCarParts {
  const root = new Group();
  root.userData.gearClass = "pickup";
  const m = mats(car.paint);
  root.add(groundBlob(1.7));

  // High chassis — same paint as cab so the truck reads green, not dark
  const chassis = withOutline(new RoundedBoxGeometry(1.95, 0.4, 3.2, 2, 0.05), m.paint, 0.045);
  chassis.position.set(0, 0.55, 0);
  const belly = withOutline(new RoundedBoxGeometry(1.85, 0.22, 3.0, 2, 0.04), m.shade, 0.04);
  belly.position.set(0, 0.32, 0);

  // Crew cab (4-door look)
  const cab = withOutline(new RoundedBoxGeometry(1.9, 1.05, 1.55, 2, 0.06), m.paint, 0.05);
  cab.position.set(0, 1.25, 0.55);
  const cabGlass = comicToon(0x2b6cb0);
  const windshield = withOutline(new RoundedBoxGeometry(1.65, 0.65, 0.1, 1, 0.03), cabGlass, 0.04);
  windshield.position.set(0, 1.4, 1.32);
  windshield.rotation.x = -0.18;
  const roof = withOutline(new RoundedBoxGeometry(1.75, 0.12, 1.45, 1, 0.03), m.dark, 0.04);
  roof.position.set(0, 1.82, 0.5);
  // Window frames / B-pillar
  for (const z of [0.95, 0.25] as const) {
    const pillar = withOutline(new RoundedBoxGeometry(0.08, 0.7, 0.08, 1, 0.02), m.dark, 0.03);
    pillar.position.set(0.95, 1.4, z);
    root.add(pillar);
    const pillarL = withOutline(new RoundedBoxGeometry(0.08, 0.7, 0.08, 1, 0.02), m.dark, 0.03);
    pillarL.position.set(-0.95, 1.4, z);
    root.add(pillarL);
  }
  const sideWin = withOutline(new RoundedBoxGeometry(0.06, 0.45, 1.2, 1, 0.02), cabGlass, 0.03);
  sideWin.position.set(0.98, 1.4, 0.55);

  // Hood + scoop
  const hood = withOutline(new RoundedBoxGeometry(1.75, 0.28, 0.95, 2, 0.05), m.paint, 0.045);
  hood.position.set(0, 0.95, 1.55);
  const scoop = withOutline(new RoundedBoxGeometry(0.65, 0.2, 0.7, 2, 0.04), m.dark, 0.04);
  scoop.position.set(0, 1.15, 1.45);

  // Open bed
  const bedFloor = withOutline(new RoundedBoxGeometry(1.75, 0.12, 1.35, 1, 0.03), m.shade, 0.04);
  bedFloor.position.set(0, 0.85, -1.2);
  const railL = withOutline(new RoundedBoxGeometry(0.12, 0.55, 1.3, 1, 0.03), m.dark, 0.04);
  railL.position.set(-0.88, 1.15, -1.2);
  const railR = withOutline(new RoundedBoxGeometry(0.12, 0.55, 1.3, 1, 0.03), m.dark, 0.04);
  railR.position.set(0.88, 1.15, -1.2);
  const tailgate = withOutline(new RoundedBoxGeometry(1.75, 0.5, 0.12, 1, 0.03), m.paint, 0.045);
  tailgate.position.set(0, 1.1, -1.85);

  // Black bull / brush bar
  const bullFrame = withOutline(new RoundedBoxGeometry(1.85, 0.55, 0.12, 1, 0.03), m.dark, 0.04);
  bullFrame.position.set(0, 0.7, 2.05);
  for (const y of [0.55, 0.75, 0.95] as const) {
    const bar = withOutline(new CylinderGeometry(0.04, 0.04, 1.7, 8), m.dark, 0.025);
    bar.rotation.z = Math.PI / 2;
    bar.position.set(0, y, 2.12);
    root.add(bar);
  }
  for (const x of [-0.75, 0, 0.75] as const) {
    const post = withOutline(new CylinderGeometry(0.045, 0.045, 0.55, 8), m.dark, 0.025);
    post.position.set(x, 0.7, 2.12);
    root.add(post);
  }

  // Side steps
  for (const sx of [-1.0, 1.0] as const) {
    const step = withOutline(new RoundedBoxGeometry(0.2, 0.08, 1.4, 1, 0.02), m.dark, 0.03);
    step.position.set(sx, 0.35, 0.4);
    root.add(step);
  }

  addRoundHeadlights(root, 0.85, 2.0, 0.14);
  addTailLightBar(root, 0.95, -1.9);
  addDualExhaust(root, 0.4, -2.0);
  addWheels(root, {
    frontR: 0.55,
    rearR: 0.58,
    track: 1.0,
    zs: [1.15, -1.25],
    rim: m.rim,
    spokes: true,
    knobby: true,
  });

  const overlays = buildCarOverlays({
    paint: car.paint,
    sticker: car.sticker || "none",
    variant: `${car.modelId ?? car.id}-pickup`,
    gearClass: "pickup",
  });
  const fx = makeFxGroups(-2.05);
  root.add(
    chassis,
    belly,
    cab,
    windshield,
    roof,
    sideWin,
    hood,
    scoop,
    bedFloor,
    railL,
    railR,
    tailgate,
    bullFrame,
    overlays,
    fx.smoke,
    fx.sparks,
    fx.nitro,
  );
  return { root, body: cab, ...fx };
}

/** Käferkraft — open cage buggy, orange panels, yellow coil springs. */
function buildBuggyCar(car: CarState): ComicCarParts {
  const root = new Group();
  root.userData.gearClass = "buggy";
  const m = mats(car.paint);
  const spring = comicToon(0xffe066);
  root.add(groundBlob(1.5));

  // Floor pan
  const floor = withOutline(new RoundedBoxGeometry(1.25, 0.12, 2.0, 2, 0.04), m.dark, 0.04);
  floor.position.set(0, 0.35, 0.05);

  // Orange body panels (shells only)
  const nose = withOutline(new RoundedBoxGeometry(1.15, 0.45, 0.7, 2, 0.06), m.paint, 0.045);
  nose.position.set(0, 0.6, 1.15);
  const sideL = withOutline(new RoundedBoxGeometry(0.12, 0.5, 1.4, 1, 0.03), m.paint, 0.04);
  sideL.position.set(-0.7, 0.65, 0.1);
  const sideR = withOutline(new RoundedBoxGeometry(0.12, 0.5, 1.4, 1, 0.03), m.paint, 0.04);
  sideR.position.set(0.7, 0.65, 0.1);
  const rearPanel = withOutline(new RoundedBoxGeometry(1.2, 0.4, 0.35, 2, 0.05), m.paint, 0.04);
  rearPanel.position.set(0, 0.6, -1.0);

  // Bucket seats
  for (const sx of [-0.28, 0.28] as const) {
    const seat = withOutline(new RoundedBoxGeometry(0.4, 0.45, 0.45, 2, 0.05), m.dark, 0.035);
    seat.position.set(sx, 0.7, 0.15);
    const back = withOutline(new RoundedBoxGeometry(0.4, 0.55, 0.12, 1, 0.03), m.dark, 0.03);
    back.position.set(sx, 1.05, -0.05);
    root.add(seat, back);
  }

  // Tubular roll cage — same paint as body panels
  const tube = (r: number, h: number, x: number, y: number, z: number, rx = 0, rz = 0) => {
    const c = withOutline(new CylinderGeometry(r, r, h, 8), m.paint, 0.03);
    c.position.set(x, y, z);
    c.rotation.x = rx;
    c.rotation.z = rz;
    root.add(c);
  };
  // Main hoop
  tube(0.06, 1.4, -0.55, 1.2, -0.2, 0, 0);
  tube(0.06, 1.4, 0.55, 1.2, -0.2, 0, 0);
  tube(0.055, 1.2, 0, 1.85, -0.2, 0, Math.PI / 2);
  // Forward bars
  tube(0.05, 1.35, -0.5, 1.15, 0.55, 0.65, 0);
  tube(0.05, 1.35, 0.5, 1.15, 0.55, 0.65, 0);
  tube(0.05, 1.0, 0, 1.55, 0.7, 0, Math.PI / 2);
  // Rear bars
  tube(0.055, 1.1, -0.45, 1.1, -0.9, -0.35, 0);
  tube(0.055, 1.1, 0.45, 1.1, -0.9, -0.35, 0);
  tube(0.05, 0.95, 0, 1.55, -0.9, 0, Math.PI / 2);

  // Exposed rear engine
  const engine = withOutline(new RoundedBoxGeometry(0.75, 0.5, 0.6, 2, 0.05), m.dark, 0.04);
  engine.position.set(0, 0.75, -1.25);
  const intake = withOutline(new CylinderGeometry(0.14, 0.18, 0.4, 10), m.chrome, 0.03);
  intake.position.set(0, 1.15, -1.25);

  // Yellow coil springs (signature from target)
  for (const [wx, wz] of [
    [-0.75, 0.9],
    [0.75, 0.9],
    [-0.75, -0.85],
    [0.75, -0.85],
  ] as const) {
    addCoilSpring(root, wx, 0.55, wz, spring);
  }

  addRoundHeadlights(root, 0.65, 1.45, 0.16);
  addWheels(root, {
    frontR: 0.52,
    rearR: 0.58,
    track: 0.9,
    zs: [1.0, -1.0],
    rim: m.rim,
    spokes: true,
    knobby: true,
  });

  const overlays = buildCarOverlays({
    paint: car.paint,
    sticker: car.sticker || "none",
    variant: `${car.modelId ?? car.id}-buggy`,
    gearClass: "buggy",
  });
  overlays.scale.setScalar(0.85);
  const fx = makeFxGroups(-1.5);
  root.add(floor, nose, sideL, sideR, rearPanel, engine, intake, overlays, fx.smoke, fx.sparks, fx.nitro);
  return { root, body: nose, ...fx };
}

/** Donnerbüchse — chopped hot rod, huge blower, triple side pipes, fat rears. */
function buildHotRodCar(car: CarState): ComicCarParts {
  const root = new Group();
  root.userData.gearClass = "hotrod";
  const m = mats(car.paint);
  root.add(groundBlob(1.55));

  // Long low body
  const body = withOutline(new RoundedBoxGeometry(1.6, 0.38, 3.0, 2, 0.08), m.paint, 0.05);
  body.position.set(0, 0.48, 0);
  const under = withOutline(new RoundedBoxGeometry(1.45, 0.18, 2.8, 2, 0.05), m.shade, 0.04);
  under.position.set(0, 0.28, 0);

  // Long hood deck
  const hood = withOutline(new RoundedBoxGeometry(1.4, 0.22, 1.5, 2, 0.05), m.paint, 0.045);
  hood.position.set(0, 0.7, 0.85);

  // Chopped cabin (short / low roof at rear) — must read behind the blower
  const cabin = withOutline(new RoundedBoxGeometry(1.4, 0.65, 1.05, 2, 0.05), m.paint, 0.048);
  cabin.position.set(0, 0.95, -0.85);
  const glass = withOutline(new RoundedBoxGeometry(1.2, 0.45, 0.1, 1, 0.02), m.glass, 0.035);
  glass.position.set(0, 1.1, -0.3);
  glass.rotation.x = -0.35;
  const roof = withOutline(new RoundedBoxGeometry(1.25, 0.1, 0.85, 1, 0.02), m.dark, 0.04);
  roof.position.set(0, 1.32, -0.85);
  const trunk = withOutline(new RoundedBoxGeometry(1.4, 0.35, 0.6, 2, 0.05), m.paint, 0.04);
  trunk.position.set(0, 0.7, -1.55);

  // Massive exposed V8 + triple blower stacks
  const block = withOutline(new RoundedBoxGeometry(0.85, 0.7, 1.0, 2, 0.05), m.chrome, 0.05);
  block.position.set(0, 1.05, 0.45);
  for (const lz of [-0.22, 0, 0.22] as const) {
    const stack = withOutline(new CylinderGeometry(0.1, 0.12, 0.55, 10), m.chrome, 0.035);
    stack.position.set(0, 1.55, 0.45 + lz);
    root.add(stack);
    const lip = withOutline(new TorusGeometry(0.12, 0.03, 6, 12), m.chrome, 0.025);
    lip.rotation.x = Math.PI / 2;
    lip.position.set(0, 1.82, 0.45 + lz);
    root.add(lip);
  }
  // Valve covers
  for (const sx of [-0.4, 0.4] as const) {
    const cover = withOutline(new RoundedBoxGeometry(0.22, 0.25, 0.85, 1, 0.03), m.chrome, 0.03);
    cover.position.set(sx, 1.15, 0.45);
    root.add(cover);
  }

  // Triple chrome side-exit exhausts each side
  for (const side of [-1, 1] as const) {
    for (let i = 0; i < 3; i++) {
      const pipe = withOutline(new CylinderGeometry(0.06, 0.07, 0.85, 8), m.chrome, 0.03);
      pipe.rotation.z = side * (0.85 + i * 0.08);
      pipe.rotation.x = 0.15;
      pipe.position.set(side * 0.7, 0.75 - i * 0.05, 0.15 - i * 0.12);
      root.add(pipe);
      const tip = withOutline(new CylinderGeometry(0.08, 0.07, 0.12, 8), m.chrome, 0.025);
      tip.rotation.z = side * 0.9;
      tip.position.set(side * 1.05, 0.45 - i * 0.08, -0.15 - i * 0.1);
      root.add(tip);
    }
  }

  addRoundHeadlights(root, 0.55, 1.85, 0.13);
  addTailLightBar(root, 0.55, -1.65);
  addWheels(root, {
    frontR: 0.32,
    rearR: 0.58,
    track: 0.82,
    zs: [1.15, -1.15],
    rim: m.rim,
    spokes: true,
  });

  const overlays = buildCarOverlays({
    paint: car.paint,
    sticker: car.sticker || "none",
    variant: `${car.modelId ?? car.id}-hotrod`,
    gearClass: "hotrod",
  });
  const fx = makeFxGroups(-1.7);
  root.add(body, under, hood, cabin, glass, roof, trunk, block, overlays, fx.smoke, fx.sparks, fx.nitro);
  return { root, body, ...fx };
}

/** Bunker — boxy APC, yellow stripe, slit windows, heavy grille. */
function buildArmorCar(car: CarState): ComicCarParts {
  const root = new Group();
  root.userData.gearClass = "armor";
  const m = mats(car.paint);
  const yellow = comicToon(ComicPalette.repairSpark);
  root.add(groundBlob(1.85));

  // Tall armored hull
  const hull = withOutline(new RoundedBoxGeometry(2.2, 1.35, 3.3, 1, 0.04), m.paint, 0.055);
  hull.position.set(0, 1.1, 0);
  const under = withOutline(new RoundedBoxGeometry(2.05, 0.35, 3.15, 1, 0.04), m.shade, 0.045);
  under.position.set(0, 0.38, 0);

  // Blunt nose / grille
  const nose = withOutline(new RoundedBoxGeometry(2.0, 1.0, 0.55, 1, 0.04), m.paint, 0.05);
  nose.position.set(0, 0.95, 1.8);
  for (let i = 0; i < 5; i++) {
    const grill = withOutline(new RoundedBoxGeometry(1.5, 0.08, 0.06, 1, 0.015), m.dark, 0.02);
    grill.position.set(0, 0.55 + i * 0.14, 2.08);
    root.add(grill);
  }

  // Thick yellow stripe (wrap)
  for (const sx of [-1.12, 1.12] as const) {
    const band = withOutline(new RoundedBoxGeometry(0.1, 0.28, 2.9, 1, 0.02), yellow, 0.035);
    band.position.set(sx, 1.15, 0);
    root.add(band);
  }
  const frontBand = withOutline(new RoundedBoxGeometry(1.9, 0.28, 0.1, 1, 0.02), yellow, 0.035);
  frontBand.position.set(0, 1.15, 2.05);
  const rearBand = withOutline(new RoundedBoxGeometry(1.9, 0.28, 0.1, 1, 0.02), yellow, 0.035);
  rearBand.position.set(0, 1.15, -1.6);

  // Slit windows
  const slits: Array<[number, number, number]> = [
    [-0.55, 1.55, 1.55],
    [0.55, 1.55, 1.55],
    [-0.7, 1.55, 0.5],
    [0.7, 1.55, 0.5],
    [-0.7, 1.55, -0.4],
    [0.7, 1.55, -0.4],
    [-0.55, 1.55, -1.25],
    [0.55, 1.55, -1.25],
  ];
  for (const [x, y, z] of slits) {
    const slit = withOutline(new RoundedBoxGeometry(0.4, 0.14, 0.08, 1, 0.015), m.glass, 0.025);
    slit.position.set(x, y, z);
    root.add(slit);
  }

  // Rivet hints
  for (const z of [-1.2, -0.4, 0.4, 1.2] as const) {
    for (const y of [0.7, 1.4] as const) {
      const rivet = withOutline(new SphereGeometry(0.05, 6, 6), m.dark, 0.02);
      rivet.position.set(1.12, y, z);
      root.add(rivet);
    }
  }

  // Heavy bumper + hooks
  const bumper = withOutline(new RoundedBoxGeometry(2.15, 0.4, 0.4, 1, 0.04), m.dark, 0.045);
  bumper.position.set(0, 0.45, 2.05);
  for (const hx of [-0.6, 0.6] as const) {
    const hook = withOutline(new TorusGeometry(0.14, 0.045, 6, 12), m.dark, 0.025);
    hook.rotation.y = Math.PI / 2;
    hook.position.set(hx, 0.35, 2.25);
    root.add(hook);
  }

  // Aux lights on roof front
  for (const lx of [-0.45, 0, 0.45] as const) {
    const lamp = withOutline(
      new CylinderGeometry(0.1, 0.1, 0.12, 10),
      comicToon(0xfff6d8, { emissive: 0xffe066, emissiveIntensity: 0.45 }),
      0.025,
    );
    lamp.rotation.x = Math.PI / 2;
    lamp.position.set(lx, 1.8, 1.7);
    root.add(lamp);
  }

  const roof = withOutline(new RoundedBoxGeometry(2.0, 0.12, 2.9, 1, 0.03), m.shade, 0.04);
  roof.position.set(0, 1.82, -0.05);

  addRoundHeadlights(root, 0.9, 2.05, 0.12);
  addTailLightBar(root, 0.95, -1.65);
  addWheels(root, {
    frontR: 0.52,
    rearR: 0.54,
    track: 1.08,
    zs: [1.15, -1.2],
    rim: m.rim,
    spokes: true,
    knobby: true,
  });

  const overlays = buildCarOverlays({
    paint: car.paint,
    sticker: car.sticker || "none",
    variant: `${car.modelId ?? car.id}-armor`,
    gearClass: "armor",
  });
  overlays.scale.setScalar(0.9);
  const fx = makeFxGroups(-1.75);
  root.add(hull, under, nose, frontBand, rearBand, bumper, roof, overlays, fx.smoke, fx.sparks, fx.nitro);
  return { root, body: hull, ...fx };
}

function addCoilSpring(root: Group, x: number, y: number, z: number, mat: ReturnType<typeof comicToon>): void {
  for (let i = 0; i < 5; i++) {
    const ring = withOutline(new TorusGeometry(0.12, 0.035, 6, 12), mat, 0.02);
    ring.rotation.x = Math.PI / 2;
    ring.position.set(x, y + i * 0.1, z);
    root.add(ring);
  }
  const rod = withOutline(new CylinderGeometry(0.03, 0.03, 0.55, 6), comicToon(0x868e96), 0.02);
  rod.position.set(x, y + 0.2, z);
  root.add(rod);
}

function addSlitHeadlights(root: Group, y: number, z: number, halfW: number, h: number): void {
  const mat = comicToon(0xfff6d8, { emissive: 0xffe066, emissiveIntensity: 0.55 });
  for (const side of [-1, 1] as const) {
    const lamp = withOutline(new RoundedBoxGeometry(0.45, h, 0.1, 1, 0.02), mat, 0.03);
    lamp.position.set(side * halfW, y, z);
    root.add(lamp);
  }
}

function addRoundHeadlights(root: Group, y: number, z: number, r: number): void {
  const mat = comicToon(0xfff6d8, { emissive: 0xffe066, emissiveIntensity: 0.5 });
  for (const lx of [-0.55, 0.55] as const) {
    const head = withOutline(new SphereGeometry(r, 12, 12), mat, 0.03);
    head.scale.set(1, 1, 0.55);
    head.position.set(lx, y, z);
    root.add(head);
  }
}

function addTailLightBar(root: Group, y: number, z: number): void {
  const mat = comicToon(0xff2a2a, { emissive: 0xff2a2a, emissiveIntensity: 0.65 });
  for (const lx of [-0.65, -0.35, 0.35, 0.65] as const) {
    const light = withOutline(new RoundedBoxGeometry(0.2, 0.14, 0.08, 1, 0.02), mat, 0.025);
    light.position.set(lx, y, z);
    root.add(light);
  }
}

function addDualExhaust(root: Group, y: number, z: number): void {
  for (const lx of [-0.25, 0.25] as const) {
    const ex = withOutline(new CylinderGeometry(0.09, 0.1, 0.22, 10), comicToon(0x9aa0a6), 0.03);
    ex.rotation.x = Math.PI / 2;
    ex.position.set(lx, y, z);
    root.add(ex);
  }
}

function addWheels(
  root: Group,
  opts: {
    frontR: number;
    rearR: number;
    track: number;
    zs: readonly [number, number];
    rim: ReturnType<typeof comicToon>;
    spokes?: boolean;
    knobby?: boolean;
  },
): void {
  const placements = [
    { wx: -opts.track, wz: opts.zs[0], r: opts.frontR },
    { wx: opts.track, wz: opts.zs[0], r: opts.frontR },
    { wx: -opts.track, wz: opts.zs[1], r: opts.rearR },
    { wx: opts.track, wz: opts.zs[1], r: opts.rearR },
  ];
  for (const { wx, wz, r } of placements) {
    const tire = withOutline(
      new TorusGeometry(r, r * (opts.knobby ? 0.42 : 0.34), 10, 22),
      comicToon(ComicPalette.tire),
      0.05,
    );
    tire.rotation.y = Math.PI / 2;
    tire.position.set(wx, r, wz);
    root.add(tire);

    const hub = withOutline(new CylinderGeometry(r * 0.42, r * 0.42, 0.18, 12), opts.rim, 0.03);
    hub.rotation.z = Math.PI / 2;
    hub.position.set(wx, r, wz);
    root.add(hub);

    if (opts.spokes) {
      for (let i = 0; i < 5; i++) {
        const ang = (i / 5) * Math.PI;
        const spoke = withOutline(new RoundedBoxGeometry(0.07, r * 0.7, 0.08, 1, 0.01), opts.rim, 0.02);
        spoke.position.set(wx, r, wz);
        // Lie in the wheel face (YZ plane for side-facing tire)
        spoke.rotation.z = ang;
        spoke.rotation.y = Math.PI / 2;
        root.add(spoke);
      }
      const cap = withOutline(new CylinderGeometry(r * 0.18, r * 0.18, 0.22, 10), comicToon(0xd8dce4), 0.025);
      cap.rotation.z = Math.PI / 2;
      cap.position.set(wx, r, wz);
      root.add(cap);
    }

    if (opts.knobby) {
      for (let i = 0; i < 6; i++) {
        const ang = (i / 6) * Math.PI * 2;
        const knob = withOutline(new SphereGeometry(r * 0.1, 6, 6), comicToon(ComicPalette.tire), 0.02);
        knob.position.set(wx + Math.cos(ang) * 0.02, r + Math.sin(ang) * r * 0.85, wz + Math.cos(ang + 1) * r * 0.15);
        root.add(knob);
      }
    }
  }
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
