import { CylinderGeometry, Group, Mesh, SphereGeometry } from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { CONTAINER_TINTS } from "../data/trackModels";
import type { BuiltTrack } from "../track/types";
import { nearestOnTrack, sampleCenterline } from "../track/buildTrack";
import { comicToon, withOutline } from "./comicMaterials";
import { hasTrackProp, propHeightFor } from "./loadTrackGltf";
import { ComicPalette } from "./palette";
import { instanceTrackProp } from "./trackKit";

const CRANE = 0xe85d04;
const WATER = 0x2f6f9e;
const SAND = 0xc2a66a;

/** Scenery anchor kinds that map 1:1 onto shipped Tripo track props. */
export const TRIPO_SCENERY_KINDS = [
  "crane",
  "container",
  "tank",
  "palm",
  "hut",
  "grandstand",
  "building",
  "tower",
  "warehouse",
  "cliff",
  "spire",
  "scrub",
  "tree",
] as const;

export type TripoSceneryKind = (typeof TRIPO_SCENERY_KINDS)[number];

export function isTripoSceneryKind(kind: string): kind is TripoSceneryKind {
  return (TRIPO_SCENERY_KINDS as readonly string[]).includes(kind);
}

/** Keep props well clear of grass/asphalt so the racing corridor stays readable. */
export const SCENERY_CLEARANCE = 12;

export type SceneryAnchor = {
  kind: string;
  x: number;
  z: number;
  radius: number;
};

function lateralPoint(
  s: { position: { x: number; z: number }; tangent: { x: number; z: number } },
  lateral: number,
): { x: number; z: number } {
  return {
    x: s.position.x + -s.tangent.z * lateral,
    z: s.position.z + s.tangent.x * lateral,
  };
}

export function sceneryOverlapsTrack(
  track: BuiltTrack,
  x: number,
  z: number,
  radius: number,
  padding = 2,
): boolean {
  const near = nearestOnTrack(track, { x, z });
  const keepOut = track.asphaltHalfWidth + track.grassWidth + padding + radius;
  return Math.abs(near.lateral) < keepOut;
}

export function placeOffTrack(
  track: BuiltTrack,
  s: { position: { x: number; z: number }; tangent: { x: number; z: number } },
  side: 1 | -1,
  startDist: number,
  radius: number,
): { x: number; z: number } {
  const trySide = (dir: 1 | -1): { x: number; z: number } | null => {
    let dist = Math.max(startDist, track.asphaltHalfWidth + track.grassWidth + SCENERY_CLEARANCE);
    for (let i = 0; i < 80; i++) {
      const p = lateralPoint(s, dist * dir);
      if (!sceneryOverlapsTrack(track, p.x, p.z, radius)) return p;
      dist += 4;
    }
    return null;
  };
  return trySide(side) ?? trySide(side === 1 ? -1 : 1) ?? lateralPoint(s, (startDist + 100) * side);
}

/** Prefer the outside of the loop (away from centroid) for large props. */
export function outerSide(
  track: BuiltTrack,
  s: { position: { x: number; z: number }; tangent: { x: number; z: number } },
): 1 | -1 {
  const c = trackCentroid(track);
  const toCenterX = c.x - s.position.x;
  const toCenterZ = c.z - s.position.z;
  const rightX = -s.tangent.z;
  const rightZ = s.tangent.x;
  return rightX * toCenterX + rightZ * toCenterZ > 0 ? -1 : 1;
}

function sample(track: BuiltTrack, i: number, n: number) {
  const along = (track.totalLength * (i + 0.5)) / n;
  return sampleCenterline(track, along);
}

/** Oval infield center — used for panorama discs and theme placement. */
export function trackCentroid(track: BuiltTrack): { x: number; z: number } {
  let x = 0;
  let z = 0;
  const n = track.centerline.length || 1;
  for (const p of track.centerline) {
    x += p.x;
    z += p.z;
  }
  return { x: x / n, z: z / n };
}

/**
 * Largest radius around the centroid that stays inside the asphalt ribbon
 * (so basin water does not cover the racing surface).
 */
export function infieldClearRadius(track: BuiltTrack): number {
  const c = trackCentroid(track);
  let minDist = Infinity;
  for (const p of track.centerline) {
    minDist = Math.min(minDist, Math.hypot(p.x - c.x, p.z - c.z));
  }
  return Math.max(4, minDist - track.asphaltHalfWidth - 1.2);
}

