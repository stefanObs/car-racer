import {
  BoxGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  PointLight,
  type Texture,
} from "three";
import { GARAGE_PROP_IDS, GARAGE_PROPS } from "../data/garageProps";
import { comicFlat, comicToon, withOutline } from "./comicMaterials";
import {
  asphaltPadTexture,
  bannerTexture,
  floorTexture,
  hazardChevronTexture,
  posterTexture,
  skyPeekTexture,
  wallPanelTexture,
} from "./garageTextures";
import { cloneGarageProp } from "./loadGarageGltf";
import { ComicPalette } from "./palette";

/** Turntable pad center — car sits here; workshop props stay off this volume. */
export const GARAGE_PAD_CENTER = { x: 1.5, y: 0.04, z: 0 } as const;

/** Bright unlit atlas fill — garage env stays sunny (toon gradient would muddle maps). */
function mapped(map: Texture, fallback = 0xffffff) {
  return comicFlat(fallback, { map });
}

/** Bright Asphalt-Comic tuner garage — architecture + Tripo workshop stock. */
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

  const floor = new Mesh(new PlaneGeometry(28, 30), mapped(floorTexture(), 0xe4e7ec));
  floor.rotation.x = -Math.PI / 2;
  g.add(floor);

  const pad = withOutline(new BoxGeometry(11, 0.08, 16), mapped(asphaltPadTexture(), 0x8a9098), 0.04);
  pad.name = "garagePad";
  pad.position.set(GARAGE_PAD_CENTER.x, GARAGE_PAD_CENTER.y, GARAGE_PAD_CENTER.z);
  g.add(pad);

  for (let i = 0; i < 10; i++) {
    const tile = new Mesh(
      new PlaneGeometry(1.15, 1.15),
      comicFlat(i % 2 === 0 ? ComicPalette.outline : 0xf8f9fa),
    );
    tile.rotation.x = -Math.PI / 2;
    tile.position.set(-3.2 + i * 1.15, 0.08, 8.2);
    g.add(tile);
  }

  const back = withOutline(new BoxGeometry(26, 11, 0.4), mapped(wallPanelTexture(1), 0xeef1f4), 0.05);
  back.position.set(1, 5.5, -11);
  const left = withOutline(new BoxGeometry(0.4, 11, 24), mapped(wallPanelTexture(2), 0xe4e8ed), 0.05);
  left.position.set(-11.5, 5.5, 0);
  const right = withOutline(new BoxGeometry(0.4, 11, 24), mapped(wallPanelTexture(3), 0xe4e8ed), 0.05);
  right.position.set(12.5, 5.5, 0);
  g.add(back, left, right);

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

  const hazard = withOutline(new BoxGeometry(12.5, 0.85, 0.12), mapped(hazardChevronTexture(), ComicPalette.repairSpark), 0.03);
  hazard.position.set(1.5, 1.15, -10.72);
  g.add(hazard);

  for (const z of [-5, 0, 5] as const) {
    const housing = withOutline(new BoxGeometry(9, 0.35, 0.9), comicFlat(0x5c636a), 0.03);
    housing.position.set(1.5, 9.6, z);
    const lamp = new Mesh(
      new PlaneGeometry(8.2, 0.55),
      comicToon(0xfff3a8, { emissive: 0xffe066, emissiveIntensity: 1.15 }),
    );
    lamp.rotation.x = Math.PI / 2;
    lamp.position.set(1.5, 9.4, z);
    g.add(housing, lamp);
  }

  const banner = withOutline(new BoxGeometry(12, 1.6, 0.2), mapped(bannerTexture(), 0xe03131), 0.05);
  banner.position.set(1.5, 7.6, -10.7);
  const bannerBar = withOutline(new BoxGeometry(12.6, 0.25, 0.22), comicFlat(ComicPalette.outline), 0.03);
  bannerBar.position.set(1.5, 8.5, -10.65);
  const bannerBarBot = withOutline(new BoxGeometry(12.6, 0.18, 0.2), comicFlat(ComicPalette.repairSpark), 0.03);
  bannerBarBot.position.set(1.5, 6.7, -10.65);
  g.add(banner, bannerBar, bannerBarBot);

  const posterAccents = ["#339AF0", "#F08C00", "#E03131", "#37B24D"] as const;
  for (let i = 0; i < 4; i++) {
    const accent = posterAccents[i]!;
    const poster = withOutline(
      new BoxGeometry(1.7, 1.3, 0.08),
      mapped(posterTexture(accent), Number.parseInt(accent.slice(1), 16)),
      0.03,
    );
    poster.position.set(-10.9, 4.2 + (i % 2) * 0.25, -5.5 + i * 2.8);
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
  return g;
}

/** Tripo cabinet / bench / tires / shelf / drums along walls — pad stays clear. */
function placeWorkshopStock(): Group {
  const stock = new Group();
  stock.name = "garageStock";
  for (const id of GARAGE_PROP_IDS) {
    const spec = GARAGE_PROPS[id];
    const inst = cloneGarageProp(id);
    if (!inst) continue;
    inst.position.set(spec.position.x, spec.position.y, spec.position.z);
    inst.rotation.y = spec.yaw;
    inst.scale.setScalar(spec.scale);
    stock.add(inst);
  }
  return stock;
}
