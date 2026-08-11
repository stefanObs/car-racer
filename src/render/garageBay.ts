import {
  BoxGeometry,
  CircleGeometry,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  PointLight,
  type Texture,
} from "three";
import { GARAGE_HERO, GARAGE_STOCK, type GaragePropId } from "../data/garageProps";
import { comicFlat, comicToon, withOutline } from "./comicMaterials";
import {
  floorTexture,
  hazardChevronTexture,
  posterTexture,
  skyPeekTexture,
  sloganPosterTexture,
  turntableTexture,
  wallPanelTexture,
} from "./garageTextures";
import {
  buildGarageGasBottles,
  buildGarageHoist,
  buildGarageToolChest,
} from "./garageHeroProps";
import { cloneGarageProp } from "./loadGarageGltf";
import { ComicPalette } from "./palette";

/** Turntable center — car sits here; workshop props stay off this disc. */
export const GARAGE_PAD_CENTER = { x: 1.5, y: 0.04, z: 0 } as const;
export const GARAGE_PAD_RADIUS = 4.5;

/** Stock and heroes must sit outside this disc (plus a small clearance). */
export function isOutsideGaragePad(x: number, z: number, margin = 0.35): boolean {
  const dx = x - GARAGE_PAD_CENTER.x;
  const dz = z - GARAGE_PAD_CENTER.z;
  return Math.hypot(dx, dz) > GARAGE_PAD_RADIUS + margin;
}

function mapped(map: Texture, fallback = 0xffffff) {
  return comicFlat(fallback, { map });
}

/** Bright Asphalt-Comic tuner garage — concept + car-targets workshop. */
export function buildGarageBay(): Group {
  const g = new Group();
  g.name = "garageBay";

  const keyFill = new PointLight(0xfff4e0, 3.2, 32, 1.2);
  keyFill.position.set(1.5, 7.2, 2);
  const rimFill = new PointLight(0xc8e4ff, 1.8, 24, 1.4);
  rimFill.position.set(-6, 5.5, 6);
  const doorFill = new PointLight(0xffe8a8, 2.4, 20, 1.3);
  doorFill.position.set(10, 5, 8);
  g.add(keyFill, rimFill, doorFill);

  const floor = new Mesh(new PlaneGeometry(28, 30), mapped(floorTexture(), 0xc5c9ce));
  floor.rotation.x = -Math.PI / 2;
  g.add(floor);

  g.add(buildTurntable());
  g.add(buildParkingBox());

  for (let i = 0; i < 10; i++) {
    const tile = new Mesh(
      new PlaneGeometry(1.15, 1.15),
      comicFlat(i % 2 === 0 ? ComicPalette.outline : 0xf8f9fa),
    );
    tile.rotation.x = -Math.PI / 2;
    tile.position.set(-3.2 + i * 1.15, 0.08, 8.2);
    g.add(tile);
  }

  const back = withOutline(new BoxGeometry(26, 11, 0.4), mapped(wallPanelTexture(1), 0xd8dce1), 0.05);
  back.position.set(1, 5.5, -11);
  const left = withOutline(new BoxGeometry(0.4, 11, 24), mapped(wallPanelTexture(2), 0xced3d8), 0.05);
  left.position.set(-11.5, 5.5, 0);
  const right = withOutline(new BoxGeometry(0.4, 11, 24), mapped(wallPanelTexture(3), 0xced3d8), 0.05);
  right.position.set(12.5, 5.5, 0);
  const ceiling = new Mesh(new BoxGeometry(28, 0.25, 26), comicFlat(0x5c636a));
  ceiling.position.set(1, 10.15, 0);
  g.add(back, left, right, ceiling);

  const wallStripe = new Mesh(
    new PlaneGeometry(24, 0.9),
    mapped(hazardChevronTexture(), ComicPalette.repairSpark),
  );
  wallStripe.position.set(1, 3.55, -10.72);
  g.add(wallStripe);

  const doorL = withOutline(new BoxGeometry(0.5, 8, 0.5), comicFlat(0x8b9098), 0.04);
  doorL.position.set(8.5, 4, 11.2);
  const doorR = withOutline(new BoxGeometry(0.5, 8, 0.5), comicFlat(0x8b9098), 0.04);
  doorR.position.set(12, 4, 11.2);
  const doorTop = withOutline(new BoxGeometry(4.2, 0.5, 0.5), comicFlat(0xa8adb4), 0.04);
  doorTop.position.set(10.25, 8.1, 11.2);
  const skyPeek = new Mesh(
    new PlaneGeometry(3.6, 7.2),
    new MeshBasicMaterial({ map: skyPeekTexture() }),
  );
  skyPeek.position.set(10.25, 4, 11.1);
  g.add(doorL, doorR, doorTop, skyPeek);

  g.add(buildLamps());
  g.add(buildSlogans());

  const posterAccents = ["#339AF0", "#F08C00", "#E03131", "#37B24D"] as const;
  for (let i = 0; i < 4; i++) {
    const accent = posterAccents[i]!;
    const poster = withOutline(
      new BoxGeometry(1.5, 1.15, 0.08),
      mapped(posterTexture(accent), Number.parseInt(accent.slice(1), 16)),
      0.03,
    );
    poster.position.set(-10.9, 6.4, -4.2 + i * 2.4);
    g.add(poster);
  }

  for (const x of [6.2, 7.4, 5.0] as const) {
    const cone = withOutline(new CylinderGeometry(0.08, 0.42, 0.95, 8), comicFlat(0xf08c00), 0.04);
    cone.position.set(x, 0.48, 7.5);
    const band = new Mesh(new CylinderGeometry(0.28, 0.34, 0.12, 8), comicFlat(0xf8f9fa));
    band.position.set(x, 0.55, 7.5);
    g.add(cone, band);
  }

  g.add(placeWorkshopStock());
  g.add(placeHeroProps());
  return g;
}

