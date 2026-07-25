import { CylinderGeometry, Group, Mesh, SphereGeometry } from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import type { BuiltTrack } from "../track/types";
import { nearestOnTrack, sampleCenterline } from "../track/buildTrack";
import { comicToon, withOutline } from "./comicMaterials";
import { ComicPalette } from "./palette";

const CRANE = 0xe85d04;
const WATER = 0x2f6f9e;
const CONTAINER = [0x339af0, 0xe03131, 0xf08c00, 0x37b24d] as const;

/** Starting gap from wall outer edge to prop center (meters). */
export const SCENERY_CLEARANCE = 16;

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

/** True if a disc around (x,z) overlaps asphalt+grass (+padding). */
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

/**
 * Push outward along the sample normal until the footprint clears the whole loop
 * (not just the local segment — closed tracks fold back on themselves).
 */
export function placeOffTrack(
  track: BuiltTrack,
  s: { position: { x: number; z: number }; tangent: { x: number; z: number } },
  side: 1 | -1,
  startDist: number,
  radius: number,
): { x: number; z: number } {
  let dist = Math.max(startDist, track.asphaltHalfWidth + track.grassWidth + SCENERY_CLEARANCE);
  for (let i = 0; i < 40; i++) {
    const p = lateralPoint(s, dist * side);
    if (!sceneryOverlapsTrack(track, p.x, p.z, radius)) return p;
    dist += 5;
  }
  return lateralPoint(s, dist * side);
}

/** Planned prop anchors — shared by builder + tests. */
export function planSceneryAnchors(track: BuiltTrack, theme: string): SceneryAnchor[] {
  const t = theme.toLowerCase();
  const wallOuter = track.asphaltHalfWidth + track.grassWidth;
  const props = t === "harbor" || t === "beach" ? 9 : t === "city" || t === "factory" ? 8 : 6;
  const anchors: SceneryAnchor[] = [];

  for (let i = 0; i < props; i++) {
    const along = (track.totalLength * (i + 0.5)) / props;
    const s = sampleCenterline(track, along);
    const side: 1 | -1 = i % 2 === 0 ? 1 : -1;
    const start = wallOuter + SCENERY_CLEARANCE + (i % 3) * 4;

    if (t === "harbor" || t === "beach") {
      const crane = placeOffTrack(track, s, side, start, 4);
      anchors.push({ kind: "crane", ...crane, radius: 4 });
      if (i % 2 === 0) {
        const c = placeOffTrack(track, s, side, start + 8, 4);
        anchors.push({ kind: "container", ...c, radius: 4 });
        // No full-world water slab; small patches stay off-track too
        const w = placeOffTrack(track, s, side, start + 20, 10);
        anchors.push({ kind: "water", ...w, radius: 10 });
      }
      if (i === 2) {
        const ship = placeOffTrack(track, s, side, start + 28, 16);
        anchors.push({ kind: "ship", ...ship, radius: 16 });
      }
      if (i === 4) {
        const silo = placeOffTrack(track, s, side, start + 10, 3);
        anchors.push({ kind: "silo", ...silo, radius: 3 });
      }
    } else if (t === "city" || t === "factory") {
      const b = placeOffTrack(track, s, side, start, 6);
      anchors.push({ kind: "building", ...b, radius: 6 });
    } else {
      const landmark = placeOffTrack(track, s, side, start, 4);
      anchors.push({ kind: "landmark", ...landmark, radius: 4 });
    }
  }
  return anchors;
}

