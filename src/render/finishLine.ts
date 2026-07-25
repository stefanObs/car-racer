import { Group, Mesh } from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { sampleCenterline } from "../track/buildTrack";
import type { BuiltTrack } from "../track/types";
import { comicToon, withOutline } from "./comicMaterials";
import { ComicPalette } from "./palette";

const BANNER_RED = 0xe03131;
const BANNER_WHITE = 0xf8f9fa;

/** Checkered strip + overhead ZIEL banner at start/finish (distance 0). */
export function buildFinishLine(track: BuiltTrack): Group {
  const root = new Group();
  root.name = "finishLine";
  const s = sampleCenterline(track, 0);
  const yaw = Math.atan2(s.tangent.z, s.tangent.x);
  root.position.set(s.position.x, 0, s.position.z);
  root.rotation.y = yaw;

  const half = track.asphaltHalfWidth;
  const width = half * 2;

  const checks = 10;
  const cell = width / checks;
  for (let i = 0; i < checks; i++) {
    const dark = i % 2 === 0;
    const tile = new Mesh(
      new RoundedBoxGeometry(0.9, 0.06, cell * 0.92, 1, 0.02),
      comicToon(dark ? ComicPalette.outline : BANNER_WHITE),
    );
    tile.position.set(0, 0.16, -half + cell * (i + 0.5));
    root.add(tile);
  }

  const poleLat = half + 1.1;
  for (const side of [-1, 1] as const) {
    const pole = withOutline(
      new RoundedBoxGeometry(0.45, 7.2, 0.45, 2, 0.08),
      comicToon(ComicPalette.concrete),
      0.05,
    );
    pole.position.set(0.15, 3.6, poleLat * side);
    root.add(pole);

    const cap = withOutline(
      new RoundedBoxGeometry(0.7, 0.35, 0.7, 2, 0.08),
      comicToon(BANNER_RED),
      0.04,
    );
    cap.position.set(0.15, 7.25, poleLat * side);
    root.add(cap);
  }

  const bar = withOutline(
    new RoundedBoxGeometry(0.35, 0.35, poleLat * 2 + 0.4, 2, 0.06),
    comicToon(ComicPalette.outline),
    0.04,
  );
  bar.position.set(0.15, 6.85, 0);
  root.add(bar);

  // Cloth panel facing oncoming traffic (thick enough to read head-on)
  const clothW = poleLat * 2 - 0.6;
  const cloth = withOutline(
    new RoundedBoxGeometry(0.55, 2.1, clothW, 2, 0.08),
    comicToon(BANNER_RED),
    0.06,
  );
  cloth.position.set(0, 5.9, 0);
  root.add(cloth);

  // Checkered top/bottom trim
  const trimCells = Math.max(8, Math.floor(clothW / 0.7));
  for (let i = 0; i < trimCells; i++) {
    const z = -clothW / 2 + (i + 0.5) * (clothW / trimCells);
    for (const y of [5.0, 6.8] as const) {
      const trim = new Mesh(
        new RoundedBoxGeometry(0.58, 0.28, clothW / trimCells - 0.06, 1, 0.02),
        comicToon(i % 2 === 0 ? ComicPalette.outline : BANNER_WHITE),
      );
      trim.position.set(0.02, y, z);
      root.add(trim);
    }
  }

  root.add(makeZielLetters(clothW * 0.78));

  return root;
}

/** Blocky comic “ZIEL” letters on the banner face. */
function makeZielLetters(span: number): Group {
  const g = new Group();
  g.position.set(0.42, 5.9, 0);
  const letterW = span / 4.4;
  const h = 1.25;
  const depth = 0.28;
  const gap = letterW * 0.12;
  const letters = ["Z", "I", "E", "L"] as const;
  let x = -((letters.length * letterW + (letters.length - 1) * gap) / 2) + letterW / 2;

  for (const ch of letters) {
    const glyph = letterGlyph(ch, letterW * 0.85, h, depth);
    glyph.position.set(0, 0, x);
    g.add(glyph);
    x += letterW + gap;
  }
  return g;
}

function letterGlyph(ch: "Z" | "I" | "E" | "L", w: number, h: number, d: number): Group {
  const g = new Group();
  const add = (sx: number, sy: number, sz: number, px: number, py: number, pz: number) => {
    const m = withOutline(new RoundedBoxGeometry(sx, sy, sz, 1, 0.03), comicToon(BANNER_WHITE), 0.03);
    m.position.set(px, py, pz);
    g.add(m);
  };
  const t = Math.min(w, h) * 0.22;

  if (ch === "I") {
    add(d, h, t, 0, 0, 0);
  } else if (ch === "L") {
    add(d, h, t, 0, 0, -w / 2 + t / 2);
    add(d, t, w, 0, -h / 2 + t / 2, 0);
  } else if (ch === "E") {
    add(d, h, t, 0, 0, -w / 2 + t / 2);
    add(d, t, w, 0, h / 2 - t / 2, 0);
    add(d, t, w * 0.75, 0, 0, w * 0.05);
    add(d, t, w, 0, -h / 2 + t / 2, 0);
  } else {
    // Z
    add(d, t, w, 0, h / 2 - t / 2, 0);
    add(d, t, w, 0, -h / 2 + t / 2, 0);
    // diagonal approx as stepped bar
    add(d, h * 0.7, t, 0, 0, 0);
  }
  return g;
}
