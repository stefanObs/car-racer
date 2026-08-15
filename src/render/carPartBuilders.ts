/**
 * Asphalt-Comic procedural Teil meshes (parts-look targets).
 * Per-class shapes — used on every car except Blitz Tripo GLBs when preferred.
 */
import {
  BoxGeometry,
  ConeGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  type Object3D,
  Vector3,
} from "three";
import { comicToon } from "./comicMaterials";
import { ComicPalette } from "./palette";

const CARBON = 0x2a2d33;
const CHROME = 0xc5ccd4;
const GREY = 0x6a7078;
const SILVER = 0xb8bec6;
const CALIPER_RED = 0xe03131;
const CALIPER_YELLOW = 0xffe066;
const SPRING_RED = 0xe03131;
const SPRING_YELLOW = 0xffe066;
const SPRING_CYAN = 0x3db9c7;
const NITRO_CYAN = ComicPalette.nitroCyan;
const NITRO_ORANGE = ComicPalette.nitroOrange;

function box(w: number, h: number, d: number, color: number, name: string): Mesh {
  const m = new Mesh(new BoxGeometry(w, h, d), comicToon(color));
  m.name = name;
  return m;
}

function cyl(
  rTop: number,
  rBot: number,
  h: number,
  color: number,
  name: string,
  radial = 10,
): Mesh {
  const m = new Mesh(new CylinderGeometry(rTop, rBot, h, radial), comicToon(color));
  m.name = name;
  return m;
}

function cone(r: number, h: number, color: number, name: string): Mesh {
  const m = new Mesh(new ConeGeometry(r, h, 8), comicToon(color));
  m.name = name;
  return m;
}

/** Hood scoop — intakes face local +Z (caller yaws for mesh authoring). */
export function buildHoodScoop(kind: "triple" | "block" | "blower" = "triple"): Group {
  const g = new Group();
  g.name = "proc-big_engine";
  if (kind === "block") {
    const body = box(0.55, 0.22, 0.62, CARBON, "ScoopBody");
    body.position.y = 0.11;
    g.add(body);
    const mouth = box(0.42, 0.12, 0.08, 0x111114, "ScoopMouth");
    mouth.position.set(0, 0.11, 0.34);
    g.add(mouth);
    return g;
  }
  if (kind === "blower") {
    const base = box(0.48, 0.14, 0.55, CHROME, "BlowerBase");
    base.position.y = 0.07;
    g.add(base);
    for (const x of [-0.14, 0, 0.14]) {
      const pipe = cyl(0.075, 0.075, 0.26, CHROME, "BlowerPipe", 8);
      pipe.rotation.x = Math.PI / 2;
      pipe.position.set(x, 0.24, 0.06);
      g.add(pipe);
      const lip = cyl(0.095, 0.095, 0.045, 0x1b1b1f, "BlowerLip", 8);
      lip.rotation.x = Math.PI / 2;
      lip.position.set(x, 0.24, 0.2);
      g.add(lip);
    }
    // Side exhaust headers (Donner look sheet).
    for (const side of [-1, 1] as const) {
      for (let i = 0; i < 4; i++) {
        const pipe = cyl(0.035, 0.04, 0.32, CHROME, "Header", 6);
        pipe.rotation.z = side * (Math.PI / 2.4);
        pipe.position.set(side * 0.28, 0.08 + i * 0.04, -0.05 + i * 0.02);
        g.add(pipe);
      }
    }
    return g;
  }
  // triple circular intakes (Blitz look)
  const body = box(0.62, 0.22, 0.78, CARBON, "ScoopBody");
  body.position.set(0, 0.12, -0.05);
  g.add(body);
  for (const x of [-0.18, 0, 0.18]) {
    const pipe = cyl(0.08, 0.08, 0.28, CARBON, "ScoopPipe", 8);
    pipe.rotation.x = Math.PI / 2;
    pipe.position.set(x, 0.14, 0.28);
    g.add(pipe);
    const mouth = cyl(0.095, 0.095, 0.04, 0x111114, "ScoopMouth", 8);
    mouth.rotation.x = Math.PI / 2;
    mouth.position.set(x, 0.14, 0.42);
    g.add(mouth);
  }
  return g;
}

