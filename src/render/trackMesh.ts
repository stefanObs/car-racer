import {
  BufferAttribute,
  BufferGeometry,
  Group,
  Mesh,
} from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { sampleCenterline } from "../track/buildTrack";
import type { BuiltTrack } from "../track/types";
import { comicToon, withOutline } from "./comicMaterials";
import { ComicPalette } from "./palette";
import { buildFinishLine } from "./finishLine";
import { hasTrackProp } from "./loadTrackGltf";
import { instanceConcreteFenceBatch, instanceTrackPropBatch, planWallPlacements } from "./trackKit";

/**
 * Closed asphalt/grass ribbon with **world up** (never Frenet-twist).
 * ExtrudeGeometry along closed CatmullRom curves flips frames → ~20 m tall
 * “green/gray walls” through the chase camera (Hafenstart RCA).
 */
export function flatRibbonGeometry(
  track: BuiltTrack,
  halfWidth: number,
  yBottom: number,
  yTop: number,
  steps: number,
): BufferGeometry {
  const n = Math.max(24, steps);
  const positions: number[] = [];
  const normals: number[] = [];
  // 4 verts per ring: L-bottom, R-bottom, L-top, R-top
  for (let i = 0; i < n; i++) {
    const s = sampleCenterline(track, (i / n) * track.totalLength);
    const lx = -s.tangent.z;
    const lz = s.tangent.x;
    const px = s.position.x;
    const pz = s.position.z;
    positions.push(
      px + lx * halfWidth, yBottom, pz + lz * halfWidth,
      px - lx * halfWidth, yBottom, pz - lz * halfWidth,
      px + lx * halfWidth, yTop, pz + lz * halfWidth,
      px - lx * halfWidth, yTop, pz - lz * halfWidth,
    );
    for (let k = 0; k < 4; k++) normals.push(0, 1, 0);
  }
  const indices: number[] = [];
  for (let i = 0; i < n; i++) {
    const a = i * 4;
    const b = ((i + 1) % n) * 4;
    // top face
    indices.push(a + 2, b + 2, a + 3, a + 3, b + 2, b + 3);
    // bottom face
    indices.push(a, a + 1, b, a + 1, b + 1, b);
    // left wall
    indices.push(a, b, a + 2, a + 2, b, b + 2);
    // right wall
    indices.push(a + 1, a + 3, b + 1, a + 3, b + 3, b + 1);
  }
  const geo = new BufferGeometry();
  geo.setAttribute("position", new BufferAttribute(new Float32Array(positions), 3));
  geo.setAttribute("normal", new BufferAttribute(new Float32Array(normals), 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/** Continuous comic track ribbons (asphalt / grass / curbs) + readable walls. */
export function buildSmoothTrack(track: BuiltTrack): Group {
  const root = new Group();
  const steps = Math.max(120, track.centerline.length * 4);

  const grassHalf = track.asphaltHalfWidth + track.grassWidth;
  const grass = withOutline(
    flatRibbonGeometry(track, grassHalf, -0.02, 0.08, steps),
    comicToon(ComicPalette.grass),
    0.04,
  );
  grass.name = "trackGrass";
  grass.receiveShadow = true;
  root.add(grass);

  const asphalt = withOutline(
    flatRibbonGeometry(track, track.asphaltHalfWidth, 0.02, 0.16, steps),
    comicToon(ComicPalette.asphalt),
    0.035,
  );
  asphalt.name = "trackAsphalt";
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

  const places = planWallPlacements(track);
  const tires = places.filter((p) => p.kind === "tire");
  const cons = places.filter((p) => p.kind === "concrete");
  const tireBatch = hasTrackProp("tire-wall") ? instanceTrackPropBatch("tire-wall", tires) : null;
  if (tireBatch) {
    tireBatch.userData.wallKind = "tire";
    tireBatch.userData.tripoTrack = true;
    root.add(tireBatch);
  } else {
    for (const p of tires) root.add(makeTireStack(p.x, p.z, p.yaw));
  }
  const concreteBatch = hasTrackProp("concrete-wall") ? instanceConcreteFenceBatch(cons) : null;
  if (concreteBatch) {
    concreteBatch.userData.tripoTrack = true;
    root.add(concreteBatch);
  } else {
    for (const p of cons) root.add(makeConcreteFallback(p.x, p.z, p.yaw, p.side));
  }

  root.add(buildFinishLine(track));

  return root;
}

function makeTireStack(x: number, z: number, rotY: number): Group {
  const g = new Group();
  g.position.set(x, 0, z);
  g.rotation.y = rotY;
  g.userData.trackProp = "tire-wall";
  g.userData.wallKind = "tire";
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

function makeConcreteFallback(x: number, z: number, yaw: number, side: number): Group {
  const g = new Group();
  g.position.set(x, 0, z);
  g.rotation.y = yaw;
  g.userData.trackProp = "concrete-wall";
  g.userData.wallKind = "concrete";
  const wall = withOutline(
    new RoundedBoxGeometry(1.8, 1.5, 0.55, 2, 0.08),
    comicToon(ComicPalette.concrete),
    0.05,
  );
  wall.position.y = 0.75;
  g.add(wall);
  const fence = withOutline(new RoundedBoxGeometry(1.8, 0.55, 0.08, 1, 0.02), comicToon(ComicPalette.outline), 0.03);
  fence.position.set(0, 1.55, 0.12);
  g.add(fence);
  g.add(makeChevron(0, 0, 0, side));
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
