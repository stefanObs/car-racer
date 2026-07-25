import { BoxGeometry, CylinderGeometry, Group, Mesh, SphereGeometry } from "three";
import type { CarState } from "../sim/vehicle";
import { comicToon, withOutline } from "./comicMaterials";
import { ComicPalette } from "./palette";

export type ComicCarParts = {
  root: Group;
  body: Mesh;
  smoke: Group;
  sparks: Group;
  nitro: Group;
};

/** Low sports-car silhouette matching Asphalt-Comic reference (rear chase readable). */
export function buildComicCar(car: CarState): ComicCarParts {
  const root = new Group();
  const paint = comicToon(car.paint);
  const dark = comicToon(ComicPalette.cabin);
  const glass = comicToon(0x151820);

  // Main body — wide, low
  const body = withOutline(new BoxGeometry(1.55, 0.42, 2.55), paint, 1.1);
  body.position.set(0, 0.48, 0.05);

  // Hood taper
  const hood = withOutline(new BoxGeometry(1.4, 0.28, 0.7), paint, 1.1);
  hood.position.set(0, 0.42, 1.35);
  hood.rotation.x = -0.12;

  // Rear haunches
  const rear = withOutline(new BoxGeometry(1.6, 0.38, 0.55), paint, 1.1);
  rear.position.set(0, 0.46, -1.15);

  // Cabin / canopy
  const cabin = withOutline(new BoxGeometry(1.15, 0.42, 1.05), glass, 1.12);
  cabin.position.set(0, 0.82, -0.05);

  // Roof stripe shade step
  const roof = withOutline(new BoxGeometry(1.05, 0.08, 0.9), dark, 1.1);
  roof.position.set(0, 1.05, -0.08);

  // Big rear spoiler (reference signature)
  const spoilerBlade = withOutline(new BoxGeometry(1.55, 0.1, 0.38), dark, 1.14);
  spoilerBlade.position.set(0, 1.12, -1.15);
  const spoilerL = withOutline(new BoxGeometry(0.1, 0.35, 0.12), dark, 1.12);
  spoilerL.position.set(-0.65, 0.95, -1.1);
  const spoilerR = withOutline(new BoxGeometry(0.1, 0.35, 0.12), dark, 1.12);
  spoilerR.position.set(0.65, 0.95, -1.1);

  // Diffuser + exhausts
  const diffuser = withOutline(new BoxGeometry(1.2, 0.18, 0.35), dark, 1.1);
  diffuser.position.set(0, 0.28, -1.45);
  const exL = withOutline(new CylinderGeometry(0.08, 0.08, 0.2, 8), comicToon(0x888888), 1.1);
  exL.rotation.x = Math.PI / 2;
  exL.position.set(-0.18, 0.28, -1.62);
  const exR = withOutline(new CylinderGeometry(0.08, 0.08, 0.2, 8), comicToon(0x888888), 1.1);
  exR.rotation.x = Math.PI / 2;
  exR.position.set(0.18, 0.28, -1.62);

  // Quad taillights
  const lightMat = comicToon(0xff2d2d, { emissive: 0xff2d2d });
  for (const [lx, ly] of [
    [-0.45, 0.55],
    [-0.28, 0.55],
    [0.28, 0.55],
    [0.45, 0.55],
  ] as const) {
    const light = withOutline(new CylinderGeometry(0.07, 0.07, 0.06, 8), lightMat, 1.15);
    light.rotation.x = Math.PI / 2;
    light.position.set(lx, ly, -1.42);
    root.add(light);
  }

  // Wheels
  for (const [wx, wz] of [
    [-0.78, 0.85],
    [0.78, 0.85],
    [-0.78, -0.95],
    [0.78, -0.95],
  ] as const) {
    const wheel = withOutline(new CylinderGeometry(0.36, 0.36, 0.32, 12), comicToon(ComicPalette.tire), 1.12);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(wx, 0.36, wz);
    const rim = new Mesh(new CylinderGeometry(0.18, 0.18, 0.34, 8), comicToon(0xc0c4cc));
    rim.rotation.z = Math.PI / 2;
    rim.position.copy(wheel.position);
    root.add(wheel, rim);
  }

  // Side skirt shade
  const skirtL = withOutline(new BoxGeometry(0.08, 0.2, 2.2), dark, 1.08);
  skirtL.position.set(-0.82, 0.32, 0);
  const skirtR = withOutline(new BoxGeometry(0.08, 0.2, 2.2), dark, 1.08);
  skirtR.position.set(0.82, 0.32, 0);

  if (car.sticker && car.sticker !== "none") {
    const stickerColor =
      car.sticker === "flames"
        ? ComicPalette.nitroOrange
        : car.sticker === "bolt"
          ? ComicPalette.repairSpark
          : ComicPalette.nitroCyan;
    const sticker = new Mesh(new BoxGeometry(0.06, 0.35, 1.2), comicToon(stickerColor));
    sticker.position.set(0.82, 0.55, 0.15);
    root.add(sticker);
  }

  const smoke = new Group();
  for (let i = 0; i < 6; i++) {
    const puff = new Mesh(new SphereGeometry(0.2 + i * 0.05, 8, 8), comicToon(ComicPalette.smoke));
    puff.visible = false;
    smoke.add(puff);
  }
  const sparks = new Group();
  for (let i = 0; i < 8; i++) {
    const spark = new Mesh(
      new BoxGeometry(0.09, 0.09, 0.09),
      comicToon(ComicPalette.repairSpark, { emissive: ComicPalette.repairSpark }),
    );
    spark.visible = false;
    sparks.add(spark);
  }
  const nitro = new Group();
  for (let i = 0; i < 5; i++) {
    const trail = new Mesh(
      new BoxGeometry(0.22, 0.14, 0.65),
      comicToon(i % 2 === 0 ? ComicPalette.nitroOrange : ComicPalette.nitroCyan, {
        emissive: i % 2 === 0 ? ComicPalette.nitroOrange : ComicPalette.nitroCyan,
      }),
    );
    trail.position.set((i - 2) * 0.14, 0.32, -1.7 - i * 0.28);
    trail.visible = false;
    nitro.add(trail);
  }

  root.add(
    body,
    hood,
    rear,
    cabin,
    roof,
    spoilerBlade,
    spoilerL,
    spoilerR,
    diffuser,
    exL,
    exR,
    skirtL,
    skirtR,
    smoke,
    sparks,
    nitro,
  );
  return { root, body, smoke, sparks, nitro };
}
