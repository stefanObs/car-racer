import {
  BoxGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  PointLight,
  SphereGeometry,
  TorusGeometry,
  type Texture,
} from "three";
import { comicFlat, comicToon, withOutline } from "./comicMaterials";
import {
  asphaltPadTexture,
  bannerTexture,
  cabinetDoorTexture,
  crateFaceTexture,
  drumLabelTexture,
  floorTexture,
  hazardChevronTexture,
  posterTexture,
  skyPeekTexture,
  wallPanelTexture,
  woodBenchTexture,
} from "./garageTextures";
import { ComicPalette } from "./palette";

/** Bright unlit atlas fill — garage env stays sunny (toon gradient would muddle maps). */
function mapped(map: Texture, fallback = 0xffffff) {
  return comicFlat(fallback, { map });
}

/** Bright Asphalt-Comic tuner garage — textured props, daylight fill. */
export function buildGarageBay(): Group {
  const g = new Group();
  g.name = "garageBay";

  // Local fill so the bay reads sunny even under race lighting defaults
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
  pad.position.set(1.5, 0.04, 0);
  g.add(pad);

  // Door threshold checker
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

  // Open bay door — bright sky peek
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

  // Ceiling lamp banks — brighter emissive panels
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

  for (const [x, z] of [
    [-8.2, -7],
    [-8.2, -3.5],
    [-8.2, 0],
  ] as const) {
    const cab = withOutline(new BoxGeometry(1.8, 2.4, 1.2), mapped(cabinetDoorTexture(), 0xe03131), 0.05);
    cab.position.set(x, 1.2, z);
    const handle = withOutline(new BoxGeometry(0.15, 0.5, 0.08), comicFlat(ComicPalette.repairSpark), 0.02);
    handle.position.set(x + 0.95, 1.3, z);
    const vent = withOutline(new BoxGeometry(1.4, 0.12, 0.9), comicFlat(0x343a40), 0.02);
    vent.position.set(x, 2.35, z);
    g.add(cab, handle, vent);
  }

  const benchTop = withOutline(new BoxGeometry(4.2, 0.2, 1.4), mapped(woodBenchTexture(), 0xc48a4a), 0.04);
  benchTop.position.set(8.5, 1.15, -7.5);
  const benchLegL = withOutline(new BoxGeometry(0.25, 1.1, 1.2), comicFlat(0x6c7178), 0.03);
  benchLegL.position.set(7, 0.55, -7.5);
  const benchLegR = withOutline(new BoxGeometry(0.25, 1.1, 1.2), comicFlat(0x6c7178), 0.03);
  benchLegR.position.set(10, 0.55, -7.5);
  // Tools on bench
  const hammer = withOutline(new BoxGeometry(0.9, 0.12, 0.18), comicFlat(0x868e96), 0.02);
  hammer.position.set(7.6, 1.35, -7.3);
  const hammerHead = withOutline(new BoxGeometry(0.22, 0.28, 0.32), comicFlat(0x495057), 0.02);
  hammerHead.position.set(8.1, 1.42, -7.3);
  const oilCan = withOutline(new CylinderGeometry(0.14, 0.18, 0.35, 8), comicFlat(0xe03131), 0.02);
  oilCan.position.set(9.4, 1.42, -7.6);
  g.add(benchTop, benchLegL, benchLegR, hammer, hammerHead, oilCan);

  const shelf = withOutline(new BoxGeometry(4.5, 0.18, 1), comicFlat(0xb8bdc4), 0.03);
  shelf.position.set(8.5, 2.6, -9.2);
  const shelfBracketL = withOutline(new BoxGeometry(0.12, 0.6, 0.8), comicFlat(0x868e96), 0.02);
  shelfBracketL.position.set(6.5, 2.35, -9.2);
  const shelfBracketR = withOutline(new BoxGeometry(0.12, 0.6, 0.8), comicFlat(0x868e96), 0.02);
  shelfBracketR.position.set(10.5, 2.35, -9.2);
  g.add(shelf, shelfBracketL, shelfBracketR);

  const crateColors = ["#E03131", "#339AF0", "#F08C00", "#37B24D"] as const;
  for (let i = 0; i < 4; i++) {
    const hex = crateColors[i]!;
    const crate = withOutline(
      new BoxGeometry(0.85, 0.7, 0.7),
      mapped(crateFaceTexture(hex), Number.parseInt(hex.slice(1), 16)),
      0.04,
    );
    crate.position.set(7 + i * 1.05, 3.05, -9.15);
    g.add(crate);
  }
  // Floor crate stack
  for (let i = 0; i < 2; i++) {
    const crate = withOutline(
      new BoxGeometry(1.1, 0.9, 0.95),
      mapped(crateFaceTexture("#F08C00"), 0xf08c00),
      0.04,
    );
    crate.position.set(-9.2, 0.45 + i * 0.95, 2.2);
    g.add(crate);
  }

  for (const [x, z] of [
    [9.5, 3.5],
    [10.6, 4.2],
    [-9, 5],
    [-9.8, 5.8],
  ] as const) {
    const drum = withOutline(
      new CylinderGeometry(0.55, 0.55, 1.4, 12),
      mapped(drumLabelTexture(), 0xe8590c),
      0.04,
    );
    drum.position.set(x, 0.7, z);
    const band = new Mesh(new CylinderGeometry(0.57, 0.57, 0.12, 12), comicFlat(ComicPalette.outline));
    band.position.set(x, 1.05, z);
    const rim = new Mesh(new CylinderGeometry(0.58, 0.58, 0.08, 12), comicFlat(0xf8f9fa));
    rim.position.set(x, 1.35, z);
    g.add(drum, band, rim);
  }

  for (const [x, z, n] of [
    [-7.2, 4.5, 4],
    [7.8, 5.5, 3],
    [-8.5, -0.5, 3],
    [10.2, -2, 4],
  ] as const) {
    for (let i = 0; i < n; i++) {
      const tire = withOutline(new TorusGeometry(0.55, 0.22, 8, 16), comicToon(ComicPalette.tire), 0.04);
      tire.rotation.x = Math.PI / 2;
      tire.position.set(x, 0.35 + i * 0.48, z);
      g.add(tire);
      if (i === n - 1) {
        const stripe = new Mesh(
          new TorusGeometry(0.55, 0.08, 6, 12),
          comicToon(ComicPalette.tireAccent),
        );
        stripe.rotation.x = Math.PI / 2;
        stripe.position.set(x, 0.35 + i * 0.48, z);
        g.add(stripe);
      }
    }
  }

  for (const x of [-1.2, 4.2] as const) {
    for (const z of [-2.5, 2.5] as const) {
      const stand = withOutline(
        new CylinderGeometry(0.12, 0.28, 0.55, 6),
        comicFlat(0x8b9098),
        0.03,
      );
      stand.position.set(x, 0.28, z);
      const padTop = withOutline(new CylinderGeometry(0.32, 0.32, 0.08, 8), comicFlat(0xf8f9fa), 0.02);
      padTop.position.set(x, 0.58, z);
      g.add(stand, padTop);
    }
  }

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

  // Wall-mounted wrench set
  const wrench = withOutline(new BoxGeometry(0.25, 1.8, 0.12), comicFlat(0xa8adb4), 0.03);
  wrench.position.set(-9.5, 5.2, -10.5);
  const wrenchHead = withOutline(new SphereGeometry(0.35, 8, 8), comicFlat(0xa8adb4), 0.03);
  wrenchHead.position.set(-9.5, 6.2, -10.5);
  const wrench2 = withOutline(new BoxGeometry(0.2, 1.4, 0.1), comicFlat(0x868e96), 0.03);
  wrench2.position.set(-8.6, 5.0, -10.5);
  const wrench2Head = withOutline(new SphereGeometry(0.28, 8, 8), comicFlat(0x868e96), 0.03);
  wrench2Head.position.set(-8.6, 5.8, -10.5);
  g.add(wrench, wrenchHead, wrench2, wrench2Head);

  // Pegboard strip behind tools
  const peg = withOutline(new BoxGeometry(2.8, 2.2, 0.1), comicFlat(0xd4a574), 0.03);
  peg.position.set(-9.1, 5.4, -10.7);
  g.add(peg);

  return g;
}
