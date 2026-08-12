/**
 * Asphalt-Comic procedural Teil meshes (parts-look targets).
 * Flat colors, clear silhouettes — fallback when Tripo GLBs are not preloaded;
 * also used for better_brakes / big_wheels (no GLB).
 */
import {
  BoxGeometry,
  ConeGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  SphereGeometry,
  type Object3D,
} from "three";
import { comicToon } from "./comicMaterials";
import { ComicPalette } from "./palette";

const CARBON = 0x2a2d33;
const CHROME = 0xc5ccd4;
const GREY = 0x6a7078;
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
    const body = box(0.55, 0.28, 0.7, CARBON, "ScoopBody");
    body.position.y = 0.14;
    g.add(body);
    const mouth = box(0.42, 0.16, 0.08, 0x111114, "ScoopMouth");
    mouth.position.set(0, 0.14, 0.38);
    g.add(mouth);
    return g;
  }
  if (kind === "blower") {
    const base = box(0.42, 0.12, 0.5, CHROME, "BlowerBase");
    base.position.y = 0.06;
    g.add(base);
    for (const x of [-0.14, 0, 0.14]) {
      const pipe = cyl(0.07, 0.07, 0.22, CHROME, "BlowerPipe", 8);
      pipe.rotation.x = Math.PI / 2;
      pipe.position.set(x, 0.2, 0.08);
      g.add(pipe);
      const lip = cyl(0.09, 0.09, 0.04, 0x1b1b1f, "BlowerLip", 8);
      lip.rotation.x = Math.PI / 2;
      lip.position.set(x, 0.2, 0.2);
      g.add(lip);
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
  const block = box(0.7, 0.45, 0.55, CARBON, "EngineBlock");
  block.position.y = 0.22;
  g.add(block);
  for (let i = 0; i < 3; i++) {
    const tip = cyl(0.05, 0.06, 0.28, CHROME, "ExhaustTip", 8);
    tip.rotation.z = Math.PI / 2;
    tip.position.set(0.45, 0.18 + i * 0.12, -0.05 + i * 0.02);
    g.add(tip);
  }
  return g;
}

/** Spiked front bumper bar. */
export function buildSpikeBumper(spikeCount = 5, width = 1.2): Group {
  const g = new Group();
  g.name = "proc-spike_bumper";
  const bar = box(width, 0.16, 0.18, CARBON, "SpikeBar");
  bar.position.y = 0.08;
  g.add(bar);
  const span = width * 0.78;
  for (let i = 0; i < spikeCount; i++) {
    const t = spikeCount === 1 ? 0.5 : i / (spikeCount - 1);
    const x = -span / 2 + t * span;
    const spike = cone(0.07, 0.32, CHROME, "Spike");
    spike.rotation.x = Math.PI / 2;
    spike.position.set(x, 0.1, 0.22);
    g.add(spike);
  }
  return g;
}

/** Single caliper + disc (place near a wheel). */
export function buildBrakeUnit(caliperColor: number = CALIPER_RED): Group {
  const g = new Group();
  g.name = "proc-better_brakes";
  const disc = cyl(0.22, 0.22, 0.04, CHROME, "BrakeDisc", 12);
  disc.rotation.z = Math.PI / 2;
  g.add(disc);
  const cal = box(0.12, 0.16, 0.18, caliperColor, "Caliper");
  cal.position.set(0.12, 0.02, 0);
  g.add(cal);
  return g;
}

/** Sill plates + rear half-cage / hoop. */
export function buildReinforcedFrame(
  style: "sport" | "pickup" | "buggy" | "hotrod" | "armor" = "sport",
): Group {
  const g = new Group();
  g.name = "proc-reinforced_frame";
  if (style === "buggy") {
    // Extra cage tubes along sides
    for (const z of [-0.55, 0.55]) {
      const rail = cyl(0.04, 0.04, 1.6, CARBON, "CageRail", 6);
      rail.rotation.z = Math.PI / 2;
      rail.position.set(0, 0.55, z);
      g.add(rail);
    }
    const cross = cyl(0.04, 0.04, 1.1, CARBON, "CageCross", 6);
    cross.rotation.x = Math.PI / 2;
    cross.position.set(0.2, 0.85, 0);
    g.add(cross);
    return g;
  }
  if (style === "pickup") {
    for (const side of [-1, 1] as const) {
      const bar = cyl(0.045, 0.045, 1.2, CARBON, "BedBar", 6);
      bar.rotation.x = -0.55;
      bar.position.set(side * 0.55, 0.7, -0.35);
      g.add(bar);
    }
    const top = cyl(0.04, 0.04, 1.15, CARBON, "BedTop", 6);
    top.rotation.z = Math.PI / 2;
    top.position.set(0, 1.15, -0.85);
    g.add(top);
    return g;
  }
  if (style === "armor") {
    for (const x of [-0.7, 0.7]) {
      const pillar = cyl(0.045, 0.045, 1.4, CARBON, "ArmorPillar", 6);
      pillar.position.set(x, 0.9, 0);
      g.add(pillar);
    }
    const roof = cyl(0.04, 0.04, 1.5, CARBON, "ArmorRoof", 6);
    roof.rotation.z = Math.PI / 2;
    roof.position.set(0, 1.55, -0.2);
    g.add(roof);
    const side = box(1.7, 0.12, 0.2, GREY, "ArmorSill");
    side.position.set(0, 0.35, 0);
    g.add(side);
    return g;
  }
  // sport / hotrod: sill + rear hoop
  for (const x of [-0.72, 0.72]) {
    const sill = box(0.14, 0.18, 1.6, GREY, "SillPlate");
    sill.position.set(x, 0.2, -0.1);
    g.add(sill);
  }
  const hoopL = cyl(0.04, 0.04, 0.85, CARBON, "HoopL", 6);
  hoopL.position.set(-0.55, 0.7, -0.7);
  g.add(hoopL);
  const hoopR = cyl(0.04, 0.04, 0.85, CARBON, "HoopR", 6);
  hoopR.position.set(0.55, 0.7, -0.7);
  g.add(hoopR);
  const hoopTop = cyl(0.04, 0.04, 1.15, CARBON, "HoopTop", 6);
  hoopTop.rotation.z = Math.PI / 2;
  hoopTop.position.set(0, 1.1, -0.7);
  g.add(hoopTop);
  return g;
}

/** Carbon vents / drilled light panels. */
export function buildLightweightBody(
  style: "vents" | "holes" | "hood_bed" = "vents",
): Group {
  const g = new Group();
  g.name = "proc-lightweight_body";
  if (style === "hood_bed") {
    for (const x of [-0.18, 0.18]) {
      const vent = box(0.2, 0.04, 0.35, CARBON, "HoodVent");
      vent.position.set(x, 0.02, 0.2);
      g.add(vent);
    }
    for (let i = 0; i < 5; i++) {
      const hole = cyl(0.06, 0.06, 0.04, 0x111114, "BedHole", 8);
      hole.rotation.z = Math.PI / 2;
      hole.position.set(0.55, 0.35, -0.4 - i * 0.16);
      g.add(hole);
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
      [0.55, 0.55, 0.1],
    ] as const) {
      const hole = cyl(0.07, 0.07, 0.05, 0x111114, "SpeedHole", 8);
      hole.rotation.z = Math.PI / 2;
      hole.position.set(x, y, z);
      g.add(hole);
    }
    return g;
  }
  // hood louvers (Blitz)
  for (let row = 0; row < 3; row++) {
    for (const side of [-1, 1] as const) {
      const vent = box(0.16, 0.035, 0.28, CARBON, "HoodLouver");
      vent.position.set(side * 0.28, 0.02, 0.15 - row * 0.22);
      vent.rotation.y = side * 0.15;
      g.add(vent);
    }
  }
  return g;
}