/** Mid/rear exposed engine stack (Käferkraft look — sits behind seats). */
export function buildRearEngineBlock(): Group {
  const g = new Group();
  g.name = "proc-big_engine";
  const block = box(0.72, 0.48, 0.58, CARBON, "EngineBlock");
  block.position.y = 0.24;
  g.add(block);
  const fin = box(0.74, 0.08, 0.5, GREY, "CoolingFin");
  fin.position.y = 0.5;
  g.add(fin);
  for (let i = 0; i < 3; i++) {
    const tip = cyl(0.055, 0.065, 0.32, CHROME, "ExhaustTip", 8);
    tip.rotation.z = Math.PI / 2;
    tip.position.set(0.48, 0.16 + i * 0.13, -0.02 + i * 0.02);
    g.add(tip);
  }
  return g;
}

/** Spiked front bumper bar. */
export function buildSpikeBumper(spikeCount = 5, width = 1.2): Group {
  const g = new Group();
  g.name = "proc-spike_bumper";
  const bar = box(width, 0.18, 0.2, CARBON, "SpikeBar");
  bar.position.y = 0.09;
  g.add(bar);
  const span = width * 0.78;
  for (let i = 0; i < spikeCount; i++) {
    const t = spikeCount === 1 ? 0.5 : i / (spikeCount - 1);
    const x = -span / 2 + t * span;
    const spike = cone(0.075, 0.36, CHROME, "Spike");
    spike.rotation.x = Math.PI / 2;
    spike.position.set(x, 0.1, 0.26);
    g.add(spike);
  }
  return g;
}

/** Single caliper + disc (place near a wheel hub, look-sheet style). */
export function buildBrakeUnit(caliperColor: number = CALIPER_RED): Group {
  const g = new Group();
  g.name = "proc-better_brakes";
  const disc = cyl(0.28, 0.28, 0.04, CHROME, "BrakeDisc", 14);
  disc.rotation.z = Math.PI / 2;
  g.add(disc);
  const cal = box(0.12, 0.22, 0.28, caliperColor, "Caliper");
  cal.position.set(0.16, 0.04, 0);
  g.add(cal);
  const piston = box(0.06, 0.1, 0.12, CHROME, "CaliperPiston");
  piston.position.set(0.14, 0.04, 0);
  g.add(piston);
  return g;
}

function addStraightPole(
  parent: Group,
  a: readonly [number, number, number],
  b: readonly [number, number, number],
  radius: number,
  color: number,
  name: string,
): void {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const dz = b[2] - a[2];
  const len = Math.hypot(dx, dy, dz);
  const mesh = cyl(radius, radius, len, color, name, 8);
  mesh.position.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
  mesh.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), new Vector3(dx, dy, dz).normalize());
  parent.add(mesh);
}

type PoleEnd = readonly [number, number, number];

/** Push both endpoints along the segment so they pierce the stock cage joints. */
function extendPoleEnds(a: PoleEnd, b: PoleEnd, extra: number): [PoleEnd, PoleEnd] {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const dz = b[2] - a[2];
  const len = Math.hypot(dx, dy, dz);
  const s = extra / len;
  return [
    [a[0] - dx * s, a[1] - dy * s, a[2] - dz * s],
    [b[0] + dx * s, b[1] + dy * s, b[2] + dz * s],
  ];
}

