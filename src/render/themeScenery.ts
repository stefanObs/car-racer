import { BoxGeometry, CylinderGeometry, Group, Mesh } from "three";
import type { BuiltTrack } from "../track/types";
import { sampleCenterline } from "../track/buildTrack";
import { comicToon, withOutline } from "./comicMaterials";
import { ComicPalette } from "./palette";

const CRANE = 0xe85d04;
const WATER = 0x2f6f9e;
const CONTAINER = [0x339af0, 0xe03131, 0xf08c00, 0x37b24d] as const;

/** Theme backdrop props — backgrounds only; track zones stay asphalt/grass/wall. */
export function buildThemeScenery(track: BuiltTrack, theme: string): Group {
  const root = new Group();
  const t = theme.toLowerCase();

  if (t === "harbor" || t === "beach") {
    const water = new Mesh(new BoxGeometry(280, 0.08, 280), comicToon(WATER));
    water.position.set(0, -0.2, 0);
    root.add(water);
  }

  const props = t === "harbor" || t === "beach" ? 10 : t === "city" || t === "factory" ? 8 : 6;
  for (let i = 0; i < props; i++) {
    const along = (track.totalLength * (i + 0.5)) / props;
    const s = sampleCenterline(track, along);
    const side = i % 2 === 0 ? 1 : -1;
    const dist = track.asphaltHalfWidth + track.grassWidth + 8 + (i % 3) * 4;
    const px = s.position.x + (-s.tangent.z) * dist * side;
    const pz = s.position.z + s.tangent.x * dist * side;
    const yaw = Math.atan2(s.tangent.z, s.tangent.x);

    if (t === "harbor" || t === "beach") {
      root.add(makeCrane(px, pz, yaw));
      if (i % 2 === 0) root.add(makeContainerStack(px + side * 6, pz + 4, yaw));
      if (i === 2) root.add(makeShip(px + side * 18, pz, yaw));
    } else if (t === "city" || t === "factory") {
      root.add(makeBuilding(px, pz, yaw, 4 + (i % 4) * 2));
    } else {
      root.add(makeRockOrTree(px, pz, yaw, t));
    }
  }

  // Chevron signs along concrete walls
  for (let i = 0; i < track.centerline.length - 1; i += 4) {
    if ((track.wallKind[i] ?? "concrete") !== "concrete") continue;
    const a = track.centerline[i]!;
    const b = track.centerline[i + 1]!;
    const angle = Math.atan2(b.z - a.z, b.x - a.x);
    const wallOff = track.asphaltHalfWidth + track.grassWidth + 0.7;
    for (const side of [-1, 1] as const) {
      const px = a.x + Math.sin(angle) * wallOff * side;
      const pz = a.z - Math.cos(angle) * wallOff * side;
      root.add(makeChevron(px, pz, -angle, side));
    }
  }

  return root;
}

function makeCrane(x: number, z: number, yaw: number): Group {
  const g = new Group();
  g.position.set(x, 0, z);
  g.rotation.y = yaw;
  const leg = withOutline(new BoxGeometry(1.2, 18, 1.2), comicToon(CRANE), 1.04);
  leg.position.y = 9;
  const boom = withOutline(new BoxGeometry(22, 1.1, 1.1), comicToon(CRANE), 1.04);
  boom.position.set(6, 17, 0);
  const cabin = withOutline(new BoxGeometry(3, 2.2, 2.5), comicToon(0xf8f9fa), 1.05);
  cabin.position.set(0, 16, 0);
  g.add(leg, boom, cabin);
  return g;
}

function makeContainerStack(x: number, z: number, yaw: number): Group {
  const g = new Group();
  g.position.set(x, 0, z);
  g.rotation.y = yaw;
  for (let i = 0; i < 3; i++) {
    const c = withOutline(new BoxGeometry(2.4, 2.2, 6), comicToon(CONTAINER[i % CONTAINER.length]!), 1.04);
    c.position.set((i - 1) * 0.3, 1.1 + i * 2.2, 0);
    g.add(c);
  }
  return g;
}

function makeShip(x: number, z: number, yaw: number): Group {
  const g = new Group();
  g.position.set(x, -0.1, z);
  g.rotation.y = yaw;
  const hull = withOutline(new BoxGeometry(8, 3, 28), comicToon(0x1c7ed6), 1.03);
  hull.position.y = 1.2;
  const bridge = withOutline(new BoxGeometry(5, 4, 6), comicToon(0xf8f9fa), 1.04);
  bridge.position.set(0, 4.5, -8);
  g.add(hull, bridge);
  for (let i = 0; i < 4; i++) {
    const c = withOutline(new BoxGeometry(2.2, 2, 2.2), comicToon(CONTAINER[i % CONTAINER.length]!), 1.03);
    c.position.set(((i % 2) - 0.5) * 2.5, 3.2, -2 + i * 3);
    g.add(c);
  }
  return g;
}

function makeBuilding(x: number, z: number, yaw: number, h: number): Group {
  const g = new Group();
  g.position.set(x, 0, z);
  g.rotation.y = yaw;
  const b = withOutline(new BoxGeometry(6, h, 8), comicToon(ComicPalette.concrete), 1.03);
  b.position.y = h / 2;
  const win = new Mesh(new BoxGeometry(5.2, h * 0.6, 0.2), comicToon(0x74c0fc));
  win.position.set(0, h * 0.55, 4.1);
  g.add(b, win);
  return g;
}

function makeRockOrTree(x: number, z: number, yaw: number, theme: string): Group {
  const g = new Group();
  g.position.set(x, 0, z);
  g.rotation.y = yaw;
  if (theme === "canyon" || theme === "mountain") {
    const rock = withOutline(new BoxGeometry(5, 6, 4), comicToon(0xa0785a), 1.04);
    rock.position.y = 3;
    g.add(rock);
  } else {
    const trunk = withOutline(new CylinderGeometry(0.35, 0.45, 2.5, 6), comicToon(0x6b4f2a), 1.05);
    trunk.position.y = 1.25;
    const canopy = withOutline(new BoxGeometry(3, 3, 3), comicToon(ComicPalette.grass), 1.05);
    canopy.position.y = 3.5;
    g.add(trunk, canopy);
  }
  return g;
}

function makeChevron(x: number, z: number, yaw: number, side: number): Group {
  const g = new Group();
  g.position.set(x, 1.1, z);
  g.rotation.y = yaw;
  const board = withOutline(new BoxGeometry(0.08, 0.7, 1.4), comicToon(0xffe066), 1.08);
  board.position.x = side * 0.35;
  // Simple dark chevron marks as thin boxes
  for (let i = 0; i < 3; i++) {
    const mark = new Mesh(new BoxGeometry(0.1, 0.12, 0.28), comicToon(ComicPalette.outline));
    mark.position.set(side * 0.42, 0.15 - i * 0.18, (i - 1) * 0.25 * side);
    mark.rotation.z = side * 0.5;
    g.add(mark);
  }
  // Fence top on concrete
  const post = withOutline(new BoxGeometry(0.08, 0.9, 0.08), comicToon(ComicPalette.outline), 1.05);
  post.position.set(side * 0.2, 0.85, 0);
  g.add(board, post);
  return g;
}