function buildTurntable(): Group {
  const g = new Group();
  g.name = "garagePad";
  g.position.set(GARAGE_PAD_CENTER.x, GARAGE_PAD_CENTER.y, GARAGE_PAD_CENTER.z);
  const disc = withOutline(
    new CylinderGeometry(GARAGE_PAD_RADIUS, GARAGE_PAD_RADIUS, 0.08, 40),
    mapped(turntableTexture(), 0x8a9098),
    0.04,
  );
  disc.position.y = 0.04;
  g.add(disc);
  const top = new Mesh(
    new CircleGeometry(GARAGE_PAD_RADIUS - 0.08, 40),
    mapped(turntableTexture(), 0x8a9098),
  );
  top.rotation.x = -Math.PI / 2;
  top.position.y = 0.085;
  g.add(top);
  return g;
}

function buildParkingBox(): Group {
  const g = new Group();
  g.name = "garageParkingBox";
  const hw = 6.2;
  const hd = 7.4;
  const y = 0.09;
  const cx = GARAGE_PAD_CENTER.x;
  const cz = GARAGE_PAD_CENTER.z;
  const segs: Array<[number, number, number, number]> = [
    [cx, cz - hd, hw * 2, 0.12],
    [cx, cz + hd, hw * 2, 0.12],
    [cx - hw, cz, 0.12, hd * 2],
    [cx + hw, cz, 0.12, hd * 2],
  ];
  for (const [x, z, w, d] of segs) {
    const line = withOutline(new BoxGeometry(w, 0.04, d), comicFlat(ComicPalette.repairSpark), 0.02);
    line.position.set(x, y, z);
    g.add(line);
  }
  return g;
}

function buildLamps(): Group {
  const g = new Group();
  g.name = "garageLamps";
  for (const z of [-5, 0, 5] as const) {
    const housing = withOutline(new CylinderGeometry(0.45, 0.55, 0.55, 12), comicFlat(0x2a2c32), 0.03);
    housing.position.set(1.5, 9.55, z);
    const glow = new Mesh(
      new CircleGeometry(0.42, 16),
      comicToon(0xfff3a8, { emissive: 0xffe066, emissiveIntensity: 1.15 }),
    );
    glow.rotation.x = Math.PI / 2;
    glow.position.set(1.5, 9.26, z);
    const cone = new Mesh(
      new ConeGeometry(2.4, 4.2, 16, 1, true),
      new MeshBasicMaterial({
        color: 0xffe8a0,
        transparent: true,
        opacity: 0.14,
        depthWrite: false,
        side: DoubleSide,
      }),
    );
    cone.position.set(1.5, 7.1, z);
    cone.rotation.x = Math.PI;
    g.add(housing, glow, cone);
  }
  return g;
}

function buildSlogans(): Group {
  const g = new Group();
  const drive = withOutline(
    new BoxGeometry(3.2, 1.7, 0.1),
    mapped(sloganPosterTexture("DRIVE HARD", "#FFE066"), 0x1b1b1f),
    0.04,
  );
  drive.position.set(-4.2, 6.6, -10.7);
  const limits = withOutline(
    new BoxGeometry(3.2, 1.7, 0.1),
    mapped(sloganPosterTexture("NO LIMITS", "#E03131"), 0x1b1b1f),
    0.04,
  );
  limits.position.set(7.2, 6.6, -10.7);
  g.add(drive, limits);
  return g;
}

function placeWorkshopStock(): Group {
  const stock = new Group();
  stock.name = "garageStock";
  for (const place of GARAGE_STOCK) {
    const inst = cloneGarageProp(place.id, place.name);
    if (!inst) continue;
    inst.position.set(place.position.x, place.position.y, place.position.z);
    inst.rotation.y = place.yaw;
    inst.scale.setScalar(place.scale);
    stock.add(inst);
  }
  return stock;
}

const HERO_FALLBACK: Partial<Record<GaragePropId, () => Group>> = {
  toolchest: buildGarageToolChest,
  gas: buildGarageGasBottles,
  hoist: buildGarageHoist,
};

function placeHeroProps(): Group {
  const hero = new Group();
  hero.name = "garageHero";
  for (const place of GARAGE_HERO) {
    const inst = cloneGarageProp(place.id, place.name) ?? HERO_FALLBACK[place.id]?.();
    if (!inst) continue;
    inst.name = place.name;
    inst.position.set(place.position.x, place.position.y, place.position.z);
    inst.rotation.y = place.yaw;
    inst.scale.setScalar(place.scale);
    hero.add(inst);
  }
  return hero;
}