/** Sill plates + rear half-cage / hoop — class-specific silhouettes. */
export function buildReinforcedFrame(
  style: "sport" | "pickup" | "buggy" | "hotrod" | "armor" = "sport",
): Group {
  const g = new Group();
  g.name = "proc-reinforced_frame";
  if (style === "buggy") {
    // Same spec as scripts/bake-kaeferkraft-pole-frame.mjs (stock cage r ≈ 0.025).
    const r = 0.025;
    const into = 0.08;
    const sideZ = 0.43;
    const waistZ = 0.7;
    const waistY = 1.14;
    for (const side of [-1, 1] as const) {
      const z = sideZ * side;
      addStraightPole(
        g,
        ...extendPoleEnds([-0.48, waistY, waistZ * side], [0.5, waistY, waistZ * side], into),
        r,
        GREY,
        "Waist",
      );
      addStraightPole(g, ...extendPoleEnds([0.48, 1.54, z], [-0.5, 0.8, z], into), r, GREY, "XRearToDash");
      addStraightPole(
        g,
        ...extendPoleEnds([0.48, 1.54, z], [1.36, 0.7, Math.sign(z) * 0.36], into),
        r,
        GREY,
        "RearStay",
      );
    }
    return g;
  }
  if (style === "pickup") {
    // Bed roll bar behind cab (Bison look sheet).
    for (const side of [-1, 1] as const) {
      const upright = cyl(0.05, 0.05, 1.05, CARBON, "BedUpright", 6);
      upright.position.set(side * 0.55, 0.7, 0.15);
      g.add(upright);
      const lean = cyl(0.045, 0.045, 0.85, CARBON, "BedLean", 6);
      lean.rotation.x = -0.65;
      lean.position.set(side * 0.55, 0.85, -0.35);
      g.add(lean);
    }
    const top = cyl(0.045, 0.045, 1.15, CARBON, "BedTop", 6);
    top.rotation.z = Math.PI / 2;
    top.position.set(0, 1.2, 0.15);
    g.add(top);
    const mid = cyl(0.04, 0.04, 1.15, CARBON, "BedMid", 6);
    mid.rotation.z = Math.PI / 2;
    mid.position.set(0, 0.95, -0.25);
    g.add(mid);
    return g;
  }
  if (style === "armor") {
    for (const x of [-0.72, 0.72]) {
      const pillar = cyl(0.05, 0.05, 1.55, CARBON, "ArmorPillar", 6);
      pillar.position.set(x, 0.95, 0.15);
      g.add(pillar);
      const rear = cyl(0.05, 0.05, 1.35, CARBON, "ArmorRear", 6);
      rear.position.set(x, 0.9, -0.85);
      g.add(rear);
    }
    const roof = cyl(0.045, 0.045, 1.55, CARBON, "ArmorRoof", 6);
    roof.rotation.z = Math.PI / 2;
    roof.position.set(0, 1.7, -0.15);
    g.add(roof);
    const aPillarL = cyl(0.045, 0.045, 1.1, CARBON, "ArmorA", 6);
    aPillarL.rotation.x = 0.35;
    aPillarL.position.set(-0.7, 1.15, 0.75);
    g.add(aPillarL);
    const aPillarR = aPillarL.clone();
    aPillarR.position.x = 0.7;
    g.add(aPillarR);
    return g;
  }
  if (style === "hotrod") {
    // Perforated silver side rails + rear hoop (Donner look sheet).
    for (const x of [-0.95, 0.95]) {
      const sill = box(0.12, 0.22, 1.85, SILVER, "HotrodSill");
      sill.position.set(x, 0.22, -0.05);
      g.add(sill);
      for (let i = 0; i < 5; i++) {
        const hole = cyl(0.055, 0.055, 0.14, 0x111114, "SillHole", 8);
        hole.rotation.z = Math.PI / 2;
        hole.position.set(x, 0.22, 0.55 - i * 0.28);
        g.add(hole);
      }
    }
    const hoopL = cyl(0.045, 0.045, 0.95, SILVER, "HoopL", 6);
    hoopL.position.set(-0.55, 0.75, -0.55);
    g.add(hoopL);
    const hoopR = cyl(0.045, 0.045, 0.95, SILVER, "HoopR", 6);
    hoopR.position.set(0.55, 0.75, -0.55);
    g.add(hoopR);
    const hoopTop = cyl(0.045, 0.045, 1.15, SILVER, "HoopTop", 6);
    hoopTop.rotation.z = Math.PI / 2;
    hoopTop.position.set(0, 1.2, -0.55);
    g.add(hoopTop);
    return g;
  }
  // sport: bolted carbon side skirts + compact rear hoop (Blitz look sheet).
  for (const side of [-1, 1] as const) {
    const sill = box(0.11, 0.1, 1.55, CARBON, "SillPlate");
    sill.position.set(side * 0.78, 0.14, -0.02);
    g.add(sill);
    for (let i = 0; i < 5; i++) {
      const bolt = cyl(0.025, 0.025, 0.04, SILVER, "SillBolt", 6);
      bolt.rotation.z = Math.PI / 2;
      bolt.position.set(side * 0.84, 0.14, 0.55 - i * 0.28);
      g.add(bolt);
    }
  }
  for (const side of [-1, 1] as const) {
    const upright = cyl(0.045, 0.045, 0.62, CARBON, "CageUpright", 6);
    upright.position.set(side * 0.38, 0.78, -1.12);
    g.add(upright);
    const diag = cyl(0.038, 0.038, 0.52, CARBON, "CageDiag", 6);
    diag.rotation.x = 0.65;
    diag.position.set(side * 0.26, 0.62, -1.32);
    g.add(diag);
  }
  const hoopTop = cyl(0.045, 0.045, 0.82, CARBON, "CageTop", 6);
  hoopTop.rotation.z = Math.PI / 2;
  hoopTop.position.set(0, 1.05, -1.12);
  g.add(hoopTop);
  const hoopCross = cyl(0.035, 0.035, 0.55, CARBON, "CageCross", 6);
  hoopCross.rotation.z = Math.PI / 2;
  hoopCross.position.set(0, 0.72, -1.12);
  g.add(hoopCross);
  return g;
}

