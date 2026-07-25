import {
  CatmullRomCurve3,
  ExtrudeGeometry,
  Group,
  Mesh,
  Shape,
  Vector3,
} from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { sampleCenterline } from "../track/buildTrack";
import type { BuiltTrack } from "../track/types";
import { comicToon, withOutline } from "./comicMaterials";
import { ComicPalette } from "./palette";
import { buildFinishLine } from "./finishLine";

function closedCurve(track: BuiltTrack, y = 0): CatmullRomCurve3 {
  const pts = track.centerline.map((p) => new Vector3(p.x, y, p.z));
  return new CatmullRomCurve3(pts, true, "catmullrom", 0.18);
}

function ribbonShape(halfWidth: number, height: number, y0 = 0): Shape {
  const s = new Shape();
  s.moveTo(-halfWidth, y0);
  s.lineTo(halfWidth, y0);
  s.lineTo(halfWidth, y0 + height);
  s.lineTo(-halfWidth, y0 + height);
  s.closePath();
  return s;
}

function extrudeAlong(shape: Shape, curve: CatmullRomCurve3, steps: number): ExtrudeGeometry {
  return new ExtrudeGeometry(shape, {
    steps,
    bevelEnabled: false,
    extrudePath: curve,
    curveSegments: 8,
  });
}

/** Continuous comic track ribbons (asphalt / grass / curbs) + readable walls. */
export function buildSmoothTrack(track: BuiltTrack): Group {
  const root = new Group();
  const steps = Math.max(120, track.centerline.length * 4);
  const curve = closedCurve(track, 0);

  const grassHalf = track.asphaltHalfWidth + track.grassWidth;
  const grass = withOutline(
    extrudeAlong(ribbonShape(grassHalf, 0.1, -0.02), curve, steps),
    comicToon(ComicPalette.grass),
    0.04,
  );
  grass.receiveShadow = true;
  root.add(grass);

  const asphalt = withOutline(
    extrudeAlong(ribbonShape(track.asphaltHalfWidth, 0.14, 0.02), curve, steps),
    comicToon(ComicPalette.asphalt),
    0.035,
  );
  asphalt.receiveShadow = true;
  root.add(asphalt);

  // Red/white curb strips (inner & outer edge flashes via segmented boxes along curve)
  const curbSamples = Math.max(40, Math.floor(track.totalLength / 3));
  for (let i = 0; i < curbSamples; i++) {
    const d0 = (i / curbSamples) * track.totalLength;
    const d1 = ((i + 0.55) / curbSamples) * track.totalLength;
    const a = sampleCenterline(track, d0);
    const b = sampleCenterline(track, d1);
    const mx = (a.position.x + b.position.x) / 2;
    const mz = (a.position.z + b.position.z) / 2;
    const len = Math.hypot(b.position.x - a.position.x, b.position.z - a.position.z) || 0.5;
    const angle = Math.atan2(b.position.z - a.position.z, b.position.x - a.position.x);
    const color = i % 2 === 0 ? ComicPalette.curbLight : ComicPalette.curbDark;
    for (const side of [-1, 1] as const) {
      const curb = new Mesh(new RoundedBoxGeometry(len, 0.2, 0.38, 2, 0.06), comicToon(color));
      const off = track.asphaltHalfWidth + 0.12;
      curb.position.set(mx + Math.sin(angle) * off * side, 0.14, mz - Math.cos(angle) * off * side);
      curb.rotation.y = -angle;
      curb.castShadow = true;
      curb.receiveShadow = true;
      root.add(curb);
    }

    // Center dashes
    if (i % 2 === 0) {
      const dash = new Mesh(new RoundedBoxGeometry(Math.min(len * 0.7, 2.4), 0.05, 0.22, 1, 0.02), comicToon(ComicPalette.asphaltLine));
      dash.position.set(mx, 0.17, mz);
      dash.rotation.y = -angle;
      root.add(dash);
    }
  }

  // Walls along centerline samples
  const wallStep = Math.max(2, Math.floor(track.centerline.length / 60));
  for (let i = 0; i < track.centerline.length - 1; i += wallStep) {
    const a = track.centerline[i]!;
    const b = track.centerline[Math.min(i + wallStep, track.centerline.length - 1)]!;
    const mx = (a.x + b.x) / 2;
    const mz = (a.z + b.z) / 2;
    const len = Math.hypot(b.x - a.x, b.z - a.z) || 1;
    const angle = Math.atan2(b.z - a.z, b.x - a.x);
    const wallKind = track.wallKind[i] ?? "concrete";
    const wallOff = track.asphaltHalfWidth + track.grassWidth + 0.65;

    for (const side of [-1, 1] as const) {
      const px = mx + Math.sin(angle) * wallOff * side;
      const pz = mz - Math.cos(angle) * wallOff * side;
      if (wallKind === "tire") {
        root.add(makeTireStack(px, pz, -angle));
      } else {
        const wall = withOutline(
          new RoundedBoxGeometry(Math.max(len, 1.2), 1.5, 0.55, 2, 0.08),
          comicToon(i % 3 === 0 ? ComicPalette.concreteDark : ComicPalette.concrete),
          0.05,
        );
        wall.position.set(px, 0.75, pz);
        wall.rotation.y = -angle;
        root.add(wall);

        // Fence top
        const fence = withOutline(new RoundedBoxGeometry(Math.max(len, 1.2), 0.55, 0.08, 1, 0.02), comicToon(ComicPalette.outline), 0.03);
        fence.position.set(px + Math.sin(angle) * 0.2 * side, 1.55, pz - Math.cos(angle) * 0.2 * side);
        fence.rotation.y = -angle;
        root.add(fence);

        if (i % (wallStep * 3) === 0) {
          root.add(makeChevron(px, pz, -angle, side));
        }
      }
    }
  }

  root.add(buildFinishLine(track));

  return root;
}

function makeTireStack(x: number, z: number, rotY: number): Group {
  const g = new Group();
  g.position.set(x, 0, z);
  g.rotation.y = rotY;
  for (let i = 0; i < 3; i++) {
    const tire = withOutline(
      new RoundedBoxGeometry(1.15, 0.38, 1.15, 3, 0.18),
      comicToon(ComicPalette.tire),
      0.05,
    );
    tire.position.set(0, 0.28 + i * 0.4, (i - 1) * 0.08);
    g.add(tire);
  }
  const stripe = new Mesh(new RoundedBoxGeometry(0.22, 0.22, 1.15, 1, 0.04), comicToon(ComicPalette.tireAccent));
  stripe.position.set(0, 0.85, 0);
  g.add(stripe);
  return g;
}

function makeChevron(x: number, z: number, yaw: number, side: number): Group {
  const g = new Group();
  g.position.set(x, 1.15, z);
  g.rotation.y = yaw;
  const board = withOutline(new RoundedBoxGeometry(0.1, 0.75, 1.35, 1, 0.04), comicToon(0xffe066), 0.04);
  board.position.x = side * 0.38;
  g.add(board);
  for (let i = 0; i < 3; i++) {
    const mark = new Mesh(new RoundedBoxGeometry(0.12, 0.14, 0.32, 1, 0.02), comicToon(ComicPalette.outline));
    mark.position.set(side * 0.46, 0.18 - i * 0.2, (1 - i) * 0.22 * side);
    mark.rotation.z = side * 0.55;
    g.add(mark);
  }
  return g;
}