/** Theme backdrop props — must stay clear of the racing surface. */
export function buildThemeScenery(track: BuiltTrack, theme: string): Group {
  const root = new Group();
  const anchors = planSceneryAnchors(track, theme);
  const t = theme.toLowerCase();

  // Rebuild yaw from nearest track point for orientation
  for (const a of anchors) {
    const near = nearestOnTrack(track, { x: a.x, z: a.z });
    const yaw = Math.atan2(near.tangent.z, near.tangent.x);
    if (a.kind === "crane") root.add(makeCrane(a.x, a.z, yaw));
    else if (a.kind === "container") root.add(makeContainerStack(a.x, a.z, yaw));
    else if (a.kind === "water") root.add(makeWaterPatch(a.x, a.z));
    else if (a.kind === "ship") root.add(makeShip(a.x, a.z, yaw));
    else if (a.kind === "silo") root.add(makeSilo(a.x, a.z, yaw));
    else if (a.kind === "building") root.add(makeBuilding(a.x, a.z, yaw, 6));
    else if (a.kind === "landmark") root.add(makeRockOrTree(a.x, a.z, yaw, t));
  }

  return root;
}

function makeWaterPatch(x: number, z: number): Mesh {
  const water = new Mesh(new RoundedBoxGeometry(18, 0.08, 18, 1, 0.02), comicToon(WATER));
  water.position.set(x, -0.35, z);
  return water;
}

function makeCrane(x: number, z: number, yaw: number): Group {
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
  const g = new Group();
  g.position.set(x, 0, z);
  g.rotation.y = yaw;
  for (let i = 0; i < 3; i++) {
    const c = withOutline(
      new RoundedBoxGeometry(2.5, 2.3, 6.2, 2, 0.12),
      comicToon(CONTAINER[i % CONTAINER.length]!),
      0.05,
    );
    c.position.set((i - 1) * 0.25, 1.15 + i * 2.3, 0);
    g.add(c);
  }
  return g;
}

function makeShip(x: number, z: number, yaw: number): Group {
  const g = new Group();
  g.position.set(x, -0.15, z);
  g.rotation.y = yaw;
  const hull = withOutline(new RoundedBoxGeometry(9, 3.2, 30, 3, 0.35), comicToon(0x1c7ed6), 0.07);
  hull.position.y = 1.3;
  const bridge = withOutline(new RoundedBoxGeometry(5.5, 4.2, 6.5, 3, 0.25), comicToon(0xf8f9fa), 0.06);
  bridge.position.set(0, 4.8, -9);
  g.add(hull, bridge);
  for (let i = 0; i < 5; i++) {
    const c = withOutline(
      new RoundedBoxGeometry(2.3, 2.1, 2.3, 2, 0.1),
      comicToon(CONTAINER[i % CONTAINER.length]!),
      0.04,
    );
    c.position.set(((i % 2) - 0.5) * 2.6, 3.4, -4 + i * 3.2);
    g.add(c);
  }
  return g;
}

function makeSilo(x: number, z: number, yaw: number): Group {
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

function makeBuilding(x: number, z: number, yaw: number, h: number): Group {
  const g = new Group();
  g.position.set(x, 0, z);
  g.rotation.y = yaw;
  const b = withOutline(new RoundedBoxGeometry(7, h, 9, 2, 0.2), comicToon(ComicPalette.concrete), 0.06);
  b.position.y = h / 2;
  const win = new Mesh(new RoundedBoxGeometry(5.5, h * 0.55, 0.25, 1, 0.05), comicToon(0x74c0fc));
  win.position.set(0, h * 0.55, 4.6);
  g.add(b, win);
  return g;
}

function makeRockOrTree(x: number, z: number, yaw: number, theme: string): Group {
  const g = new Group();
  g.position.set(x, 0, z);
  g.rotation.y = yaw;
  if (theme === "canyon" || theme === "mountain") {
    const rock = withOutline(new RoundedBoxGeometry(5.5, 7, 4.5, 3, 0.5), comicToon(0xa0785a), 0.08);
    rock.position.y = 3.2;
    g.add(rock);
  } else {
    const trunk = withOutline(new CylinderGeometry(0.4, 0.5, 2.8, 8), comicToon(0x6b4f2a), 0.05);
    trunk.position.y = 1.4;
    const canopy = withOutline(new SphereGeometry(2.2, 10, 10), comicToon(ComicPalette.grass), 0.07);
    canopy.position.y = 4.2;
    g.add(trunk, canopy);
  }
  return g;
}