/** Normalize ad-hoc / free theme labels onto cup scenery kits (Tripo props). */
export function normalizeTrackTheme(theme: string): string {
  const t = theme.toLowerCase();
  if (t === "scrapyard") return "factory";
  if (t === "mountain") return "canyon";
  return t;
}

/** Planned prop anchors — theme-specific sets. Large props prefer the outer side. */
export function planSceneryAnchors(track: BuiltTrack, theme: string): SceneryAnchor[] {
  const t = normalizeTrackTheme(theme);
  const wallOuter = track.asphaltHalfWidth + track.grassWidth;
  const anchors: SceneryAnchor[] = [];

  const push = (kind: string, s: ReturnType<typeof sampleCenterline>, side: 1 | -1, extra: number, radius: number) => {
    const start = wallOuter + SCENERY_CLEARANCE + extra;
    const p = placeOffTrack(track, s, side, start, radius);
    anchors.push({ kind, ...p, radius });
  };

  if (t === "harbor") {
    // Sparse near-track Tripo kit only — distant harbor is sky dome + panorama cylinders/discs.
    const kinds = ["crane", "container", "warehouse", "tank"] as const;
    for (let i = 0; i < 8; i++) {
      const s = sample(track, i, 8);
      const out = outerSide(track, s);
      const kind = kinds[i % kinds.length]!;
      push(kind, s, out, 2 + (i % 3) * 3, kind === "crane" ? 4.5 : 5);
    }
  } else if (t === "beach") {
    // Parabolbogen: palms + yellow grandstands / huts — water patches stay flat discs.
    for (let i = 0; i < 14; i++) {
      const s = sample(track, i, 14);
      const out = outerSide(track, s);
      push("palm", s, out, (i % 3) * 2, 3.5);
      if (i % 2 === 0) push("water", s, out, 14, 11);
      if (i % 3 === 0) push("scrub", s, out, 5 + (i % 2) * 3, 2.2);
      if (i % 3 === 0) push("hut", s, out, 8, 4.5);
      if (i % 4 === 0) push("grandstand", s, out, 10, 7);
    }
  } else if (t === "city") {
    // Schikanenring: buildings / towers only (Tripo) — no procedural lamps.
    for (let i = 0; i < 14; i++) {
      const s = sample(track, i, 14);
      const out = outerSide(track, s);
      push(i % 3 === 0 ? "tower" : "building", s, out, 3 + (i % 3) * 2, 6);
      if (i % 4 === 0) push("scrub", s, out, 2, 2.2);
      if (i % 5 === 0) push("container", s, out, 8, 4.5);
    }
  } else if (t === "factory") {
    // Kuppenfinale: forest + warehouses; spires stand in for smokestacks (Tripo).
    for (let i = 0; i < 14; i++) {
      const s = sample(track, i, 14);
      const out = outerSide(track, s);
      push("tree", s, out, (i % 3) * 2, 3.5);
      if (i % 2 === 0) push("scrub", s, out, 3, 2.2);
      if (i % 4 === 0) push("warehouse", s, out, 9, 7);
      if (i % 5 === 0) push("spire", s, out, 11, 4);
    }
  } else {
    // Omegatal canyon: cliffs / spires / scrub well outside the ribbon.
    for (let i = 0; i < 14; i++) {
      const s = sample(track, i, 14);
      const out = outerSide(track, s);
      push(i % 2 === 0 ? "cliff" : "spire", s, out, 4 + (i % 3) * 2, i % 2 === 0 ? 8 : 4);
      push("scrub", s, out, 3 + (i % 2) * 2, 2.2);
    }
  }

  return anchors;
}