export type LightweightStyle = "vents" | "holes" | "hood_bed" | "roof_holes" | "tri_cutouts";

/** Carbon vents / drilled light panels. */
export function buildLightweightBody(style: LightweightStyle = "vents"): Group {
  const g = new Group();
  g.name = "proc-lightweight_body";
  if (style === "hood_bed") {
    // Origin on hood deck: louvers on hood + lightening holes along the bed sides.
    for (const [x, z] of [
      [-0.28, 0.22],
      [0.28, 0.22],
      [-0.28, -0.05],
      [0.28, -0.05],
    ] as const) {
      const vent = box(0.2, 0.04, 0.28, CARBON, "HoodVent");
      vent.position.set(x, 0.02, z);
      g.add(vent);
    }
    for (let i = 0; i < 4; i++) {
      const hole = cyl(0.05, 0.05, 0.05, 0x111114, "BedHole", 8);
      hole.rotation.z = Math.PI / 2;
      hole.position.set(0.62, -0.28, -0.9 - i * 0.12);
      g.add(hole);
      const holeL = hole.clone();
      holeL.position.x = -0.62;
      g.add(holeL);
    }
    return g;
  }
  if (style === "roof_holes") {
    for (const [x, z] of [
      [-0.35, 0.15],
      [0, 0.15],
      [0.35, 0.15],
      [-0.35, -0.15],
      [0, -0.15],
      [0.35, -0.15],
    ] as const) {
      const hole = cyl(0.08, 0.08, 0.05, 0x111114, "RoofHole", 8);
      hole.position.set(x, 0.02, z);
      g.add(hole);
    }
    for (const side of [-1, 1] as const) {
      for (let i = 0; i < 3; i++) {
        const hole = cyl(0.07, 0.07, 0.05, 0x111114, "SideHole", 8);
        hole.rotation.z = Math.PI / 2;
        hole.position.set(side * 0.55, -0.15, -0.2 - i * 0.22);
        g.add(hole);
      }
    }
    return g;
  }
  if (style === "tri_cutouts") {
    // Bunker geometric side cutouts.
    for (const side of [-1, 1] as const) {
      for (let i = 0; i < 3; i++) {
        const panel = box(0.06, 0.28, 0.32, 0x111114, "TriCut");
        panel.position.set(side * 0.7, 0.1 - i * 0.05, 0.35 - i * 0.45);
        panel.rotation.z = side * 0.35;
        g.add(panel);
      }
    }
    return g;
  }
  if (style === "holes") {
    for (const [x, y, z] of [
      [-0.55, 0.45, 0.2],
      [-0.55, 0.45, -0.15],
      [-0.55, 0.45, -0.5],
      [0.55, 0.45, 0.2],
      [0.55, 0.45, -0.15],
      [0.55, 0.45, -0.5],
      [-0.35, 0.65, 0.05],
      [0.35, 0.65, 0.05],
    ] as const) {
      const hole = cyl(0.075, 0.075, 0.05, 0x111114, "SpeedHole", 8);
      hole.rotation.z = Math.PI / 2;
      hole.position.set(x, y, z);
      g.add(hole);
    }
    return g;
  }
  // hood louvers only (Blitz look sheet) — raised carbon plates, readable on red paint.
  for (let row = 0; row < 4; row++) {
    for (const side of [-1, 1] as const) {
      const vent = box(0.2, 0.055, 0.24, CARBON, "HoodLouver");
      vent.position.set(side * 0.28, 0.035, 0.28 - row * 0.2);
      g.add(vent);
      const slot = box(0.14, 0.02, 0.04, 0x111114, "LouverSlot");
      slot.position.set(side * 0.28, 0.06, 0.34 - row * 0.2);
      g.add(slot);
    }
  }
  // Center forward pair (look sheet dual intake hint).
  for (const x of [-0.12, 0.12] as const) {
    const center = box(0.16, 0.05, 0.2, CARBON, "HoodCenterVent");
    center.position.set(x, 0.04, 0.42);
    g.add(center);
  }
  return g;
}

