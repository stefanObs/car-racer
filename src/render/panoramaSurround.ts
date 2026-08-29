/**
 * Sky dome + distant panoramic rings (Asphalt-Comic).
 * Far scenery is textured cylinders / infield discs — not fully modelled props.
 */
import {
  BackSide,
  CanvasTexture,
  ClampToEdgeWrapping,
  CylinderGeometry,
  DataTexture,
  DoubleSide,
  EquirectangularReflectionMapping,
  Group,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  RingGeometry,
  SRGBColorSpace,
  SphereGeometry,
  TextureLoader,
  type Object3D,
  type Texture,
} from "three";
import type { BuiltTrack } from "../track/types";
import { infieldClearRadius, trackCentroid } from "./themeScenery";
import type { ThemeLook } from "./themeLook";

export type PanoramaKind = "harbor" | "beach" | "city" | "factory" | "canyon";
export type PanoramaPlate = "horizon" | "infield";

/** Authored Asphalt-Comic plates under `/textures/panorama/`. */
export const PANORAMA_URLS: Record<PanoramaKind, Record<PanoramaPlate, string>> = {
  harbor: {
    horizon: "/textures/panorama/harbor-horizon.png",
    infield: "/textures/panorama/harbor-infield.png",
  },
  beach: {
    horizon: "/textures/panorama/beach-horizon.png",
    infield: "/textures/panorama/beach-infield.png",
  },
  city: {
    horizon: "/textures/panorama/city-horizon.png",
    infield: "/textures/panorama/city-infield.png",
  },
  factory: {
    horizon: "/textures/panorama/factory-horizon.png",
    infield: "/textures/panorama/factory-infield.png",
  },
  canyon: {
    horizon: "/textures/panorama/canyon-horizon.png",
    infield: "/textures/panorama/canyon-infield.png",
  },
};

/** Tight crane/pier strip for the harbor cylinder (full plate is mostly sky). */
export const HARBOR_SKYLINE_URL = "/textures/panorama/harbor-skyline.png";

const shippedPanorama = new Map<string, Texture>();
let panoramaPreload: Promise<void> | null = null;

function plateKey(kind: string, plate: string): string {
  return `${kind}:${plate}`;
}

/** Boot-time load of authored theme panorama plates (canvas fallbacks if missing). */
export function preloadPanoramaTextures(): Promise<void> {
  if (panoramaPreload) return panoramaPreload;
  if (typeof document === "undefined") {
    panoramaPreload = Promise.resolve();
    return panoramaPreload;
  }
  const loader = new TextureLoader();
  const jobs: Promise<void>[] = [];
  const enqueue = (kind: string, plate: string, url: string) => {
    jobs.push(
      new Promise<void>((resolve) => {
        loader.load(
          url,
          (tex) => {
            tex.colorSpace = SRGBColorSpace;
            tex.wrapS = ClampToEdgeWrapping;
            tex.wrapT = ClampToEdgeWrapping;
            tex.needsUpdate = true;
            shippedPanorama.set(plateKey(kind, plate), tex);
            resolve();
          },
          undefined,
          () => resolve(),
        );
      }),
    );
  };
  for (const kind of Object.keys(PANORAMA_URLS) as PanoramaKind[]) {
    for (const plate of Object.keys(PANORAMA_URLS[kind]) as PanoramaPlate[]) {
      enqueue(kind, plate, PANORAMA_URLS[kind][plate]);
    }
  }
  enqueue("harbor", "skyline", HARBOR_SKYLINE_URL);
  panoramaPreload = Promise.all(jobs).then(() => undefined);
  return panoramaPreload;
}

export function hasShippedPanorama(kind: PanoramaKind, plate: PanoramaPlate): boolean {
  return shippedPanorama.has(plateKey(kind, plate));
}

/** @deprecated use hasShippedPanorama("harbor", plate) */
export function hasShippedHarborPanorama(kind: PanoramaPlate): boolean {
  return hasShippedPanorama("harbor", kind);
}