/** Nitro bottles — layout varies by car class. */
export function buildNitroKit(
  style: "rear_pair" | "bed" | "side" | "rear_rack" = "rear_pair",
): Group {
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
    const a = bottle(NITRO_CYAN, 0.55, "NitroA");
    a.position.set(-0.25, 0.28, 0);
    const b = bottle(NITRO_CYAN, 0.55, "NitroB");
    b.position.set(0.25, 0.28, 0);
    const front = bottle(NITRO_CYAN, 0.28, "NitroFront");
    front.rotation.z = Math.PI / 2;
    front.position.set(0, 0.12, 0.9);
    g.add(a, b, front);
    return g;
  }
  if (style === "side") {
    const a = bottle(NITRO_ORANGE, 0.5, "NitroRed");
    a.position.set(0, 0.25, 0.12);
    const b = bottle(NITRO_CYAN, 0.38, "NitroBlue");
    b.position.set(0, 0.2, -0.12);
    g.add(a, b);
    return g;
  }
  if (style === "rear_rack") {
    const a = bottle(NITRO_CYAN, 0.42, "NitroA");
    a.position.set(-0.22, 0.22, 0);
    const b = bottle(NITRO_CYAN, 0.42, "NitroB");
    b.position.set(0, 0.22, 0);
    const c = bottle(NITRO_ORANGE, 0.5, "NitroC");
    c.position.set(0.24, 0.26, 0);
    g.add(a, b, c);
    return g;
  }
  // rear pair horizontal-ish (Blitz)
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

/** GT rear wing. */
export function buildRearSpoiler(): Group {
  const g = new Group();
  g.name = "proc-rear_spoiler";
  for (const x of [-0.35, 0.35]) {
    const strut = box(0.06, 0.28, 0.08, CARBON, "WingStrut");
    strut.position.set(x, 0.14, 0);
    g.add(strut);
  }
  const blade = box(1.05, 0.06, 0.32, CARBON, "WingBlade");
  blade.position.set(0, 0.3, 0.02);
  g.add(blade);
  for (const x of [-0.52, 0.52]) {
    const end = box(0.04, 0.18, 0.34, CARBON, "WingEnd");
    end.position.set(x, 0.3, 0.02);
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
  if (carId === "bunker") return CALIPER_YELLOW;
  return CALIPER_RED;
}

/** Tiny tire “bulk” discs when big_wheels is on (no fake shared hub overlays). */
export function buildWheelBulkHint(): Group {
  const g = new Group();
  g.name = "proc-big_wheels";
  const tire = new Mesh(new SphereGeometry(0.28, 10, 8), comicToon(ComicPalette.tire));
  tire.name = "TireBulk";
  tire.scale.set(0.55, 1, 1);
  g.add(tire);
  return g;
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
