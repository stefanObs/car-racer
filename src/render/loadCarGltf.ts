import {
  Box3,
  Color,
  Group,
  Mesh,
  Object3D,
  Vector3,
  type Material,
  type MeshStandardMaterial,
  type MeshToonMaterial,
} from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { CAR_IDS, type CarId } from "../data/cars";
import { CAR_MODELS, type CarModelSpec } from "../data/carModels";
import { comicToon, outlineMaterial, inflateGeometry } from "./comicMaterials";

type Template = {
  root: Object3D;
  spec: CarModelSpec;
};

const templates = new Map<CarId, Template>();
let preloadPromise: Promise<void> | null = null;

/** Load all car GLBs once (missing files are skipped — procedural fallback). */
export function preloadCarModels(): Promise<void> {
  if (preloadPromise) return preloadPromise;
  preloadPromise = (async () => {
    const loader = new GLTFLoader();
    await Promise.all(
      CAR_IDS.map(async (id) => {
        const spec = CAR_MODELS[id];
        try {
          const gltf = await loader.loadAsync(spec.url);
          const root = gltf.scene;
          normalizeCarScene(root, spec);
          templates.set(id, { root, spec });
        } catch (err) {
          console.warn(`[cars] GLB missing for ${id}, using procedural mesh.`, err);
        }
      }),
    );
  })();
  return preloadPromise;
}

export function hasGltfCar(id: CarId): boolean {
  return templates.has(id);
}

export function loadedGltfCarIds(): CarId[] {
  return [...templates.keys()];
}

/**
 * Clone a preloaded GLB, tint body paint, attach comic outline shells.
 * Returns null when no template is loaded for this id.
 */
export function cloneGltfCar(id: CarId, paint: string): Group | null {
  const hit = templates.get(id);
  if (!hit) return null;
  const clone = hit.root.clone(true);
  applyPaint(clone, paint);
  addOutlineShells(clone);
  const wrap = new Group();
  wrap.name = `gltf-${id}`;
  wrap.userData.gearClass = hit.spec.gearClass;
  wrap.userData.fromGltf = true;
  wrap.add(clone);
  return wrap;
}

function normalizeCarScene(root: Object3D, spec: CarModelSpec): void {
  stripNonMeshHelpers(root);
  root.rotation.y = spec.yaw;
  root.scale.setScalar(spec.scale);
  root.updateMatrixWorld(true);

  const box = meshBounds(root);
  const size = new Vector3();
  const center = new Vector3();
  box.getSize(size);
  box.getCenter(center);

  // Center XZ, sit on y=0
  root.position.x -= center.x;
  root.position.z -= center.z;
  root.position.y -= box.min.y;
  root.position.y += spec.y;

  // Autoscale if export is wildly off (Blender meters vs cm)
  const longest = Math.max(size.x, size.y, size.z);
  if (longest > 0.01 && (longest < 0.5 || longest > 8)) {
    const target = 3.2;
    root.scale.multiplyScalar(target / longest);
    root.updateMatrixWorld(true);
    const box2 = meshBounds(root);
    // Re-center after scale (position is not multiplied by scale in three.js)
    const c2 = new Vector3();
    box2.getCenter(c2);
    root.position.x -= c2.x;
    root.position.z -= c2.z;
    root.position.y -= box2.min.y;
    root.position.y += spec.y;
  }

  root.traverse((obj) => {
    const mesh = obj as Mesh;
    if (!mesh.isMesh) return;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    convertToComicMaterial(mesh);
  });
}

/** Free GLBs often embed lights/cameras that blow up Box3 → autoscale to dust. */
function stripNonMeshHelpers(root: Object3D): void {
  const drop: Object3D[] = [];
  root.traverse((obj) => {
    const any = obj as Object3D & { isLight?: boolean; isCamera?: boolean };
    if (obj === root) return;
    if (any.isLight || any.isCamera) drop.push(obj);
  });
  for (const obj of drop) obj.parent?.remove(obj);
}