export function buildThemeScenery(track: BuiltTrack, theme: string): Group {
  const root = new Group();
  const anchors = planSceneryAnchors(track, theme);
  const t = normalizeTrackTheme(theme);

  for (const a of anchors) {
    const near = nearestOnTrack(track, { x: a.x, z: a.z });
    const yaw = Math.atan2(near.tangent.z, near.tangent.x);
    switch (a.kind) {
      case "crane":
        root.add(makeCrane(a.x, a.z, yaw));
        break;
      case "container":
        root.add(makeContainerStack(a.x, a.z, yaw));
        break;
      case "water":
        root.add(makeWaterPatch(a.x, a.z, t === "beach" ? 22 : 18));
        break;
      case "silo":
      case "tank":
        root.add(makeSilo(a.x, a.z, yaw));
        break;
      case "palm":
        root.add(makePalm(a.x, a.z, yaw));
        break;
      case "dune":
        root.add(makeDune(a.x, a.z, yaw));
        break;
      case "hut":
        root.add(makeHut(a.x, a.z, yaw));
        break;
      case "grandstand":
        root.add(makeGrandstand(a.x, a.z, yaw));
        break;
      case "building":
        root.add(makeBuilding(a.x, a.z, yaw, 6 + (Math.abs(a.x) % 5)));
        break;
      case "tower":
        root.add(makeTower(a.x, a.z, yaw));
        break;
      case "lamp":
        root.add(makeLamp(a.x, a.z, yaw));
        break;
      case "warehouse":
        root.add(makeWarehouse(a.x, a.z, yaw));
        break;
      case "stack":
        root.add(makeSmokestack(a.x, a.z, yaw));
        break;
      case "pipe":
        root.add(makePipe(a.x, a.z, yaw));
        break;
      case "cliff":
        root.add(makeCliff(a.x, a.z, yaw));
        break;
      case "spire":
        root.add(makeSpire(a.x, a.z, yaw));
        break;
      case "scrub":
        root.add(makeScrub(a.x, a.z, yaw));
        break;
      case "tree":
        root.add(makeTree(a.x, a.z, yaw));
        break;
      default:
        break;
    }
  }

  return root;
}

function makeWaterPatch(x: number, z: number, size: number): Mesh {
  const water = new Mesh(new RoundedBoxGeometry(size, 0.08, size, 1, 0.02), comicToon(WATER));
  water.position.set(x, -0.35, z);
  return water;
}

function makeCrane(x: number, z: number, yaw: number): Group {
  const kit = hasTrackProp("crane") ? instanceTrackProp("crane", x, z, yaw) : null;
  if (kit) return kit;
  const g = new Group();
  g.position.set(x, 0, z);
  g.rotation.y = yaw;
  const leg = withOutline(new RoundedBoxGeometry(1.4, 20, 1.4, 2, 0.15), comicToon(CRANE), 0.06);
  leg.position.y = 10;
  const boom = withOutline(new RoundedBoxGeometry(24, 1.2, 1.2, 2, 0.15), comicToon(CRANE), 0.06);
  boom.position.set(7, 18.5, 0);
  const cabin = withOutline(new RoundedBoxGeometry(3.2, 2.4, 2.8, 3, 0.2), comicToon(0xf8f9fa), 0.05);
  cabin.position.set(0, 17.2, 0);
  g.add(leg, boom, cabin);
  return g;
}

function makeContainerStack(x: number, z: number, yaw: number): Group {
  if (hasTrackProp("container")) {
    const g = new Group();
    g.position.set(x, 0, z);
    g.rotation.y = yaw;
    g.userData.trackProp = "container";
    const stackH = propHeightFor("container");
    for (let i = 0; i < 3; i++) {
      const tint = CONTAINER_TINTS[i % CONTAINER_TINTS.length];
      const c = instanceTrackProp("container", (i - 1) * 0.25, 0, 0, i * stackH, tint);
      if (c) g.add(c);
    }
    return g;
  }
  const g = new Group();
  g.position.set(x, 0, z);
  g.rotation.y = yaw;
  for (let i = 0; i < 3; i++) {
    const c = withOutline(
      new RoundedBoxGeometry(2.5, 2.3, 6.2, 2, 0.12),
      comicToon(CONTAINER_TINTS[i % CONTAINER_TINTS.length]!),
      0.05,
    );
    c.position.set((i - 1) * 0.25, 1.15 + i * 2.3, 0);
    g.add(c);
  }
  return g;
}

function makeSilo(x: number, z: number, yaw: number): Group {
  const kit = hasTrackProp("tank") ? instanceTrackProp("tank", x, z, yaw) : null;
  if (kit) return kit;
  const g = new Group();
  g.position.set(x, 0, z);
  g.rotation.y = yaw;
  const tank = withOutline(new CylinderGeometry(2.2, 2.2, 8, 14), comicToon(0xf8f9fa), 0.06);
  tank.position.y = 4;
  const stripe = new Mesh(new CylinderGeometry(2.25, 2.25, 0.7, 14), comicToon(0xe03131));
  stripe.position.y = 5.5;
  g.add(tank, stripe);
  return g;
}

