/**
 * Käferkraft nose / head variants (garage cosmetics — no flat stickers).
 * Reuses kit.sticker ids: none | flames(skull) | bolt(bull) | star(starhead).
 */
import {
  Box3,
  BoxGeometry,
  ConeGeometry,
  Group,
  Mesh,
  SphereGeometry,
  Vector3,
  type MeshToonMaterial,
  type Object3D,
} from "three";
import { comicToon } from "./comicMaterials";
import { ComicPalette } from "./palette";

export type BuggyNoseId = "none" | "skull" | "bull" | "star";

export function buggyNoseFromSticker(sticker: string): BuggyNoseId {
  if (sticker === "bolt" || sticker === "lightning") return "bull";
  if (sticker === "star") return "star";
  if (sticker === "flames" || sticker === "skull") return "skull";
  return "none";
}

/** Swap front head: hide stock skull for non-skull variants; attach procedural noses. */
export function applyBuggyNoseVariant(root: Object3D, sticker: string): void {
  const variant = buggyNoseFromSticker(sticker);
  const prev = root.getObjectByName("buggyNoseVariant");
  if (prev) prev.removeFromParent();

  const skullParts = findSkullParts(root);
  const showStockSkull = variant === "skull";
  for (const m of skullParts) m.visible = showStockSkull;

  if (variant === "skull") return;

  root.updateMatrixWorld(true);
  const nose = buildNoseMesh(variant);
  nose.name = "buggyNoseVariant";
  nose.position.copy(noseAnchorLocal(root, skullParts));
  // Stock skull is ~0.4m; procedural heads need a bit of presence at the bumper
  nose.scale.setScalar(1.15);
  root.add(nose);
}

function findSkullParts(root: Object3D): Mesh[] {
  const skullParts: Mesh[] = [];
  root.traverse((obj) => {
    const mesh = obj as Mesh;
    if (!mesh.isMesh) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const m of mats) {
      const n = ((m as MeshToonMaterial)?.name ?? mesh.name ?? "").toLowerCase();
      if (n.includes("skull") || n.includes("eyered") || (n.includes("eye") && !n.includes("grey"))) {
        skullParts.push(mesh);
        break;
      }
    }
  });
  return skullParts;
}

/** Skull/nose point in `root` local space (matrix-safe). */
export function noseAnchorLocal(root: Object3D, skullParts: Mesh[]): Vector3 {
  root.updateMatrixWorld(true);
  const box = new Box3();
  if (skullParts.length > 0) {
    for (const m of skullParts) {
      if (!m.geometry.boundingBox) m.geometry.computeBoundingBox();
      if (m.geometry.boundingBox) {
        const b = m.geometry.boundingBox.clone();
        b.applyMatrix4(m.matrixWorld);
        box.union(b);
      } else {
        box.expandByObject(m);
      }
    }
  } else {
    box.setFromObject(root);
    // Fall back toward the most negative X (model forward for Käferkraft)
    const size = new Vector3();
    box.getSize(size);
    const c = new Vector3();
    box.getCenter(c);
    c.x = box.min.x + size.x * 0.08;
    root.worldToLocal(c);
    return c;
  }
  const world = new Vector3();
  box.getCenter(world);
  return root.worldToLocal(world);
}

function buildNoseMesh(variant: BuggyNoseId): Group {
  const g = new Group();
  if (variant === "none") {
    const cone = new Mesh(new ConeGeometry(0.32, 0.62, 10), comicToon(0xf1f3f5));
    cone.rotation.z = Math.PI / 2; // point along -X (Käferkraft forward)
    cone.position.x = -0.12;
    const base = new Mesh(new SphereGeometry(0.36, 12, 10), comicToon(0xe9ecef));
    g.add(base, cone);
    return g;
  }

  if (variant === "bull") {
    const head = new Mesh(new SphereGeometry(0.42, 12, 10), comicToon(0xf8f9fa));
    const snout = new Mesh(new BoxGeometry(0.36, 0.2, 0.28), comicToon(0xe9ecef));
    snout.position.set(-0.32, -0.06, 0);
    const hornL = new Mesh(new ConeGeometry(0.08, 0.48, 8), comicToon(0xadb5bd));
    hornL.position.set(-0.05, 0.34, -0.3);
    hornL.rotation.z = 0.45;
    hornL.rotation.y = 0.35;
    const hornR = new Mesh(new ConeGeometry(0.08, 0.48, 8), comicToon(0xadb5bd));
    hornR.position.set(-0.05, 0.34, 0.3);
    hornR.rotation.z = 0.45;
    hornR.rotation.y = -0.35;
    const eyeL = new Mesh(new SphereGeometry(0.08, 8, 8), comicToon(0xff1e1e, { emissive: 0xff1e1e }));
    eyeL.position.set(-0.34, 0.1, -0.14);
    const eyeR = eyeL.clone();
    eyeR.position.z = 0.14;
    g.add(head, snout, hornL, hornR, eyeL, eyeR);
    return g;
  }

  const head = new Mesh(new SphereGeometry(0.4, 12, 10), comicToon(0xf1f3f5));
  const plate = new Mesh(new BoxGeometry(0.1, 0.46, 0.46), comicToon(0x3db9c7));
  plate.position.x = -0.38;
  const spike = new Mesh(new ConeGeometry(0.14, 0.32, 5), comicToon(ComicPalette.nitroCyan));
  spike.position.set(0, 0.48, 0);
  const eyeL = new Mesh(new SphereGeometry(0.09, 8, 8), comicToon(0xffe066, { emissive: 0xffe066 }));
  eyeL.position.set(-0.36, 0.08, -0.14);
  const eyeR = eyeL.clone();
  eyeR.position.z = 0.14;
  g.add(head, plate, spike, eyeL, eyeR);
  return g;
}