function meshBounds(root: Object3D): Box3 {
  const box = new Box3();
  let found = false;
  root.updateMatrixWorld(true);
  root.traverse((obj) => {
    const mesh = obj as Mesh;
    if (!mesh.isMesh || !mesh.geometry) return;
    if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
    const geoBox = mesh.geometry.boundingBox;
    if (!geoBox) return;
    const world = geoBox.clone().applyMatrix4(mesh.matrixWorld);
    if (!found) {
      box.copy(world);
      found = true;
    } else {
      box.union(world);
    }
  });
  if (!found) box.setFromObject(root);
  return box;
}

function convertToComicMaterial(mesh: Mesh): void {
  const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  const next = mats.map((mat) => {
    const color = materialColor(mat);
    const name = (mat?.name ?? mesh.name ?? "").toLowerCase();
    let toon;
    if (name.includes("glass") || name.includes("window")) {
      toon = comicToon(0x10141c);
    } else if (name.includes("tire") || name.includes("rubber") || name.includes("wheel")) {
      toon = comicToon(0x1a1a1a);
    } else if (name.includes("chrome") || name.includes("metal") || name.includes("rim")) {
      toon = comicToon(0xc8ccd4);
    } else {
      toon = comicToon(color.getHex());
    }
    toon.name = mat?.name ?? mesh.name ?? "BodyPaint";
    return toon;
  });
  mesh.material = next.length === 1 ? next[0]! : next;
}

function materialColor(mat: Material | undefined): Color {
  const c = new Color(0x888888);
  if (!mat) return c;
  const anyMat = mat as MeshStandardMaterial & MeshToonMaterial;
  if (anyMat.color) c.copy(anyMat.color);
  return c;
}

function applyPaint(root: Object3D, paint: string): void {
  const paintColor = new Color(paint);
  root.traverse((obj) => {
    const mesh = obj as Mesh;
    if (!mesh.isMesh) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const mat of mats) {
      if (!mat) continue;
      const name = (mat.name ?? mesh.name ?? "").toLowerCase();
      if (!shouldApplyGaragePaint(name)) continue;
      const toon = mat as MeshToonMaterial;
      if (toon.color) toon.color.copy(paintColor);
    }
  });
}

/** Exported for unit tests — free GLBs rarely use BodyPaint. */
export function shouldApplyGaragePaint(materialOrMeshName: string): boolean {
  const name = materialOrMeshName.toLowerCase();
  if (isNonPaintMaterial(name)) return false;
  if (isBodyPaintMaterial(name)) return true;
  return !isNamedTrimMaterial(name);
}

function isBodyPaintMaterial(name: string): boolean {
  return (
    name.includes("paint") ||
    name.includes("body") ||
    name.includes("carpaint") ||
    name.includes("shell") ||
    name.includes("hull") ||
    name.includes("cab") ||
    name.includes("truck") ||
    name.includes("lambert") ||
    name === "white" ||
    name === "atlas" ||
    name === "colormap" ||
    name === "bodypaint" ||
    /^mat\d+$/.test(name)
  );
}

function isNonPaintMaterial(name: string): boolean {
  return (
    name.includes("glass") ||
    name.includes("window") ||
    name.includes("tire") ||
    name.includes("rubber") ||
    name.includes("wheel") ||
    name.includes("chrome") ||
    name.includes("light") ||
    name.includes("emit") ||
    name.includes("engine")
  );
}

/** Chassis / trim names we keep (not garage paint). */
function isNamedTrimMaterial(name: string): boolean {
  return (
    name.includes("grey") ||
    name.includes("gray") ||
    name.includes("black") ||
    name.includes("dark") ||
    name.includes("orange") || // military markers / lights
    name.includes("taillight") ||
    name.includes("headlight") ||
    name.includes("brakelight")
  );
}

function addOutlineShells(root: Object3D): void {
  const outline = outlineMaterial();
  root.traverse((obj) => {
    const mesh = obj as Mesh;
    if (!mesh.isMesh || !mesh.geometry) return;
    if (mesh.userData.outlineShell) return;
    const shell = new Mesh(inflateGeometry(mesh.geometry, 0.035), outline);
    shell.renderOrder = -1;
    shell.userData.outlineShell = true;
    mesh.add(shell);
  });
}