function makePalm(x: number, z: number, yaw: number): Group {
  const kit = hasTrackProp("palm") ? instanceTrackProp("palm", x, z, yaw) : null;
  if (kit) return kit;
  const g = new Group();
  g.position.set(x, 0, z);
  g.rotation.y = yaw;
  const trunk = withOutline(new CylinderGeometry(0.28, 0.4, 5, 8), comicToon(0x8b6914), 0.05);
  trunk.position.y = 2.5;
  g.add(trunk);
  for (let i = 0; i < 5; i++) {
    const leaf = withOutline(new RoundedBoxGeometry(0.3, 0.12, 2.8, 1, 0.04), comicToon(0x2f9e44), 0.04);
    leaf.position.set(0, 5.1, 0.9);
    leaf.rotation.y = (i / 5) * Math.PI * 2;
    leaf.rotation.x = -0.55;
    g.add(leaf);
  }
  return g;
}

function makeDune(x: number, z: number, yaw: number): Group {
  const g = new Group();
  g.position.set(x, 0, z);
  g.rotation.y = yaw;
  const dune = withOutline(new SphereGeometry(3.2, 10, 8), comicToon(SAND), 0.08);
  dune.scale.set(1.6, 0.55, 1.1);
  dune.position.y = 1.2;
  g.add(dune);
  return g;
}

function makeHut(x: number, z: number, yaw: number): Group {
  const kit = hasTrackProp("hut") ? instanceTrackProp("hut", x, z, yaw) : null;
  if (kit) return kit;
  const g = new Group();
  g.position.set(x, 0, z);
  g.rotation.y = yaw;
  const body = withOutline(new RoundedBoxGeometry(4, 2.5, 5, 2, 0.15), comicToon(0xf8f9fa), 0.05);
  body.position.y = 1.25;
  const roof = withOutline(new RoundedBoxGeometry(4.6, 0.5, 5.6, 2, 0.1), comicToon(0xe03131), 0.05);
  roof.position.y = 2.7;
  g.add(body, roof);
  return g;
}

function makeGrandstand(x: number, z: number, yaw: number): Group {
  const kit = hasTrackProp("grandstand") ? instanceTrackProp("grandstand", x, z, yaw) : null;
  if (kit) return kit;
  const g = new Group();
  g.position.set(x, 0, z);
  g.rotation.y = yaw;
  const base = withOutline(new RoundedBoxGeometry(10, 1.2, 5, 2, 0.15), comicToon(0x4dabf7), 0.06);
  base.position.y = 0.6;
  const seats = withOutline(new RoundedBoxGeometry(9.5, 2.4, 4.2, 2, 0.12), comicToon(0xfcc419), 0.06);
  seats.position.set(0, 2.2, -0.2);
  g.add(base, seats);
  return g;
}

function makeBuilding(x: number, z: number, yaw: number, h: number): Group {
  const kit = hasTrackProp("building") ? instanceTrackProp("building", x, z, yaw) : null;
  if (kit) {
    kit.scale.setScalar(Math.max(0.85, Math.min(1.25, h / 8)));
    return kit;
  }
  const g = new Group();
  g.position.set(x, 0, z);
  g.rotation.y = yaw;
  const facade = [ComicPalette.concrete, 0x6c757d, 0xadb5bd, 0xe03131][Math.abs(Math.floor(x + z)) % 4]!;
  const b = withOutline(new RoundedBoxGeometry(6, h, 7, 2, 0.2), comicToon(facade), 0.06);
  b.position.y = h / 2;
  const win = new Mesh(new RoundedBoxGeometry(4.5, h * 0.55, 0.25, 1, 0.05), comicToon(0x74c0fc));
  win.position.set(0, h * 0.55, 3.6);
  g.add(b, win);
  return g;
}

function makeTower(x: number, z: number, yaw: number): Group {
  const kit = hasTrackProp("tower") ? instanceTrackProp("tower", x, z, yaw) : null;
  if (kit) return kit;
  return makeBuilding(x, z, yaw, 14);
}

