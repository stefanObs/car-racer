import {
  BoxGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  PlaneGeometry,
  SphereGeometry,
  TorusGeometry,
  type Texture,
} from "three";
import { comicToon, withOutline } from "./comicMaterials";
import {
  asphaltPadTexture,
  bannerTexture,
  cabinetDoorTexture,
  crateFaceTexture,
  floorTexture,
  hazardChevronTexture,
  posterTexture,
  wallPanelTexture,
} from "./garageTextures";
import { ComicPalette } from "./palette";

/** Cel-shaded material with a clean comic atlas map (white tint so map reads true). */
function mapped(map: Texture, fallback = 0xffffff) {
  return comicToon(fallback, { map });
}

/** Comic tuner garage bay — textured volumes, no floating decal overlays. */
export function buildGarageBay(): Group {
  const g = new Group();
  g.name = "garageBay";

  const floor = new Mesh(new PlaneGeometry(28, 30), mapped(floorTexture(), 0x343a40));
  floor.rotation.x = -Math.PI / 2;
  g.add(floor);

  const pad = withOutline(new BoxGeometry(11, 0.08, 16), mapped(asphaltPadTexture(), ComicPalette.asphalt), 0.04);
  pad.position.set(1.5, 0.04, 0);
  g.add(pad);

  // Door threshold checker
  for (let i = 0; i < 10; i++) {
    const tile = new Mesh(
      new PlaneGeometry(1.15, 1.15),
      comicToon(i % 2 === 0 ? ComicPalette.outline : 0xf8f9fa),
    );
    tile.rotation.x = -Math.PI / 2;
    tile.position.set(-3.2 + i * 1.15, 0.08, 8.2);
    g.add(tile);
  }

  const back = withOutline(new BoxGeometry(26, 11, 0.4), mapped(wallPanelTexture(1), 0x5c636a), 0.05);
  back.position.set(1, 5.5, -11);
  const left = withOutline(new BoxGeometry(0.4, 11, 24), mapped(wallPanelTexture(2), 0x4e555c), 0.05);
  left.position.set(-11.5, 5.5, 0);
  const right = withOutline(new BoxGeometry(0.4, 11, 24), mapped(wallPanelTexture(3), 0x4e555c), 0.05);
  right.position.set(12.5, 5.5, 0);
  g.add(back, left, right);

  const doorL = withOutline(new BoxGeometry(0.5, 8, 0.5), comicToon(ComicPalette.concreteDark), 0.04);
  doorL.position.set(8.5, 4, 11.2);
  const doorR = withOutline(new BoxGeometry(0.5, 8, 0.5), comicToon(ComicPalette.concreteDark), 0.04);
  doorR.position.set(12, 4, 11.2);
  const doorTop = withOutline(new BoxGeometry(4.2, 0.5, 0.5), comicToon(ComicPalette.concrete), 0.04);
  doorTop.position.set(10.25, 8.1, 11.2);
  const skyPeek = new Mesh(new PlaneGeometry(3.6, 7.2), comicToon(ComicPalette.sky));
  skyPeek.position.set(10.25, 4, 11.1);
  g.add(doorL, doorR, doorTop, skyPeek);

  // Hazard strip on back wall (textured box, not a floating plane)
  const hazard = withOutline(new BoxGeometry(12.5, 0.85, 0.12), mapped(hazardChevronTexture(), ComicPalette.repairSpark), 0.03);
  hazard.position.set(1.5, 1.15, -10.72);
  g.add(hazard);

  for (const z of [-5, 0, 5] as const) {
    const housing = withOutline(new BoxGeometry(9, 0.35, 0.9), comicToon(0x2b3036), 0.03);
    housing.position.set(1.5, 9.6, z);
    const lamp = new Mesh(
      new PlaneGeometry(8.2, 0.55),
      comicToon(0xffe066, { emissive: 0xffe066, emissiveIntensity: 0.7 }),
    );
    lamp.rotation.x = Math.PI / 2;
    lamp.position.set(1.5, 9.4, z);
    g.add(housing, lamp);
  }

  const banner = withOutline(new BoxGeometry(12, 1.6, 0.2), mapped(bannerTexture(), 0xe03131), 0.05);
  banner.position.set(1.5, 7.6, -10.7);
  const bannerBar = withOutline(new BoxGeometry(12.6, 0.25, 0.22), comicToon(ComicPalette.outline), 0.03);
  bannerBar.position.set(1.5, 8.5, -10.65);
  g.add(banner, bannerBar);

  for (const [x, z] of [
    [-8.2, -7],
    [-8.2, -3.5],
  ] as const) {
    const cab = withOutline(new BoxGeometry(1.8, 2.4, 1.2), mapped(cabinetDoorTexture(), 0xe03131), 0.05);
    cab.position.set(x, 1.2, z);
    const handle = withOutline(new BoxGeometry(0.15, 0.5, 0.08), comicToon(ComicPalette.repairSpark), 0.02);
    handle.position.set(x + 0.95, 1.3, z);
    g.add(cab, handle);
  }

  const benchTop = withOutline(new BoxGeometry(4.2, 0.2, 1.4), comicToon(0x8b5a2b), 0.04);
  benchTop.position.set(8.5, 1.15, -7.5);
  const benchLegL = withOutline(new BoxGeometry(0.25, 1.1, 1.2), comicToon(0x495057), 0.03);
  benchLegL.position.set(7, 0.55, -7.5);
  const benchLegR = withOutline(new BoxGeometry(0.25, 1.1, 1.2), comicToon(0x495057), 0.03);
  benchLegR.position.set(10, 0.55, -7.5);
  g.add(benchTop, benchLegL, benchLegR);

  const shelf = withOutline(new BoxGeometry(4.5, 0.18, 1), comicToon(ComicPalette.concrete), 0.03);
  shelf.position.set(8.5, 2.6, -9.2);
  g.add(shelf);
  const crateColors = ["#E03131", "#339AF0", "#F08C00", "#37B24D"] as const;
  for (let i = 0; i < 4; i++) {
    const hex = crateColors[i]!;
    const crate = withOutline(new BoxGeometry(0.85, 0.7, 0.7), mapped(crateFaceTexture(hex), Number.parseInt(hex.slice(1), 16)), 0.04);
    crate.position.set(7 + i * 1.05, 3.05, -9.15);
    g.add(crate);
  }

  for (const [x, z] of [
    [9.5, 3.5],
    [10.6, 4.2],
    [-9, 5],
  ] as const) {
    const drum = withOutline(new CylinderGeometry(0.55, 0.55, 1.4, 12), comicToon(0xe8590c), 0.04);
    drum.position.set(x, 0.7, z);
    const band = new Mesh(new CylinderGeometry(0.57, 0.57, 0.12, 12), comicToon(ComicPalette.outline));
    band.position.set(x, 1.05, z);
    g.add(drum, band);
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
        comicToon(ComicPalette.concreteDark),
        0.03,
      );
      stand.position.set(x, 0.28, z);
      g.add(stand);
    }
  }

  const posterAccents = ["#339AF0", "#F08C00", "#E03131"] as const;
  for (let i = 0; i < 3; i++) {
    const accent = posterAccents[i]!;
    const poster = withOutline(
      new BoxGeometry(1.6, 1.2, 0.08),
      mapped(posterTexture(accent), Number.parseInt(accent.slice(1), 16)),
      0.03,
    );
    poster.position.set(-10.9, 4 + (i % 2) * 0.3, -4 + i * 3.2);
    g.add(poster);
  }

  for (const x of [6.2, 7.4] as const) {
    const cone = withOutline(new CylinderGeometry(0.08, 0.42, 0.95, 8), comicToon(0xf08c00), 0.04);
    cone.position.set(x, 0.48, 7.5);
    const band = new Mesh(new CylinderGeometry(0.28, 0.34, 0.12, 8), comicToon(0xf8f9fa));
    band.position.set(x, 0.55, 7.5);
    g.add(cone, band);
  }

  const wrench = withOutline(new BoxGeometry(0.25, 1.8, 0.12), comicToon(0x868e96), 0.03);
  wrench.position.set(-9.5, 5.2, -10.5);
  const wrenchHead = withOutline(new SphereGeometry(0.35, 8, 8), comicToon(0x868e96), 0.03);
  wrenchHead.position.set(-9.5, 6.2, -10.5);
  g.add(wrench, wrenchHead);

  return g;
}
