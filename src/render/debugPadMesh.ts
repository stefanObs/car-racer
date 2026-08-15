import {
  CanvasTexture,
  Group,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  RepeatWrapping,
  SRGBColorSpace,
} from "three";
import { DEBUG_PAD_EXTENT_M, DEBUG_PAD_GRID_M } from "../data/debugPad";
import { ComicPaletteCss } from "./palette";

const TILE_CELLS = 5;
const TILE_M = DEBUG_PAD_GRID_M * TILE_CELLS;

/** White raster on dark asphalt — 5 m cells, thicker every 25 m. */
export function makeDebugPadGridTexture(): CanvasTexture {
  const size = 256;
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#3a3e44";
  ctx.fillRect(0, 0, size, size);
  const cell = size / TILE_CELLS;
  ctx.strokeStyle = "#f4f4f5";
  for (let i = 0; i <= TILE_CELLS; i++) {
    const p = i * cell;
    ctx.lineWidth = i === 0 || i === TILE_CELLS ? 5 : 2;
    ctx.beginPath();
    ctx.moveTo(p, 0);
    ctx.lineTo(p, size);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, p);
    ctx.lineTo(size, p);
    ctx.stroke();
  }
  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  tex.wrapS = RepeatWrapping;
  tex.wrapT = RepeatWrapping;
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  const world = DEBUG_PAD_EXTENT_M * 2;
  const repeats = world / TILE_M;
  tex.repeat.set(repeats, repeats);
  return tex;
}

/** Flat pad + origin cross so yaw/slip read against the grid. */
export function buildDebugPadGroup(): Group {
  const g = new Group();
  g.name = "debugPad";
  g.userData.debugPad = true;
  const world = DEBUG_PAD_EXTENT_M * 2;
  const geo = new PlaneGeometry(world, world);
  const map = makeDebugPadGridTexture();
  const mat = new MeshBasicMaterial({ map, color: 0xffffff });
  const mesh = new Mesh(geo, mat);
  mesh.name = "debugPadGrid";
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0;
  g.add(mesh);

  const axis = new Mesh(
    new PlaneGeometry(12, 0.35),
    new MeshBasicMaterial({ color: ComicPaletteCss.repairSpark }),
  );
  axis.rotation.x = -Math.PI / 2;
  axis.position.set(6, 0.02, 0);
  axis.name = "debugPadAxisX";
  g.add(axis);
  const zAxis = new Mesh(
    new PlaneGeometry(0.35, 12),
    new MeshBasicMaterial({ color: "#3DB9C7" }),
  );
  zAxis.rotation.x = -Math.PI / 2;
  zAxis.position.set(0, 0.02, 6);
  zAxis.name = "debugPadAxisZ";
  g.add(zAxis);
  return g;
}

export function disposeDebugPadGroup(group: Group): void {
  group.traverse((child) => {
    const mesh = child as Mesh;
    if (!mesh.isMesh) return;
    const mat = mesh.material as MeshBasicMaterial;
    mat.map?.dispose();
  });
}