function makeLamp(x: number, z: number, yaw: number): Group {
  const g = new Group();
  g.position.set(x, 0, z);
  g.rotation.y = yaw;
  const pole = withOutline(new CylinderGeometry(0.12, 0.15, 5.5, 8), comicToon(ComicPalette.outline), 0.03);
  pole.position.y = 2.75;
  const head = withOutline(new RoundedBoxGeometry(0.8, 0.35, 0.5, 1, 0.08), comicToon(0xffe066), 0.04);
  head.position.set(0.3, 5.4, 0);
  g.add(pole, head);
  return g;
}

function makeWarehouse(x: number, z: number, yaw: number): Group {
  const kit = hasTrackProp("warehouse") ? instanceTrackProp("warehouse", x, z, yaw) : null;
  if (kit) return kit;
  const g = new Group();
  g.position.set(x, 0, z);
  g.rotation.y = yaw;
  const hall = withOutline(new RoundedBoxGeometry(12, 6, 16, 2, 0.2), comicToon(0x8b9098), 0.07);
  hall.position.y = 3;
  const door = new Mesh(new RoundedBoxGeometry(4, 3.5, 0.3, 1, 0.05), comicToon(0x495057));
  door.position.set(0, 1.8, 8.1);
  g.add(hall, door);
  return g;
}

function makeSmokestack(x: number, z: number, yaw: number): Group {
  const g = new Group();
  g.position.set(x, 0, z);
  g.rotation.y = yaw;
  const stack = withOutline(new CylinderGeometry(1.4, 1.8, 16, 12), comicToon(0x868e96), 0.07);
  stack.position.y = 8;
  const ring = new Mesh(new CylinderGeometry(1.55, 1.55, 0.5, 12), comicToon(0xe03131));
  ring.position.y = 12;
  g.add(stack, ring);
  return g;
}

function makePipe(x: number, z: number, yaw: number): Group {
  const g = new Group();
  g.position.set(x, 0, z);
  g.rotation.y = yaw;
  const pipe = withOutline(new CylinderGeometry(0.7, 0.7, 10, 10), comicToon(0xadb5bd), 0.05);
  pipe.rotation.z = Math.PI / 2;
  pipe.position.set(0, 2.2, 0);
  g.add(pipe);
  return g;
}

function makeCliff(x: number, z: number, yaw: number): Group {
  const kit = hasTrackProp("cliff") ? instanceTrackProp("cliff", x, z, yaw) : null;
  if (kit) return kit;
  const g = new Group();
  g.position.set(x, 0, z);
  g.rotation.y = yaw;
  const rock = withOutline(new RoundedBoxGeometry(8, 14, 6, 3, 0.6), comicToon(0xa0785a), 0.1);
  rock.position.y = 6;
  rock.rotation.z = 0.08;
  g.add(rock);
  return g;
}

function makeSpire(x: number, z: number, yaw: number): Group {
  const kit = hasTrackProp("spire") ? instanceTrackProp("spire", x, z, yaw) : null;
  if (kit) return kit;
  const g = new Group();
  g.position.set(x, 0, z);
  g.rotation.y = yaw;
  const spire = withOutline(new CylinderGeometry(0.4, 2.2, 10, 7), comicToon(0x8b6848), 0.08);
  spire.position.y = 5;
  g.add(spire);
  return g;
}

function makeScrub(x: number, z: number, yaw: number): Group {
  const kit = hasTrackProp("scrub") ? instanceTrackProp("scrub", x, z, yaw) : null;
  if (kit) return kit;
  const g = new Group();
  g.position.set(x, 0, z);
  g.rotation.y = yaw;
  const bush = withOutline(new SphereGeometry(1.4, 8, 8), comicToon(0x5c7c3a), 0.05);
  bush.position.y = 1;
  bush.scale.set(1.3, 0.7, 1.1);
  g.add(bush);
  return g;
}

function makeTree(x: number, z: number, yaw: number): Group {
  const kit = hasTrackProp("tree") ? instanceTrackProp("tree", x, z, yaw) : null;
  if (kit) return kit;
  const g = new Group();
  g.position.set(x, 0, z);
  g.rotation.y = yaw;
  const trunk = withOutline(new CylinderGeometry(0.35, 0.5, 3.2, 8), comicToon(0x6b4f2a), 0.05);
  trunk.position.y = 1.6;
  const crown = withOutline(new SphereGeometry(2.2, 10, 8), comicToon(0x2f6b3a), 0.07);
  crown.position.y = 4.4;
  crown.scale.set(1, 1.35, 1);
  g.add(trunk, crown);
  return g;
}
