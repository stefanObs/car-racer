/**
 * Sky dome + distant panoramic rings (Asphalt-Comic).
 * Far scenery is textured cylinders / infield discs — not fully modelled props.
 */
import {
  BackSide,
  CanvasTexture,
  CylinderGeometry,
  DataTexture,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  SRGBColorSpace,
  SphereGeometry,
  type Texture,
} from "three";
import type { BuiltTrack } from "../track/types";
import { infieldClearRadius, trackCentroid } from "./themeScenery";
import type { ThemeLook } from "./themeLook";

function hexCss(n: number): string {
  return `#${n.toString(16).padStart(6, "0")}`;
}

function solidTexture(color: number): DataTexture {
  const data = new Uint8Array([(color >> 16) & 0xff, (color >> 8) & 0xff, color & 0xff, 255]);
  const tex = new DataTexture(data, 1, 1);
  tex.colorSpace = SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function makeCanvas(w: number, h: number): { c: HTMLCanvasElement; ctx: CanvasRenderingContext2D } | null {
  if (typeof document === "undefined") return null;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  return ctx ? { c, ctx } : null;
}

function texFrom(c: HTMLCanvasElement): CanvasTexture {
  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/** Vertical sky gradient with soft comic cloud bands (used on the inside-out dome). */
export function makeSkyDomeTexture(look: ThemeLook): Texture {
  const canvas = makeCanvas(64, 128);
  if (!canvas) return solidTexture(look.sky);
  const { c, ctx } = canvas;
  const g = ctx.createLinearGradient(0, 0, 0, 128);
  g.addColorStop(0, hexCss(look.hemiSky));
  g.addColorStop(0.38, hexCss(look.sky));
  g.addColorStop(0.68, hexCss(look.skyLow));
  g.addColorStop(1, hexCss(look.ground));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 128);
  // Soft cel cloud bands — denser near zenith
  ctx.fillStyle = "rgba(244,247,250,0.88)";
  for (const [y, h] of [
    [18, 6],
    [30, 4],
    [42, 5],
    [54, 3],
    [66, 2],
  ] as const) {
    ctx.fillRect(0, y, 64, h);
  }
  return texFrom(c);
}

type PanoramaKind = "harbor" | "beach" | "city" | "factory" | "canyon";

function panoramaKind(theme: string): PanoramaKind {
  const t = theme.toLowerCase();
  if (t === "beach" || t === "city" || t === "factory" || t === "canyon") return t;
  return "harbor";
}

/** Wide comic silhouette strip for a surrounding cylinder. */
export function makeHorizonPanoramaTexture(theme: string, look: ThemeLook): Texture {
  const kind = panoramaKind(theme);
  const canvas = makeCanvas(1024, 256);
  if (!canvas) return solidTexture(look.skyLow);
  const { c, ctx } = canvas;
  const sky = hexCss(look.sky);
  const skyLow = hexCss(look.skyLow);
  const ground = hexCss(look.ground);

  const bg = ctx.createLinearGradient(0, 0, 0, 256);
  bg.addColorStop(0, sky);
  bg.addColorStop(0.55, skyLow);
  bg.addColorStop(0.78, ground);
  bg.addColorStop(1, ground);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 1024, 256);

  // Soft cloud blobs
  ctx.fillStyle = "rgba(248,249,250,0.85)";
  for (let i = 0; i < 10; i++) {
    const x = (i * 97 + 40) % 1024;
    const y = 28 + (i % 4) * 12;
    ctx.beginPath();
    ctx.ellipse(x, y, 48 + (i % 3) * 12, 14, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  const outline = "#1B1B1F";
  const drawBox = (x: number, y: number, w: number, h: number, fill: string) => {
    ctx.fillStyle = fill;
    ctx.strokeStyle = outline;
    ctx.lineWidth = 3;
    ctx.fillRect(x, y, w, h);
    ctx.strokeRect(x, y, w, h);
  };

  if (kind === "harbor") {
    // Water band
    ctx.fillStyle = "#2f6f9e";
    ctx.fillRect(0, 168, 1024, 50);
    ctx.strokeStyle = outline;
    ctx.strokeRect(0, 168, 1024, 50);
    for (let i = 0; i < 8; i++) {
      const x = 40 + i * 128;
      // Crane (reuse Havenstadt silhouette language)
      drawBox(x + 18, 70, 10, 100, "#e85d04");
      drawBox(x - 10, 78, 90, 8, "#e85d04");
      drawBox(x + 8, 100, 22, 16, "#f8f9fa");
      // Containers
      const colors = ["#e03131", "#1c7ed6", "#f6c90e", "#2f9e44"];
      for (let j = 0; j < 3; j++) {
        drawBox(x + 50 + j * 18, 140 - j * 16, 16, 16, colors[j % colors.length]!);
      }
      // Silo
      if (i % 2 === 0) {
        ctx.fillStyle = "#f8f9fa";
        ctx.strokeStyle = outline;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.ellipse(x + 110, 150, 14, 36, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = "#e03131";
        ctx.fillRect(x + 98, 140, 24, 8);
      }
    }
  } else if (kind === "beach") {
    // Parabolbogen: water band, palms, yellow tribunes
    ctx.fillStyle = "#2f6f9e";
    ctx.fillRect(0, 175, 1024, 45);
    ctx.strokeStyle = outline;
    ctx.lineWidth = 3;
    ctx.strokeRect(0, 175, 1024, 45);
    for (let i = 0; i < 12; i++) {
      const x = 30 + i * 85;
      drawBox(x + 8, 110, 6, 55, "#8b6914");
      ctx.fillStyle = "#2f9e44";
      ctx.beginPath();
      ctx.ellipse(x + 11, 105, 28, 10, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = outline;
      ctx.stroke();
      if (i % 3 === 0) drawBox(x + 40, 145, 36, 28, "#f8f9fa");
    }
    for (let i = 0; i < 6; i++) {
      drawBox(80 + i * 160, 148, 78, 32, "#fcc419");
      drawBox(88 + i * 160, 140, 62, 10, "#4dabf7");
    }
  } else if (kind === "city") {
    // Schikanenring: blocky city skyline + control towers
    for (let i = 0; i < 16; i++) {
      const x = 20 + i * 64;
      const h = 50 + (i % 5) * 18;
      drawBox(x, 200 - h, 36 + (i % 3) * 8, h, ["#6c757d", "#adb5bd", "#e03131", "#4a4f57"][i % 4]!);
      ctx.fillStyle = "#74c0fc";
      ctx.fillRect(x + 6, 210 - h, 12, h * 0.45);
    }
    for (const x of [180, 460, 780]) {
      drawBox(x, 70, 28, 110, "#868e96");
      drawBox(x - 6, 60, 40, 18, "#f8f9fa");
      ctx.fillStyle = "#74c0fc";
      ctx.fillRect(x + 4, 78, 20, 28);
    }
  } else if (kind === "factory") {
    // Kuppenfinale: forested hills + sparse sheds
    ctx.fillStyle = "#3f5e38";
    ctx.fillRect(0, 175, 1024, 50);
    for (let i = 0; i < 18; i++) {
      const x = 20 + i * 56;
      drawBox(x + 10, 150, 6, 28, "#6b4f2a");
      ctx.fillStyle = "#2f6b3a";
      ctx.beginPath();
      ctx.moveTo(x, 150);
      ctx.lineTo(x + 13, 95 + (i % 3) * 10);
      ctx.lineTo(x + 26, 150);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = outline;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    for (let i = 0; i < 4; i++) {
      drawBox(120 + i * 220, 155, 70, 40, "#8b9098");
      ctx.fillStyle = "#fcc419";
      ctx.fillRect(128 + i * 220, 168, 54, 6);
    }
  } else {
    // Omegatal canyon cliffs + scrub band
    ctx.fillStyle = "#a0785a";
    ctx.strokeStyle = outline;
    ctx.lineWidth = 3;
    for (let i = 0; i < 8; i++) {
      const x = i * 140;
      ctx.beginPath();
      ctx.moveTo(x, 210);
      ctx.lineTo(x + 40, 90 + (i % 3) * 20);
      ctx.lineTo(x + 90, 130);
      ctx.lineTo(x + 140, 210);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      // Spire silhouettes
      ctx.beginPath();
      ctx.moveTo(x + 55, 210);
      ctx.lineTo(x + 70, 70 + (i % 2) * 15);
      ctx.lineTo(x + 85, 210);
      ctx.closePath();
      ctx.fillStyle = "#8b6848";
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#a0785a";
    }
    ctx.fillStyle = "#5c7c3a";
    ctx.fillRect(0, 200, 1024, 30);
  }

  // Horizon stroke
  ctx.strokeStyle = outline;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(0, 200);
  ctx.lineTo(1024, 200);
  ctx.stroke();

  return texFrom(c);
}

/** Infield disc texture — distant feel inside the loop (basin / hills / stands). */
export function makeInfieldPanoramaTexture(theme: string, look: ThemeLook): Texture {
  const kind = panoramaKind(theme);
  const canvas = makeCanvas(512, 512);
  if (!canvas) return solidTexture(look.ground);
  const { c, ctx } = canvas;
  const ground = hexCss(look.ground);
  ctx.fillStyle = ground;
  ctx.fillRect(0, 0, 512, 512);

  if (kind === "harbor") {
    ctx.fillStyle = "#2f6f9e";
    ctx.beginPath();
    ctx.arc(256, 256, 210, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#1B1B1F";
    ctx.lineWidth = 6;
    ctx.stroke();
    // Ship + containers (flat top-down comic)
    ctx.fillStyle = "#1c7ed6";
    ctx.fillRect(180, 200, 160, 70);
    ctx.strokeRect(180, 200, 160, 70);
    const cols = ["#e03131", "#f6c90e", "#2f9e44", "#1c7ed6"];
    for (let i = 0; i < 8; i++) {
      ctx.fillStyle = cols[i % cols.length]!;
      ctx.fillRect(190 + (i % 4) * 34, 210 + Math.floor(i / 4) * 28, 30, 24);
      ctx.strokeRect(190 + (i % 4) * 34, 210 + Math.floor(i / 4) * 28, 30, 24);
    }
  } else if (kind === "beach") {
    ctx.fillStyle = "#c2a66a";
    ctx.fillRect(0, 0, 512, 512);
    ctx.fillStyle = "#2f6f9e";
    ctx.beginPath();
    ctx.arc(256, 256, 160, 0, Math.PI * 2);
    ctx.fill();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      ctx.fillStyle = "#fcc419";
      ctx.fillRect(256 + Math.cos(a) * 190 - 20, 256 + Math.sin(a) * 190 - 12, 40, 24);
      ctx.strokeStyle = "#1B1B1F";
      ctx.strokeRect(256 + Math.cos(a) * 190 - 20, 256 + Math.sin(a) * 190 - 12, 40, 24);
    }
  } else if (kind === "city") {
    ctx.fillStyle = "#3a4550";
    ctx.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 12; i++) {
      const x = 40 + (i % 4) * 110;
      const y = 40 + Math.floor(i / 4) * 140;
      ctx.fillStyle = i % 2 === 0 ? "#6c757d" : "#adb5bd";
      ctx.fillRect(x, y, 80, 100);
      ctx.strokeStyle = "#1B1B1F";
      ctx.strokeRect(x, y, 80, 100);
      ctx.fillStyle = "#74c0fc";
      ctx.fillRect(x + 12, y + 16, 56, 40);
    }
  } else if (kind === "factory") {
    // Forest bowl infield
    ctx.fillStyle = "#4f6b45";
    ctx.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const r = 70 + (i % 3) * 40;
      const x = 256 + Math.cos(a) * r;
      const y = 256 + Math.sin(a) * r;
      ctx.fillStyle = "#2f6b3a";
      ctx.beginPath();
      ctx.arc(x, y, 14 + (i % 3) * 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#1B1B1F";
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    ctx.fillStyle = "#8b9098";
    ctx.fillRect(210, 220, 90, 55);
    ctx.strokeRect(210, 220, 90, 55);
  } else {
    ctx.fillStyle = "#5c7c3a";
    ctx.fillRect(0, 0, 512, 512);
    ctx.fillStyle = "#a0785a";
    for (let i = 0; i < 7; i++) {
      const x = 40 + i * 65;
      ctx.beginPath();
      ctx.moveTo(x, 400);
      ctx.lineTo(x + 30, 180 + (i % 3) * 40);
      ctx.lineTo(x + 60, 400);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "#1B1B1F";
      ctx.stroke();
    }
  }

  return texFrom(c);
}

export function buildSkyDomeMesh(look: ThemeLook): Mesh {
  const mesh = new Mesh(
    new SphereGeometry(320, 32, 20),
    new MeshBasicMaterial({ map: makeSkyDomeTexture(look), side: BackSide, fog: false }),
  );
  mesh.scale.y = 0.7;
  mesh.name = "skyDome";
  return mesh;
}

/**
 * Large surrounding cylinder + optional infield disc with panoramic textures.
 * Reuses Havenstadt visual language (cranes/containers/silos) in harbor/city strips.
 */
export function buildPanoramaSurround(track: BuiltTrack, theme: string, look: ThemeLook): Group {
  const root = new Group();
  root.name = "panoramaSurround";

  const c = trackCentroid(track);
  let maxR = 40;
  for (const p of track.centerline) {
    maxR = Math.max(maxR, Math.hypot(p.x - c.x, p.z - c.z));
  }
  const ringR = maxR + track.asphaltHalfWidth + track.grassWidth + 55;
  const ringH = 42;

  const horizonMat = new MeshBasicMaterial({
    map: makeHorizonPanoramaTexture(theme, look),
    side: DoubleSide,
    fog: true,
  });
  const ring = new Mesh(new CylinderGeometry(ringR, ringR, ringH, 48, 1, true), horizonMat);
  ring.position.set(c.x, ringH * 0.42, c.z);
  ring.name = "horizonPanorama";
  root.add(ring);

  // Harbor keeps the modelled basin from themeScenery; other themes get a flat infield panorama.
  const infieldR = infieldClearRadius(track);
  if (infieldR >= 7 && panoramaKind(theme) !== "harbor") {
    const disc = new Mesh(
      new PlaneGeometry(infieldR * 2.1, infieldR * 2.1),
      new MeshBasicMaterial({ map: makeInfieldPanoramaTexture(theme, look), fog: true }),
    );
    disc.rotation.x = -Math.PI / 2;
    disc.position.set(c.x, -0.05, c.z);
    disc.name = "infieldPanorama";
    root.add(disc);
  }

  return root;
}

export function disposePanoramaMaps(root: Group): void {
  root.traverse((obj) => {
    const mesh = obj as Mesh;
    const mat = mesh.material as MeshBasicMaterial | MeshBasicMaterial[] | undefined;
    const mats = Array.isArray(mat) ? mat : mat ? [mat] : [];
    for (const m of mats) {
      if (m?.map) {
        m.map.dispose();
        m.map = null;
      }
    }
  });
}