export type NitroStyle = "rear_pair" | "bed" | "side" | "rear_rack" | "side_strapped";

/** Nitro bottles — layout varies by car class. */
export function buildNitroKit(style: NitroStyle = "rear_pair"): Group {
  const g = new Group();
  g.name = "proc-nitro_kit";
  const bottle = (color: number, h: number, name: string) => {
    const b = cyl(0.1, 0.1, h, color, name, 10);
    const cap = cyl(0.06, 0.06, 0.06, CHROME, `${name}Cap`, 8);
    cap.position.y = h / 2 + 0.03;
    const wrap = new Group();
    wrap.add(b, cap);
    return wrap;
  };
  if (style === "bed") {
    // Uprights in bed + horizontal tank on front bull bar (local +Z offset).
    const a = bottle(NITRO_CYAN, 0.55, "NitroA");
    a.position.set(-0.28, 0.28, 0.05);
    const b = bottle(NITRO_CYAN, 0.55, "NitroB");
    b.position.set(0.28, 0.28, 0.05);
    const front = bottle(NITRO_CYAN, 0.32, "NitroFront");
    front.rotation.z = Math.PI / 2;
    front.position.set(0, 0.14, 2.55);
    g.add(a, b, front);
    return g;
  }
  if (style === "side" || style === "side_strapped") {
    const a = bottle(style === "side_strapped" ? SILVER : NITRO_ORANGE, 0.55, "NitroA");
    a.position.set(0, 0.28, 0.14);
    const b = bottle(style === "side_strapped" ? SILVER : NITRO_CYAN, 0.48, "NitroB");
    b.position.set(0, 0.24, -0.14);
    for (const z of [0.14, -0.14]) {
      const strap = box(0.22, 0.04, 0.06, CARBON, "NitroStrap");
      strap.position.set(0, 0.35, z);
      g.add(strap);
    }
    g.add(a, b);
    return g;
  }
  if (style === "rear_rack") {
    const a = bottle(NITRO_CYAN, 0.45, "NitroA");
    a.position.set(-0.18, 0.24, 0);
    const b = bottle(NITRO_ORANGE, 0.5, "NitroB");
    b.position.set(0.18, 0.26, 0);
    g.add(a, b);
    return g;
  }
  // rear pair horizontal (Blitz)
  for (const x of [-0.22, 0.22]) {
    const tank = cyl(0.11, 0.11, 0.45, NITRO_CYAN, "NitroTank", 10);
    tank.rotation.x = Math.PI / 2;
    tank.position.set(x, 0.14, 0);
    g.add(tank);
    const band = cyl(0.12, 0.12, 0.06, NITRO_ORANGE, "NitroBand", 8);
    band.rotation.x = Math.PI / 2;
    band.position.set(x, 0.14, 0.05);
    g.add(band);
  }
  return g;
}

