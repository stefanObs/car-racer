import {
  CircleGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  SphereGeometry,
  TorusGeometry,
} from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import type { CarState } from "../sim/vehicle";
import { buildCarOverlays } from "./carOverlays";
import { comicToon, withOutline } from "./comicMaterials";
import { ComicPalette } from "./palette";

export type ComicCarParts = {
  root: Group;
  body: Mesh;
  smoke: Group;
  sparks: Group;
  nitro: Group;
};

/** Sculpted Asphalt-Comic sports car — rounded volumes + ink overlays. */
export function buildComicCar(car: CarState): ComicCarParts {
  const root = new Group();
  const paint = comicToon(car.paint);
  const paintShade = comicToon(shadePaint(car.paint));
  const dark = comicToon(ComicPalette.cabin);
  const glass = comicToon(0x12151c);

  const blob = new Mesh(
    new CircleGeometry(1.35, 20),
    new MeshBasicMaterial({ color: 0x1b1b1f, transparent: true, opacity: 0.35 }),
  );
  blob.rotation.x = -Math.PI / 2;
  blob.position.y = 0.03;
  root.add(blob);

  const body = withOutline(new RoundedBoxGeometry(1.65, 0.42, 2.55, 5, 0.2), paint, 0.065);
  body.position.set(0, 0.52, 0.08);

  const belly = withOutline(new RoundedBoxGeometry(1.55, 0.28, 2.35, 5, 0.18), paintShade, 0.05);
  belly.position.set(0, 0.34, 0.05);

  const nose = withOutline(new SphereGeometry(0.55, 14, 12), paint, 0.055);
  nose.scale.set(1.35, 0.55, 1.1);
  nose.position.set(0, 0.48, 1.45);

  const tail = withOutline(new SphereGeometry(0.62, 14, 12), paint, 0.055);
  tail.scale.set(1.4, 0.58, 0.9);
  tail.position.set(0, 0.5, -1.25);

  const cabin = withOutline(new SphereGeometry(0.72, 14, 12), glass, 0.06);
  cabin.scale.set(1.05, 0.72, 1.15);
  cabin.position.set(0, 0.95, -0.05);

  const roof = withOutline(new RoundedBoxGeometry(0.95, 0.08, 0.85, 3, 0.06), dark, 0.045);
  roof.position.set(0, 1.28, -0.08);

  const wing = withOutline(new RoundedBoxGeometry(1.7, 0.09, 0.4, 3, 0.05), dark, 0.07);
  wing.position.set(0, 1.28, -1.22);
  const standL = withOutline(new CylinderGeometry(0.05, 0.06, 0.42, 8), dark, 0.04);
  standL.position.set(-0.58, 1.05, -1.12);
  const standR = withOutline(new CylinderGeometry(0.05, 0.06, 0.42, 8), dark, 0.04);
  standR.position.set(0.58, 1.05, -1.12);

  const diffuser = withOutline(new RoundedBoxGeometry(1.2, 0.18, 0.35, 2, 0.05), dark, 0.045);
  diffuser.position.set(0, 0.28, -1.55);
  const exGeo = new CylinderGeometry(0.09, 0.1, 0.2, 10);
  const exL = withOutline(exGeo, comicToon(0x9aa0a6), 0.035);
  exL.rotation.x = Math.PI / 2;
  exL.position.set(-0.2, 0.28, -1.72);
  const exR = withOutline(exGeo.clone(), comicToon(0x9aa0a6), 0.035);
  exR.rotation.x = Math.PI / 2;
  exR.position.set(0.2, 0.28, -1.72);

  const lightMat = comicToon(0xff2a2a, { emissive: 0xff2a2a, emissiveIntensity: 0.6 });
  for (const lx of [-0.48, -0.3, 0.3, 0.48] as const) {
    const light = withOutline(new SphereGeometry(0.09, 12, 12), lightMat, 0.03);
    light.position.set(lx, 0.58, -1.5);
    root.add(light);
  }

  const headMat = comicToon(0xfff6d8, { emissive: 0xffe066, emissiveIntensity: 0.4 });
  for (const lx of [-0.52, 0.52] as const) {
    const head = withOutline(new SphereGeometry(0.12, 12, 12), headMat, 0.03);
    head.position.set(lx, 0.5, 1.78);
    root.add(head);
  }

  for (const [wx, wz] of [
    [-0.78, 0.92],
    [0.78, 0.92],
    [-0.78, -1.02],
    [0.78, -1.02],
  ] as const) {
    const tire = withOutline(new TorusGeometry(0.36, 0.14, 10, 20), comicToon(ComicPalette.tire), 0.045);
    tire.rotation.y = Math.PI / 2;
    tire.position.set(wx, 0.36, wz);
    const rim = new Mesh(new CylinderGeometry(0.2, 0.2, 0.18, 12), comicToon(0xd8dce4));
    rim.rotation.z = Math.PI / 2;
    rim.position.set(wx, 0.36, wz);
    root.add(tire, rim);
  }

  const overlays = buildCarOverlays({
    paint: car.paint,
    sticker: car.sticker || "none",
    variant: car.id,
  });

  const smoke = new Group();
  for (let i = 0; i < 6; i++) {
    const puff = new Mesh(new SphereGeometry(0.22 + i * 0.05, 10, 10), comicToon(ComicPalette.smoke));
    puff.visible = false;
    smoke.add(puff);
  }
  const sparks = new Group();
  for (let i = 0; i < 8; i++) {
    const spark = new Mesh(
      new SphereGeometry(0.07, 6, 6),
      comicToon(ComicPalette.repairSpark, { emissive: ComicPalette.repairSpark }),
    );
    spark.visible = false;
    sparks.add(spark);
  }
  const nitro = new Group();
  for (let i = 0; i < 5; i++) {
    const trail = new Mesh(
      new SphereGeometry(0.16, 8, 8),
      comicToon(i % 2 === 0 ? ComicPalette.nitroOrange : ComicPalette.nitroCyan, {
        emissive: i % 2 === 0 ? ComicPalette.nitroOrange : ComicPalette.nitroCyan,
        emissiveIntensity: 0.65,
      }),
    );
    trail.scale.set(1, 0.7, 1.6 + i * 0.2);
    trail.position.set((i - 2) * 0.12, 0.34, -1.8 - i * 0.28);
    trail.visible = false;
    nitro.add(trail);
  }

  root.add(body, belly, nose, tail, cabin, roof, wing, standL, standR, diffuser, exL, exR, overlays, smoke, sparks, nitro);
  return { root, body, smoke, sparks, nitro };
}

function shadePaint(paint: string): number {
  try {
    const c = Number.parseInt(paint.replace("#", ""), 16);
    if (!Number.isFinite(c)) return 0x7a1f1f;
    const r = Math.max(0, ((c >> 16) & 255) - 45);
    const g = Math.max(0, ((c >> 8) & 255) - 45);
    const b = Math.max(0, (c & 255) - 45);
    return (r << 16) | (g << 8) | b;
  } catch {
    return 0x7a1f1f;
  }
}
