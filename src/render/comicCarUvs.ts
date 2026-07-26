/**
 * Box-projected UVs for free car GLBs that lack usable TEXCOORD_0.
 * Needed so Asphalt-Comic albedo atlases read like the Hotrod reference.
 */
import { BufferAttribute, type BufferGeometry, Vector3 } from "three";

/** True when UV attribute is missing or spans wildly outside 0..1 (broken exports). */
export function meshNeedsComicUvs(geometry: BufferGeometry): boolean {
  const uv = geometry.getAttribute("uv");
  if (!uv || uv.count < 1) return true;
  let minU = Infinity;
  let maxU = -Infinity;
  let minV = Infinity;
  let maxV = -Infinity;
  for (let i = 0; i < uv.count; i++) {
    const u = uv.getX(i);
    const v = uv.getY(i);
    minU = Math.min(minU, u);
    maxU = Math.max(maxU, u);
    minV = Math.min(minV, v);
    maxV = Math.max(maxV, v);
  }
  const spanU = maxU - minU;
  const spanV = maxV - minV;
  if (spanU < 0.05 || spanV < 0.05) return true;
  if (minU < -0.5 || minV < -0.5 || maxU > 1.5 || maxV > 1.5) return true;
  if (spanU > 4 || spanV > 4) return true;
  return false;
}

/** Planar box projection from dominant normal — stable 0..1-ish coverage. */
export function ensureComicBoxUvs(geometry: BufferGeometry, force = false): void {
  if (!force && !meshNeedsComicUvs(geometry)) return;
  if (!geometry.getAttribute("normal")) geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  const box = geometry.boundingBox;
  const pos = geometry.getAttribute("position");
  const nor = geometry.getAttribute("normal");
  if (!box || !pos || !nor) return;

  const size = new Vector3();
  box.getSize(size);
  const maxDim = Math.max(size.x, size.y, size.z, 0.001);
  const uvs = new Float32Array(pos.count * 2);

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const nx = Math.abs(nor.getX(i));
    const ny = Math.abs(nor.getY(i));
    const nz = Math.abs(nor.getZ(i));
    let u: number;
    let v: number;
    if (nx >= ny && nx >= nz) {
      u = (z - box.min.z) / maxDim;
      v = (y - box.min.y) / maxDim;
    } else if (ny >= nx && ny >= nz) {
      u = (x - box.min.x) / maxDim;
      v = (z - box.min.z) / maxDim;
    } else {
      u = (x - box.min.x) / maxDim;
      v = (y - box.min.y) / maxDim;
    }
    uvs[i * 2] = u;
    uvs[i * 2 + 1] = v;
  }
  geometry.setAttribute("uv", new BufferAttribute(uvs, 2));
}

/**
 * Cylindrical UVs fitted to the mesh: V along the longest axis, U around it.
 * For horn/tube meshes so a ring-strip keratin atlas follows the geometry.
 */
export function ensureCylinderUvs(geometry: BufferGeometry): void {
  geometry.computeBoundingBox();
  const box = geometry.boundingBox;
  const pos = geometry.getAttribute("position");
  if (!box || !pos) return;
  const size = new Vector3();
  box.getSize(size);
  const cx = (box.min.x + box.max.x) * 0.5;
  const cy = (box.min.y + box.max.y) * 0.5;
  const cz = (box.min.z + box.max.z) * 0.5;
  const axis = size.x >= size.y && size.x >= size.z ? "x" : size.y >= size.z ? "y" : "z";
  const span =
    axis === "x" ? Math.max(size.x, 0.001) : axis === "y" ? Math.max(size.y, 0.001) : Math.max(size.z, 0.001);
  const uvs = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    let along: number;
    let a: number;
    let b: number;
    if (axis === "x") {
      along = (x - box.min.x) / span;
      a = y - cy;
      b = z - cz;
    } else if (axis === "y") {
      along = (y - box.min.y) / span;
      a = x - cx;
      b = z - cz;
    } else {
      along = (z - box.min.z) / span;
      a = x - cx;
      b = y - cy;
    }
    uvs[i * 2] = Math.atan2(b, a) / (Math.PI * 2) + 0.5;
    uvs[i * 2 + 1] = along;
  }
  geometry.setAttribute("uv", new BufferAttribute(uvs, 2));
}
