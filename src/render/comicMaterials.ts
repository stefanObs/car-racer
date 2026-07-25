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

/** 3-step cel gradient for MeshToonMaterial. */
export function toonGradient(): DataTexture {
  if (sharedGradient) return sharedGradient;
  const data = new Uint8Array([70, 70, 75, 255, 150, 150, 155, 255, 255, 255, 255, 255]);
  const tex = new DataTexture(data, 3, 1, RGBAFormat);
  tex.minFilter = NearestFilter;
  tex.magFilter = NearestFilter;
  tex.needsUpdate = true;
  sharedGradient = tex;
  return tex;
}

export function comicToon(color: string | number, opts?: { emissive?: number }): MeshToonMaterial {
  const mat = new MeshToonMaterial({
    color: new Color(color),
    gradientMap: toonGradient(),
  });
  if (opts?.emissive !== undefined) {
    mat.emissive = new Color(opts.emissive);
    mat.emissiveIntensity = 0.35;
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

/** Thick comic outline as slightly larger back-face shell. */
export function withOutline(geometry: BufferGeometry, fill: Material, scale = 1.07): Mesh {
  const mesh = new Mesh(geometry, fill);
  const shell = new Mesh(geometry, outlineMaterial());
  shell.scale.setScalar(scale);
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
