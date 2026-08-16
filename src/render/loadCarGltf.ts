import {
  Box3,
  Color,
  Group,
  Mesh,
  NearestFilter,
  Object3D,
  Vector3,
  type Material,
  type MeshStandardMaterial,
  type MeshToonMaterial,
  type Texture,
} from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { CAR_IDS, carUsesNoseVariants, type CarId } from "../data/cars";
import { CAR_MODELS, type CarModelSpec } from "../data/carModels";
import { applyBuggyNoseVariant, isBuggySkullHornMesh } from "./buggyNose";
import { buggyNoseTexture } from "./buggyNoseTextures";
import { applyCarStickers } from "./carStickers";
import { comicToon, outlineMaterial, inflateGeometry } from "./comicMaterials";
import { ComicPalette } from "./palette";
import {
  atlasRoleFromName,
  carUsesAuthoredAtlas,
  comicAtlasForRole,
} from "./comicCarAtlases";
import { ensureComicBoxUvs, ensureNoseOrnamentUvs } from "./comicCarUvs";
import {
  bakeAuthoredBlueToPaint,
  bakeAuthoredGreenToPaint,
  bakeAuthoredOrangeToPaint,
  bakeAuthoredRedToPaint,
  bakeAuthoredWhiteToPaint,
  isWheelPaintVertex,
} from "./paintAuthoredWhite";
import { wheelContactMinY, hasAuthoredStockWheels } from "./stockWheels";
import { APP_VERSION } from "../core/version";

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
        const gltf = await loader.loadAsync(`${spec.url}?v=${APP_VERSION}`);
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
  applyPaint(clone, paint, id);
  applyCosmetics(clone, id, sticker);
  // Busy free-asset edges: outline shells read as black debris under wheel arches.
  addOutlineShells(clone, {
    skip:
      id === "blitz" ||
      id === "kaeferkraft" ||
      id === "bison" ||
      id === "donnerbuechse" ||
      id === "bunker",
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

  // Re-sit on tire contact (skirts / splitters must not define the ground plane).
  root.updateMatrixWorld(true);
  {
    const tireY = wheelContactMinY(root);
    if (tireY != null && Number.isFinite(tireY) && Math.abs(tireY) > 1e-4) {
      root.position.y -= tireY;
      root.updateMatrixWorld(true);
    }
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
  const roofLamp = carId === "kaeferkraft" && isKaeferkraftRoofLampMesh(mesh);
  const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  const meshNameLower = (mesh.name ?? "").toLowerCase();
  const stockWheel = meshNameLower.startsWith("stockwheel_") || mesh.userData.isStockWheel === true;
  const next = mats.map((mat) => {
    const color = materialColor(mat);
    // Prefer mesh name for StockWheel_* — cloned mats keep "BodyPaint" and would stay red.
    const matName = (mat?.name ?? "").toLowerCase();
    const name = stockWheel ? `${meshNameLower} tire` : matName || meshNameLower;
    const std = mat as MeshStandardMaterial & MeshToonMaterial;
    const map = std.map ?? null;
    const isBumperLamp =
      name.includes("eyered") || (name.includes("eye") && !name.includes("grey"));
    const isHeadlamp = roofLamp || isBumperLamp;
    const isHornMat =
      name.includes("skullhorn") ||
      (carId === "kaeferkraft" &&
        (name === "dark" || name.includes("dark")) &&
        isBuggySkullHornMesh(mesh));
    let toon;
    if (stockWheel || name.includes("tire") || name.includes("rubber") || name.includes("hubcap") || name.includes("wheel")) {
      // Prefer authored Tripo tire atlases; flat rubber only when no map shipped.
      toon = map ? comicToon(0xffffff) : comicToon(ComicPalette.tire);
    } else if (name.includes("glass") || name.includes("window")) {
      toon = comicToon(color.getHex());
    } else if (isHeadlamp) {
      // Bumper EyeRed + roll-cage pods — same sealed-beam look.
      toon = comicToon(0xfff8e8);
    } else if (name.includes("chrome") || name.includes("metal") || name.includes("rim")) {
      toon = comicToon(0xdce2e8);
    } else if (isHornMat) {
      // Silhouette mesh UVs authored by reshape-buggy-skull-horns.mjs (match horn PNG).
      toon = comicToon(0xffffff);
      const hornMap = buggyNoseTexture("skullHorn");
      if (hornMap) {
        toon.map = hornMap;
        toon.needsUpdate = true;
      }
    } else if (name.includes("skull")) {
      // Bone skull ornament — comic albedo (YZ UVs; authored UVs are atlas-scrap).
      toon = comicToon(0xffffff);
      if (mesh.geometry) {
        if (!mesh.userData.keepAuthoredUvs && !mesh.name.toLowerCase().includes("skullhornknuckle")) {
          ensureNoseOrnamentUvs(mesh.geometry);
        }
        const skullMap = buggyNoseTexture("skull");
        if (skullMap) {
          toon.map = skullMap;
          toon.needsUpdate = true;
        }
      }
    } else if (name.includes("seat") || name === "dark") {
      toon = comicToon(0x3a3a42);
    } else {
      toon = comicToon(color.getHex());
    }
    const skullOrnament = isHornMat || name.includes("skull");
    const tireMesh = stockWheel || name.includes("tire") || name.includes("rubber") || name.includes("hubcap");
    // Keep authored atlas maps (Tripo bake / tire islands / leftover free-asset maps) under cel shading.
    if (map && !skullOrnament) {
      map.magFilter = NearestFilter;
      map.minFilter = NearestFilter;
      map.generateMipmaps = false;
      map.needsUpdate = true;
      toon.map = map;
      toon.needsUpdate = true;
    } else if (!tireMesh && !carUsesAuthoredAtlas(carId) && mesh.geometry && !skullOrnament && !toon.map) {
      ensureComicBoxUvs(mesh.geometry);
      const role = isHeadlamp ? "headlight" : atlasRoleFromName(mat?.name ?? mesh.name ?? "", carId);
      const atlas = comicAtlasForRole(carId, role);
      toon.map = atlas;
      toon.userData.comicTintable = role === "body" || role === "armor";
      toon.needsUpdate = true;
    }
    toon.name = isHeadlamp
      ? "Headlight"
      : isHornMat
        ? "SkullHorn"
        : name.includes("skull")
          ? "Skull"
          : tireMesh || stockWheel
            ? "Tire"
            : (mat?.name ?? mesh.name ?? "BodyPaint");
    if (typeof std.side === "number") toon.side = std.side;
    return toon;
  });
  mesh.material = next.length === 1 ? next[0]! : next;
}

/**
 * Käferkraft twin pods on the front roll bar (authored as Chrome).
 * Geometry cue: high Y, forward X, left/right of center, compact blob.
 */
export function isKaeferkraftRoofLampMesh(mesh: Mesh): boolean {
  if (!mesh.geometry) return false;
  if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
  const b = mesh.geometry.boundingBox;
  if (!b) return false;
  const cx = (b.min.x + b.max.x) * 0.5;
  const cy = (b.min.y + b.max.y) * 0.5;
  const cz = (b.min.z + b.max.z) * 0.5;
  const sx = b.max.x - b.min.x;
  const sy = b.max.y - b.min.y;
  const sz = b.max.z - b.min.z;
  const longest = Math.max(sx, sy, sz);
  const shortest = Math.min(sx, sy, sz);
  return (
    cy > 0.52 &&
    cx < -0.2 &&
    cx > -0.7 &&
    Math.abs(cz) > 0.1 &&
    longest < 0.36 &&
    shortest > 0.015
  );
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

export function collectWheelUvTriangles(root: Object3D): number[] {
  // Authored StockWheel_* use a separate Tire atlas — their UVs (and leftover
  // wheel-well verts on BodyPaint) must not mask the body paint bake.
  if (hasAuthoredStockWheels(root)) return [];

  const tris: number[] = [];
  root.updateMatrixWorld(true);
  const box = new Box3().setFromObject(root);
  const size = new Vector3();
  box.getSize(size);
  const bounds = {
    minY: box.min.y,
    height: size.y,
    maxAbsX: Math.max(Math.abs(box.min.x), Math.abs(box.max.x)),
  };
  const a = new Vector3();
  const b = new Vector3();
  const c = new Vector3();
  root.traverse((obj) => {
    const mesh = obj as Mesh;
    if (!mesh.isMesh || !mesh.geometry) return;
    const geo = mesh.geometry;
    const pos = geo.attributes.position;
    const uv = geo.attributes.uv;
    if (!pos || !uv) return;
    const wholeWheel = Boolean(mesh.name) && !shouldApplyGaragePaint(mesh.name);
    const index = geo.index;
    const triCount = index ? index.count / 3 : Math.floor(pos.count / 3);
    const vert = (t: number, k: number) => (index ? index.getX(t * 3 + k) : t * 3 + k);
    for (let t = 0; t < triCount; t++) {
      const i0 = vert(t, 0);
      const i1 = vert(t, 1);
      const i2 = vert(t, 2);
      a.fromBufferAttribute(pos, i0).applyMatrix4(mesh.matrixWorld);
      b.fromBufferAttribute(pos, i1).applyMatrix4(mesh.matrixWorld);
      c.fromBufferAttribute(pos, i2).applyMatrix4(mesh.matrixWorld);
      if (
        !wholeWheel &&
        !(
          isWheelPaintVertex(a.x, a.y, a.z, bounds) &&
          isWheelPaintVertex(b.x, b.y, b.z, bounds) &&
          isWheelPaintVertex(c.x, c.y, c.z, bounds)
        )
      ) {
        continue;
      }
      tris.push(uv.getX(i0), uv.getY(i0), uv.getX(i1), uv.getY(i1), uv.getX(i2), uv.getY(i2));
    }
  });
  return tris;
}

function applyPaint(root: Object3D, paint: string, carId?: CarId): void {
  const paintColor = new Color(paint);
  const replaced = new Map<Texture, Texture>();
  const skipUvTris = collectWheelUvTriangles(root);
  root.traverse((obj) => {
    const mesh = obj as Mesh;
    if (!mesh.isMesh) return;
    if (mesh.name && !shouldApplyGaragePaint(mesh.name)) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const mat of mats) {
      if (!mat) continue;
      const name = (mat.name ?? mesh.name ?? "").toLowerCase();
      if (!shouldApplyGaragePaint(name)) continue;
      const toon = mat as MeshToonMaterial;
      if (!toon.color) continue;

      if (toon.map) {
        const baker = authoredBodyPaintBaker(carId);
        if (baker && !toon.userData?.comicTintable) {
          const prev = toon.map;
          const hit = replaced.get(prev);
          if (hit) {
            toon.map = hit;
          } else {
            const next = baker(prev, paint, skipUvTris);
            replaced.set(prev, next);
            toon.map = next;
          }
          toon.color.setRGB(1, 1, 1);
          toon.needsUpdate = true;
          continue;
        }
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

function authoredBodyPaintBaker(
  carId: CarId | undefined,
): ((map: Texture, paint: string, wheelUvTris?: ArrayLike<number>) => Texture) | null {
  if (carId === "blitz") return bakeAuthoredRedToPaint;
  if (carId === "bison") return bakeAuthoredGreenToPaint;
  if (carId === "kaeferkraft") return bakeAuthoredOrangeToPaint;
  if (carId === "donnerbuechse") return bakeAuthoredBlueToPaint;
  if (carId === "bunker") return bakeAuthoredWhiteToPaint;
  return null;
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
    name.includes("stockwheel") ||
    name.includes("spoiler") ||
    name.includes("rim") ||
    name.includes("hubcap") ||
    name.includes("chrome") ||
    name.includes("light") ||
    name.includes("emit") ||
    name.includes("engine") ||
    name.includes("skull") ||
    name.includes("eyered") ||
    name.includes("headlight") ||
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
    // Horn roots must blend into the skull — an ink shell draws a hard “stuck-on” ring.
    const matName = (
      Array.isArray(mesh.material)
        ? mesh.material.map((m) => m?.name ?? "").join(" ")
        : (mesh.material?.name ?? "")
    ).toLowerCase();
    const meshName = mesh.name.toLowerCase();
    if (
      matName.includes("skullhorn") ||
      meshName.includes("skullhorn") ||
      meshName.includes("skullhornknuckle")
    ) {
      return;
    }
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