function shippedPlate(kind: string, plate: string): Texture | undefined {
  return shippedPanorama.get(plateKey(kind, plate));
}

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
export function makeSkyDomeTexture(look: ThemeLook, theme = "harbor"): Texture {
  if (panoramaKind(theme) === "harbor") {
    return makeHarborEquirectTexture(look);
  }
  const canvas = makeCanvas(64, 128);
  if (!canvas) return solidTexture(look.sky);
  const { c, ctx } = canvas;
  const g = ctx.createLinearGradient(0, 0, 0, 128);
  g.addColorStop(0, hexCss(look.hemiSky));
  g.addColorStop(0.35, hexCss(look.sky));
  g.addColorStop(0.62, hexCss(look.skyLow));
  g.addColorStop(1, hexCss(look.ground));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 128);
  ctx.fillStyle = "rgba(244,247,250,0.88)";
  for (const [y, h] of [
    [16, 5],
    [28, 4],
    [40, 5],
    [52, 3],
    [64, 2],
  ] as const) {
    ctx.fillRect(0, y, 64, h);
  }
  return texFrom(c);
}

/** Ground plane Y in RaceRenderer — panorama decks must sit above this. */
export const GROUND_PLANE_Y = -0.08;

/**
 * Water apron + infield disc Y. Below asphalt (y=0) so the ribbon stays on top;
 * above the ground plane so grazing chase-cam views do not lose the plates.
 */
export const PANORAMA_DECK_Y = -0.02;

/**
 * Pier / water line in `harbor-horizon.png`, v from the top of the image.
 * Cranes and warehouses sit just above this; water is below. Measured.
 */
export const HARBOR_HORIZON_PIER_V = 0.78;

/**
 * Tight crop of `harbor-horizon.png` for the standing cylinder.
 * The authored plate is mostly sky; without this crop the pier/cranes sit in a
 * thin band on the ground’s vanishing line and read as “lost behind the floor”.
 */
export const HARBOR_SKYLINE_CROP = { top: 0.68, bottom: 0.84 };

/** Distant skyline cylinder height (world units). */
const HORIZON_RING_H = 48;

export function harborEquirectPlateBand(canvasH = 1024): {
  bandY: number;
  bandH: number;
  pierCanvasV: number;
} {
  const bandH = Math.floor(canvasH * 0.85);
  const bandY = Math.floor(canvasH * 0.5 - HARBOR_HORIZON_PIER_V * bandH);
  const pierCanvasV = (bandY + HARBOR_HORIZON_PIER_V * bandH) / canvasH;
  return { bandY, bandH, pierCanvasV };
}

export function horizonRingLayout(theme: string): { ringH: number; centerY: number } {
  const ringH = HORIZON_RING_H;
  if (panoramaKind(theme) === "harbor") {
    // Pier line in the baked `harbor-skyline.png` strip (v from top).
    const pierFromBottom = 1 - 0.64;
    const pierWorldY = 0.2;
    const ringYBottom = pierWorldY - pierFromBottom * ringH;
    return { ringH, centerY: ringYBottom + ringH / 2 };
  }
  const eyeY = 3.8;
  const skylineV = 0.52;
  const ringYBottom = eyeY - skylineV * ringH;
  return { ringH, centerY: ringYBottom + ringH / 2 };
}

/**
 * Equirectangular harbor fill — sky + water. The authored skyline is stamped so
 * its pier sits on the equirect equator (v=0.5); anything below that is hidden
 * by the ground plane.
 */
