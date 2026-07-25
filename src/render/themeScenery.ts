import { CylinderGeometry, Group, Mesh, SphereGeometry } from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import type { BuiltTrack } from "../track/types";
import { sampleCenterline } from "../track/buildTrack";
import { comicToon, withOutline } from "./comicMaterials";
import { ComicPalette } from "./palette";

const CRANE = 0xe85d04;
const WATER = 0x2f6f9e;
const CONTAINER = [0x339af0, 0xe03131, 0xf08c00, 0x37b24d] as const;

/** Theme backdrop props — rounded comic forms; track zones stay asphalt/grass/wall. */
export function buildThemeScenery(track: BuiltTrack, theme: string): Group {
  const root = new Group();
  const t = theme.toLowerCase();

  if (t === "harbor" || t === "beach") {
    const water = new Mesh(new RoundedBoxGeometry(320, 0.12, 320, 1, 0.02), comicToon(WATER));
    water.position.set(0, -0.25, 0);
    water.receiveShadow = true;
    root.add(water);
  }

  const props = t === "harbor" || t === "beach" ? 9 : t === "city" || t === "factory" ? 8 : 6;
  for (let i = 0; i < props; i++) {
    const along = (track.totalLength * (i + 0.5)) / props;
    const s = sampleCenterline(track, along);
    const side = i % 2 === 0 ? 1 : -1;
    const dist = track.asphaltHalfWidth + track.grassWidth + 10 + (i % 3) * 5;
    const px = s.position.x + -s.tangent.z * dist * side;
    const pz = s.position.z + s.tangent.x * dist * side;
    const yaw = Math.atan2(s.tangent.z, s.tangent.x);

    if (t === "harbor" || t === "beach") {
      root.add(makeCrane(px, pz, yaw));
      if (i % 2 === 0) root.add(makeContainerStack(px + side * 7, pz + 3, yaw));
      if (i === 2) root.add(makeShip(px + side * 20, pz, yaw));
      if (i === 4) root.add(makeSilo(px - side * 8, pz - 6, yaw));
    } else if (t === "city" || t === "factory") {
      root.add(makeBuilding(px, pz, yaw, 5 + (i % 4) * 2.5));
    } else {
      root.add(makeRockOrTree(px, pz, yaw, t));
    }
  }

  return root;
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
