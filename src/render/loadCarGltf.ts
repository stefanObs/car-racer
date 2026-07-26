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
import { applyBuggyNoseVariant } from "./buggyNose";
import { applyCarStickers, carUsesNoseVariants } from "./carStickers";
import { comicToon, outlineMaterial, inflateGeometry } from "./comicMaterials";
import {
  atlasRoleFromName,
  carUsesAuthoredAtlas,
  comicAtlasForRole,
} from "./comicCarAtlases";
import { ensureComicBoxUvs } from "./comicCarUvs";

type Template = {
  root: Object3D;
  spec: CarModelSpec;
};

const templates = new Map<CarId, Template>();
let preloadPromise: Promise<void> | null = null;

/** Load all car GLBs once. Missing files fail boot (no procedural fallback). */
export function preloadCarModels(): Promise<void> {
  if (preloadPromise) return preloadPromise;
  preloadPromise = (async () => {
    const loader = new GLTFLoader();
    await Promise.all(
      CAR_IDS.map(async (id) => {
        const spec = CAR_MODELS[id];
        const gltf = await loader.loadAsync(spec.url);
        const root = gltf.scene;
        normalizeCarScene(root, spec);
        templates.set(id, { root, spec });
      }),
    );
  })();
  return preloadPromise;
}

export function hasGltfCar(id: CarId): boolean {
  return templates.has(id);
}

/**
 * Clone a preloaded GLB, tint body paint, bake sticker textures / buggy nose, outlines.
 * Returns null when no template is loaded for this id.
 */
export function cloneGltfCar(id: CarId, paint: string, sticker = "none"): Group | null {
  const hit = templates.get(id);
  if (!hit) return null;
  const clone = hit.root.clone(true);
  detachSharedResources(clone);
  applyPaint(clone, paint);
  applyCosmetics(clone, id, sticker);
  // Busy free-asset edges: outline shells read as black debris under wheel arches.
  addOutlineShells(clone, {
    skip: id === "kaeferkraft" || id === "bison" || id === "donnerbuechse" || id === "bunker",
  });
  const wrap = new Group();
  wrap.name = `gltf-${id}`;
  wrap.userData.gearClass = hit.spec.gearClass;
  wrap.userData.fromGltf = true;
  wrap.add(clone);
  return wrap;
}

/** three.js Object3D.clone shares materials/geometries with the template — detach before muting. */
function detachSharedResources(root: Object3D): void {
  root.traverse((obj) => {
    const mesh = obj as Mesh;
    if (!mesh.isMesh) return;
    if (mesh.geometry) mesh.geometry = mesh.geometry.clone();
    if (Array.isArray(mesh.material)) {
      mesh.material = mesh.material.map((m) => m.clone());
    } else if (mesh.material) {
      mesh.material = mesh.material.clone();
    }
  });
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
    convertToComicMaterial(mesh, spec.id);
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

function convertToComicMaterial(mesh: Mesh, carId: CarId): void {
  const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  const next = mats.map((mat) => {
    const color = materialColor(mat);
    const name = (mat?.name ?? mesh.name ?? "").toLowerCase();
    const std = mat as MeshStandardMaterial & MeshToonMaterial;
    const map = std.map ?? null;
    let toon;
    if (name.includes("glass") || name.includes("window")) {
      toon = comicToon(color.getHex());
    } else if (name.includes("tire") || name.includes("rubber") || name.includes("wheel")) {
      toon = comicToon(0x1a1a1a);
    } else if (name.includes("chrome") || name.includes("metal") || name.includes("rim")) {
      toon = comicToon(0xdce2e8);
    } else if (name.includes("eyered") || (name.includes("eye") && !name.includes("grey"))) {
      toon = comicToon(0xff1e1e);
    } else if (name.includes("skull")) {
      toon = comicToon(0xf1f3f5);
    } else if (name.includes("seat") || name === "dark") {
      toon = comicToon(0x1a1a1a);
    } else {
      toon = comicToon(color.getHex());
    }
    // Keep authored atlas maps (e.g. Sketchfab Hotrod) under cel shading.
    if (map) {
      toon.map = map;
      toon.needsUpdate = true;
    } else if (
      !carUsesAuthoredAtlas(carId) &&
      mesh.geometry &&
      !name.includes("skull") &&
      !name.includes("eyered") &&
      !(name.includes("eye") && !name.includes("grey"))
    ) {
      // Asphalt-Comic detail atlases for flat free GLBs (Hotrod excluded).
      ensureComicBoxUvs(mesh.geometry);
      const role = atlasRoleFromName(mat?.name ?? mesh.name ?? "", carId);
      const atlas = comicAtlasForRole(carId, role);
      toon.map = atlas;
      toon.userData.comicTintable = role === "body" || role === "armor";
      toon.needsUpdate = true;
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

function applyCosmetics(root: Object3D, id: CarId, sticker: string): void {
  if (carUsesNoseVariants(id)) {
    applyBuggyNoseVariant(root, sticker);
    return;
  }
  applyCarStickers(root, id, sticker);
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
      if (!toon.color) continue;
      // Full-color authored atlases (Hotrod): keep white so map reads true.
      // Tintable comic detail maps: multiply garage paint through white+ink atlas.
      if (toon.map) {
        if (toon.userData?.comicTintable) {
          toon.color.copy(paintColor);
        } else {
          toon.color.setRGB(1, 1, 1);
        }
        continue;
      }
      toon.color.copy(paintColor);
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
    name.includes("engine") ||
    name.includes("skull") ||
    name.includes("eyered") ||
    name.includes("eye") ||
    name.includes("seat") ||
    name === "dark"
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

function addOutlineShells(root: Object3D, opts?: { skip?: boolean }): void {
  if (opts?.skip) return;
  const outline = outlineMaterial();
  root.traverse((obj) => {
    const mesh = obj as Mesh;
    if (!mesh.isMesh || !mesh.geometry) return;
    if (mesh.userData.outlineShell) return;
    // Tiny free-asset shards look like floating debris when outlined.
    if (!mesh.geometry.boundingSphere) mesh.geometry.computeBoundingSphere();
    const r = mesh.geometry.boundingSphere?.radius ?? 1;
    if (r < 0.08) return;
    const shell = new Mesh(inflateGeometry(mesh.geometry, 0.035), outline);
    shell.renderOrder = -1;
    shell.userData.outlineShell = true;
    mesh.add(shell);
  });
}
