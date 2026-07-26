import {
  BackSide,
  Color,
  DataTexture,
  Mesh,
  MeshBasicMaterial,
  MeshToonMaterial,
  NearestFilter,
  RGBAFormat,
  type BufferGeometry,
  type Material,
  type Object3D,
} from "three";
import { ComicPalette } from "./palette";

let sharedGradient: DataTexture | null = null;
let sharedOutlineMat: MeshBasicMaterial | null = null;

/** 4-step cel gradient for harder comic shading. */
export function toonGradient(): DataTexture {
  if (sharedGradient) return sharedGradient;
  const data = new Uint8Array([
    55, 55, 60, 255, 110, 110, 118, 255, 175, 175, 182, 255, 255, 255, 255, 255,
  ]);
  const tex = new DataTexture(data, 4, 1, RGBAFormat);
  tex.minFilter = NearestFilter;
  tex.magFilter = NearestFilter;
  tex.needsUpdate = true;
  sharedGradient = tex;
  return tex;
}

export function comicToon(
  color: string | number,
  opts?: { emissive?: number; emissiveIntensity?: number; map?: import("three").Texture },
): MeshToonMaterial {
  const mat = new MeshToonMaterial({
    color: new Color(color),
    gradientMap: toonGradient(),
    map: opts?.map ?? null,
  });
  if (opts?.emissive !== undefined) {
    mat.emissive = new Color(opts.emissive);
    mat.emissiveIntensity = opts.emissiveIntensity ?? 0.4;
  }
  return mat;
}

export function outlineMaterial(): MeshBasicMaterial {
  if (sharedOutlineMat) return sharedOutlineMat;
  sharedOutlineMat = new MeshBasicMaterial({
    color: ComicPalette.outline,
    side: BackSide,
  });
  return sharedOutlineMat;
}

/** Expand geometry along normals for thick comic ink outlines. */
export function inflateGeometry(geometry: BufferGeometry, amount: number): BufferGeometry {
  const geo = geometry.index ? geometry.toNonIndexed() : geometry.clone();
  geo.computeVertexNormals();
  const pos = geo.attributes.position;
  const nor = geo.attributes.normal;
  if (!pos || !nor) return geo;
  for (let i = 0; i < pos.count; i++) {
    pos.setXYZ(
      i,
      pos.getX(i) + nor.getX(i) * amount,
      pos.getY(i) + nor.getY(i) * amount,
      pos.getZ(i) + nor.getZ(i) * amount,
    );
  }
  pos.needsUpdate = true;
  return geo;
}

/** Thick comic outline as back-face inflated shell. */
export function withOutline(geometry: BufferGeometry, fill: Material, thickness = 0.038): Mesh {
  const mesh = new Mesh(geometry, fill);
  const shell = new Mesh(inflateGeometry(geometry, thickness), outlineMaterial());
  shell.renderOrder = -1;
  mesh.add(shell);
  return mesh;
}

export function disposeObject(obj: Object3D): void {
  const seenGeo = new Set<BufferGeometry>();
  const seenMat = new Set<Material>();
  obj.traverse((child) => {
    const mesh = child as Mesh;
    if (!mesh.isMesh) return;
    if (mesh.geometry && !seenGeo.has(mesh.geometry)) {
      seenGeo.add(mesh.geometry);
      mesh.geometry.dispose();
    }
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const m of mats) {
      if (!m || m === sharedOutlineMat || seenMat.has(m)) continue;
      seenMat.add(m);
      m.dispose();
    }
  });
}