export function makeHarborEquirectTexture(look: ThemeLook): Texture {
  const w = 2048;
  const h = 1024;
  const canvas = makeCanvas(w, h);
  if (!canvas) return solidTexture(look.sky);
  const { c, ctx } = canvas;

  const sky = ctx.createLinearGradient(0, 0, 0, h * 0.5);
  sky.addColorStop(0, hexCss(look.hemiSky));
  sky.addColorStop(0.55, hexCss(look.sky));
  sky.addColorStop(1, hexCss(look.skyLow));
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h * 0.5);

  ctx.fillStyle = "rgba(248,249,250,0.9)";
  for (let i = 0; i < 14; i++) {
    const x = (i * 150 + 40) % w;
    const y = 40 + (i % 5) * 28;
    ctx.beginPath();
    ctx.ellipse(x, y, 90 + (i % 3) * 20, 18, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  const { bandY, bandH } = harborEquirectPlateBand(h);
  const shipped = shippedPlate("harbor", "horizon");
  const img = shipped?.image as CanvasImageSource | undefined;
  if (img) {
    ctx.drawImage(img, 0, bandY, w, bandH);
  } else {
    const strip = makeCanvas(1024, 256);
    if (strip) {
      paintHarborHorizon(strip.ctx, look);
      ctx.drawImage(strip.c, 0, bandY, w, bandH);
    }
  }

  ctx.fillStyle = "#2f6f9e";
  ctx.fillRect(0, h * 0.72, w, h * 0.28);
  ctx.strokeStyle = "rgba(200,230,255,0.4)";
  ctx.lineWidth = 4;
  for (let i = 0; i < 6; i++) {
    const y = h * 0.72 + i * 40;
    ctx.beginPath();
    ctx.moveTo(0, y);
    for (let x = 0; x <= w; x += 32) {
      ctx.lineTo(x, y + ((x / 32 + i) % 2 === 0 ? 5 : -4));
    }
    ctx.stroke();
  }

  const tex = texFrom(c);
  tex.mapping = EquirectangularReflectionMapping;
  return tex;
}

function panoramaKind(theme: string): PanoramaKind {
  const t = theme.toLowerCase();
  if (t === "beach" || t === "city" || t === "factory" || t === "canyon") return t;
  if (t === "scrapyard") return "factory";
  if (t === "mountain") return "canyon";
  return "harbor";
}

export function themeToPanoramaKind(theme: string): PanoramaKind {
  return panoramaKind(theme);
}

function paintHarborHorizon(ctx: CanvasRenderingContext2D, look: ThemeLook): void {
  const sky = hexCss(look.sky);
  const skyLow = hexCss(look.skyLow);
  const outline = "#1B1B1F";

  const bg = ctx.createLinearGradient(0, 0, 0, 256);
  bg.addColorStop(0, sky);
  bg.addColorStop(0.45, skyLow);
  bg.addColorStop(0.62, "#3d7eae");
  bg.addColorStop(0.72, "#2f6f9e");
  bg.addColorStop(1, "#245a82");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 1024, 256);

  ctx.fillStyle = "rgba(248,249,250,0.9)";
  for (let i = 0; i < 12; i++) {
    const x = (i * 89 + 30) % 1024;
    const y = 22 + (i % 4) * 10;
    ctx.beginPath();
    ctx.ellipse(x, y, 52 + (i % 3) * 14, 12, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Distant haze skyline
  ctx.fillStyle = "#4a6f88";
  for (let i = 0; i < 18; i++) {
    const x = i * 58;
    const h = 18 + (i % 5) * 8;
    ctx.fillRect(x, 150 - h, 40, h);
  }

  // Water band with ripples
  ctx.fillStyle = "#2f6f9e";
  ctx.fillRect(0, 168, 1024, 88);
  ctx.strokeStyle = outline;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, 168);
  ctx.lineTo(1024, 168);
  ctx.stroke();
  ctx.strokeStyle = "rgba(200,230,255,0.55)";
  ctx.lineWidth = 2;
  for (let i = 0; i < 5; i++) {
    const y = 185 + i * 12;
    ctx.beginPath();
    ctx.moveTo(0, y);
    for (let x = 0; x <= 1024; x += 24) {
      ctx.lineTo(x, y + ((x / 24 + i) % 2 === 0 ? 3 : -2));
    }
    ctx.stroke();
  }

  const drawBox = (x: number, y: number, w: number, h: number, fill: string) => {
    ctx.fillStyle = fill;
    ctx.strokeStyle = outline;
    ctx.lineWidth = 3;
    ctx.fillRect(x, y, w, h);
    ctx.strokeRect(x, y, w, h);
  };

  // Pier ribbon
  ctx.fillStyle = "#7a828c";
  ctx.fillRect(0, 155, 1024, 18);
  ctx.strokeStyle = outline;
  ctx.lineWidth = 3;
  ctx.strokeRect(0, 155, 1024, 18);

  for (let i = 0; i < 8; i++) {
    const x = 36 + i * 128;
    // Crane
    drawBox(x + 20, 55, 12, 108, "#e85d04");
    drawBox(x - 18, 62, 110, 10, "#e85d04");
    drawBox(x + 8, 88, 26, 18, "#f8f9fa");
    // Containers
    const colors = ["#e03131", "#1c7ed6", "#f6c90e", "#2f9e44"];
    for (let j = 0; j < 4; j++) {
      drawBox(x + 48 + j * 18, 138 - (j % 2) * 16, 16, 16, colors[j % colors.length]!);
    }
    // Warehouse / silo
    if (i % 2 === 0) {
      drawBox(x + 100, 118, 42, 40, "#8b9098");
      ctx.fillStyle = "#f8f9fa";
      ctx.strokeStyle = outline;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(x - 28, 142, 16, 40, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#e03131";
      ctx.fillRect(x - 42, 132, 28, 8);
    }
    // Ship silhouette on water
    if (i % 3 === 0) {
      ctx.fillStyle = "#1c7ed6";
      ctx.strokeStyle = outline;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x + 70, 210);
      ctx.lineTo(x + 90, 188);
      ctx.lineTo(x + 170, 188);
      ctx.lineTo(x + 190, 210);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      drawBox(x + 145, 168, 28, 22, "#f8f9fa");
    }
  }
}

/** Wide comic silhouette strip for a surrounding cylinder. */
export function makeHorizonPanoramaTexture(theme: string, look: ThemeLook): Texture {
  return makeHorizonPanoramaTextureForKind(panoramaKind(theme), look);
}

export function makeHorizonPanoramaTextureForKind(kind: PanoramaKind, look: ThemeLook): Texture {
  if (kind === "harbor") {
    const strip = shippedPlate("harbor", "skyline");
    if (strip) return strip;
    const canvas = makeCanvas(1024, 256);
    if (!canvas) return solidTexture(look.skyLow);
    paintHarborHorizon(canvas.ctx, look);
    return texFrom(canvas.c);
  }
  const shipped = shippedPlate(kind, "horizon");
  if (shipped) return shipped;

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

  if (kind === "beach") {
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

  ctx.strokeStyle = outline;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(0, 200);
  ctx.lineTo(1024, 200);
  ctx.stroke();

  return texFrom(c);
}

function paintHarborInfield(ctx: CanvasRenderingContext2D, look: ThemeLook): void {
  const outline = "#1B1B1F";
  ctx.fillStyle = hexCss(look.ground);
  ctx.fillRect(0, 0, 512, 512);

  // Quay ring
  ctx.fillStyle = "#7a828c";
  ctx.beginPath();
  ctx.arc(256, 256, 248, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = outline;
  ctx.lineWidth = 6;
  ctx.stroke();

  // Water
  ctx.fillStyle = "#2f6f9e";
  ctx.beginPath();
  ctx.arc(256, 256, 200, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = outline;
  ctx.lineWidth = 6;
  ctx.stroke();

  ctx.strokeStyle = "rgba(200,230,255,0.5)";
  ctx.lineWidth = 2;
  for (let i = 0; i < 5; i++) {
    ctx.beginPath();
    ctx.arc(256, 256, 60 + i * 28, 0.2, Math.PI * 1.6);
    ctx.stroke();
  }

  // Pier fingers
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const cx = 256 + Math.cos(a) * 210;
    const cy = 256 + Math.sin(a) * 210;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(a + Math.PI / 2);
    ctx.fillStyle = "#8b9098";
    ctx.fillRect(-14, -40, 28, 50);
    ctx.strokeStyle = outline;
    ctx.lineWidth = 3;
    ctx.strokeRect(-14, -40, 28, 50);
    ctx.fillStyle = "#fcc419";
    ctx.beginPath();
    ctx.arc(0, -28, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  // Ship + containers (flat top-down)
  ctx.fillStyle = "#1c7ed6";
  ctx.fillRect(170, 210, 180, 70);
  ctx.strokeStyle = outline;
  ctx.lineWidth = 4;
  ctx.strokeRect(170, 210, 180, 70);
  ctx.fillStyle = "#f8f9fa";
  ctx.fillRect(300, 220, 40, 50);
  ctx.strokeRect(300, 220, 40, 50);
  const cols = ["#e03131", "#f6c90e", "#2f9e44", "#1c7ed6"];
  for (let i = 0; i < 8; i++) {
    ctx.fillStyle = cols[i % cols.length]!;
    ctx.fillRect(180 + (i % 4) * 28, 220 + Math.floor(i / 4) * 26, 24, 22);
    ctx.strokeRect(180 + (i % 4) * 28, 220 + Math.floor(i / 4) * 26, 24, 22);
  }
}

/** Infield disc texture — distant feel inside the loop (basin / hills / stands). */
export function makeInfieldPanoramaTexture(theme: string, look: ThemeLook): Texture {
  return makeInfieldPanoramaTextureForKind(panoramaKind(theme), look);
}

export function makeInfieldPanoramaTextureForKind(kind: PanoramaKind, look: ThemeLook): Texture {
  const shipped = shippedPlate(kind, "infield");
  if (shipped) return shipped;

  const canvas = makeCanvas(512, 512);
  if (!canvas) return solidTexture(look.ground);
  const { c, ctx } = canvas;
  const ground = hexCss(look.ground);
  ctx.fillStyle = ground;
  ctx.fillRect(0, 0, 512, 512);

  if (kind === "harbor") {
    paintHarborInfield(ctx, look);
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

/** Flat harbor water plate (apron) — cel ripples, no modelled props. */
export function makeHarborWaterTexture(): Texture {
  const canvas = makeCanvas(256, 256);
  if (!canvas) return solidTexture(0x2f6f9e);
  const { c, ctx } = canvas;
  ctx.fillStyle = "#2f6f9e";
  ctx.fillRect(0, 0, 256, 256);
  ctx.fillStyle = "#3a86b5";
  ctx.fillRect(0, 0, 256, 128);
  ctx.strokeStyle = "rgba(200,230,255,0.45)";
  ctx.lineWidth = 3;
  for (let i = 0; i < 8; i++) {
    const y = 24 + i * 28;
    ctx.beginPath();
    ctx.moveTo(0, y);
    for (let x = 0; x <= 256; x += 16) {
      ctx.lineTo(x, y + ((x / 16 + i) % 2 === 0 ? 4 : -3));
    }
    ctx.stroke();
  }
  return texFrom(c);
}

export function buildSkyDomeMesh(look: ThemeLook, theme = "harbor"): Mesh {
  const harbor = theme.toLowerCase() === "harbor";
  const mesh = new Mesh(
    new SphereGeometry(harbor ? 520 : 380, harbor ? 48 : 32, harbor ? 28 : 20),
    new MeshBasicMaterial({ map: makeSkyDomeTexture(look, theme), side: BackSide, fog: false }),
  );
  mesh.scale.y = harbor ? 0.88 : 0.72;
  mesh.name = "skyDome";
  return mesh;
}

/**
 * Distant surround: standing horizon cylinder for every theme (harbor included)
 * plus harbor water apron / infield discs above the ground plane.
 */
export function buildPanoramaSurround(track: BuiltTrack, theme: string, look: ThemeLook): Group {
  const root = new Group();
  root.name = "panoramaSurround";
  const harbor = panoramaKind(theme) === "harbor";

  const c = trackCentroid(track);
  let maxR = 40;
  for (const p of track.centerline) {
    maxR = Math.max(maxR, Math.hypot(p.x - c.x, p.z - c.z));
  }

  if (harbor) {
    const apronInner = maxR + track.asphaltHalfWidth + 2;
    const apronOuter = maxR + track.asphaltHalfWidth + track.grassWidth + 58;
    const apron = new Mesh(
      new RingGeometry(Math.max(8, apronInner), apronOuter, 64),
      new MeshBasicMaterial({
        map: makeHarborWaterTexture(),
        side: DoubleSide,
        fog: false,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1,
      }),
    );
    apron.rotation.x = -Math.PI / 2;
    apron.position.set(c.x, PANORAMA_DECK_Y, c.z);
    apron.name = "harborWaterApron";
    apron.renderOrder = 1;
    root.add(apron);
  }

  const ringR = maxR + track.asphaltHalfWidth + track.grassWidth + 55;
  const { ringH, centerY } = horizonRingLayout(theme);
  const ring = new Mesh(
    new CylinderGeometry(ringR, ringR, ringH, 64, 1, true),
    new MeshBasicMaterial({
      map: makeHorizonPanoramaTexture(theme, look),
      side: DoubleSide,
      fog: false,
    }),
  );
  ring.position.set(c.x, centerY, c.z);
  ring.name = "horizonPanorama";
  ring.userData.homeY = centerY;
  ring.userData.homeScaleY = 1;
  ring.renderOrder = 1;
  root.add(ring);

  const infieldR = infieldClearRadius(track);
  if (infieldR >= 7) {
    const disc = new Mesh(
      new PlaneGeometry(infieldR * 2.15, infieldR * 2.15),
      new MeshBasicMaterial({
        map: makeInfieldPanoramaTexture(theme, look),
        fog: false,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1,
      }),
    );
    disc.rotation.x = -Math.PI / 2;
    disc.position.set(c.x, PANORAMA_DECK_Y, c.z);
    disc.name = "infieldPanorama";
    disc.renderOrder = 1;
    root.add(disc);
  }

  return root;
}

/** F8 editor: raise/lower and stretch the horizon cylinder from its authored pose. */
export function applyHorizonHeight(root: Object3D, offsetY: number, heightScale: number): void {
  const ring = root.getObjectByName("horizonPanorama");
  if (!ring) return;
  if (typeof ring.userData.homeY !== "number") ring.userData.homeY = ring.position.y;
  if (typeof ring.userData.homeScaleY !== "number") ring.userData.homeScaleY = ring.scale.y;
  ring.position.y = ring.userData.homeY + offsetY;
  ring.scale.y = ring.userData.homeScaleY * Math.max(0.15, heightScale);
}

function disposePanoramaMap(map: Texture | null | undefined): void {
  if (!map || shippedPanorama.has(plateKeyFromTexture(map))) return;
  map.dispose();
}

function plateKeyFromTexture(tex: Texture): string {
  for (const [key, shared] of shippedPanorama.entries()) {
    if (shared === tex) return key;
  }
  return "";
}

/** F8 editor: swap horizon + infield dome textures without rebuilding the track. */
export function applyPanoramaKind(root: Object3D, kind: PanoramaKind, look: ThemeLook): void {
  const ring = root.getObjectByName("horizonPanorama") as Mesh | undefined;
  if (ring?.material instanceof MeshBasicMaterial) {
    const next = makeHorizonPanoramaTextureForKind(kind, look);
    disposePanoramaMap(ring.material.map);
    ring.material.map = next;
    ring.material.needsUpdate = true;
  }
  const disc = root.getObjectByName("infieldPanorama") as Mesh | undefined;
  if (disc?.material instanceof MeshBasicMaterial) {
    const next = makeInfieldPanoramaTextureForKind(kind, look);
    disposePanoramaMap(disc.material.map);
    disc.material.map = next;
    disc.material.needsUpdate = true;
  }
}

export function disposePanoramaMaps(root: Group): void {
  const shared = new Set(shippedPanorama.values());
  root.traverse((obj) => {
    const mesh = obj as Mesh;
    const mat = mesh.material as MeshBasicMaterial | MeshBasicMaterial[] | undefined;
    const mats = Array.isArray(mat) ? mat : mat ? [mat] : [];
    for (const m of mats) {
      if (m?.map && !shared.has(m.map)) {
        m.map.dispose();
        m.map = null;
      }
    }
  });
}