/** Coil spring (offroad look). */
export function buildCoilSpring(color: number = SPRING_RED): Group {
  const g = new Group();
  g.name = "proc-offroad_suspension";
  for (let i = 0; i < 5; i++) {
    const ring = cyl(0.09, 0.09, 0.035, color, "Coil", 10);
    ring.position.y = i * 0.07;
    g.add(ring);
  }
  const rod = cyl(0.03, 0.03, 0.38, CHROME, "ShockRod", 6);
  rod.position.y = 0.14;
  g.add(rod);
  return g;
}

export type SpoilerStyle = "gt" | "tall" | "roof";

/** Rear wing — gt (sport), tall (pickup/buggy), roof (armor deck). */
export function buildRearSpoiler(style: SpoilerStyle = "gt"): Group {
  const g = new Group();
  g.name = "proc-rear_spoiler";
  const strutH = style === "tall" ? 0.55 : style === "roof" ? 0.18 : 0.28;
  const bladeY = strutH + 0.02;
  const bladeW = style === "roof" ? 1.15 : 1.05;
  const bladeD = style === "roof" ? 0.26 : 0.32;
  for (const x of [-0.35, 0.35]) {
    const strut = box(0.06, strutH, 0.08, CARBON, "WingStrut");
    strut.position.set(x, strutH / 2, 0);
    g.add(strut);
  }
  const blade = box(bladeW, 0.06, bladeD, CARBON, "WingBlade");
  blade.position.set(0, bladeY, 0.02);
  g.add(blade);
  for (const x of [-bladeW / 2, bladeW / 2]) {
    const end = box(0.04, style === "roof" ? 0.12 : 0.18, bladeD + 0.02, CARBON, "WingEnd");
    end.position.set(x, bladeY, 0.02);
    g.add(end);
  }
  return g;
}

export function springColorFor(carId: string): number {
  if (carId === "kaeferkraft" || carId === "bunker") return SPRING_YELLOW;
  if (carId === "donnerbuechse") return SPRING_CYAN;
  return SPRING_RED;
}

export function caliperColorFor(carId: string): number {
  if (carId === "blitz" || carId === "bunker") return CALIPER_YELLOW;
  return CALIPER_RED;
}

export type UpgradeWheelStyle = {
  /** Tire outer radius (meters). */
  radius: number;
  /** Lateral tire width (meters) — Blitz goes wider, not taller. */
  width: number;
};

/** Replacement wheel when stock tires are hidden for Große Räder. */
export function buildUpgradeWheel(style: UpgradeWheelStyle): Group {
  const g = new Group();
  g.name = "proc-big_wheels";
  const tire = new Mesh(
    new CylinderGeometry(style.radius, style.radius, style.width, 16),
    comicToon(ComicPalette.tire),
  );
  tire.name = "UpgradeTire";
  tire.rotation.z = Math.PI / 2;
  g.add(tire);
  const rim = new Mesh(
    new CylinderGeometry(style.radius * 0.62, style.radius * 0.62, style.width * 0.55, 12),
    comicToon(0xb0b4ba),
  );
  rim.name = "UpgradeRim";
  rim.rotation.z = Math.PI / 2;
  g.add(rim);
  const hub = new Mesh(
    new CylinderGeometry(style.radius * 0.18, style.radius * 0.18, style.width * 0.62, 8),
    comicToon(0x2b2d31),
  );
  hub.name = "UpgradeHub";
  hub.rotation.z = Math.PI / 2;
  g.add(hub);
  return g;
}

/** @deprecated use buildUpgradeWheel */
export function buildWheelBulkHint(): Group {
  return buildUpgradeWheel({ radius: 0.36, width: 0.28 });
}

export type ProcPartId =
  | "big_engine"
  | "spike_bumper"
  | "better_brakes"
  | "reinforced_frame"
  | "lightweight_body"
  | "nitro_kit"
  | "offroad_suspension"
  | "rear_spoiler"
  | "big_wheels";

export function markPartUserData(root: Object3D, partId: string): void {
  root.userData.carPart = partId;
  root.traverse((o) => {
    o.userData.carPart = partId;
  });
}
