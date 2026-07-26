/**
 * Asphalt-Comic canvas overlays for the garage bay blocks.
 * Same language as carOverlays: flat ink hatch, thick outlines, no photoreal grit.
 */
import {
  CanvasTexture,
  DataTexture,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  NearestFilter,
  PlaneGeometry,
  RGBAFormat,
  SRGBColorSpace,
  type Texture,
} from "three";
import { ComicPaletteCss } from "./palette";

const texCache = new Map<string, Texture>();

export function clearGarageOverlayTextureCache(): void {
  for (const t of texCache.values()) t.dispose();
  texCache.clear();
}

export function garageOverlayTextureCacheSize(): number {
  return texCache.size;
}

function outlineCss(): string {
  return ComicPaletteCss.outline;
}

function fallbackTex(): DataTexture {
  const data = new Uint8Array([255, 255, 255, 180]);
  const tex = new DataTexture(data, 1, 1, RGBAFormat);
  tex.needsUpdate = true;
  tex.minFilter = NearestFilter;
  tex.magFilter = NearestFilter;
  return tex;
}

function canvasTex(key: string, w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void): Texture {
  const hit = texCache.get(key);
  if (hit) return hit;
  if (typeof document === "undefined") {
    const tex = fallbackTex();
    texCache.set(key, tex);
    return tex;
  }
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  if (!ctx) {
    const tex = fallbackTex();
    texCache.set(key, tex);
    return tex;
  }
  draw(ctx);
  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  tex.minFilter = NearestFilter;
  tex.magFilter = NearestFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  texCache.set(key, tex);
  return tex;
}

function hatch(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  spacing = 10,
  angle = -0.4,
  alpha = 0.35,
): void {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.strokeStyle = outlineCss();
  ctx.lineWidth = 1.4;
  ctx.globalAlpha = alpha;
  const pad = Math.hypot(w, h);
  ctx.translate(x + w / 2, y + h / 2);
  ctx.rotate(angle);
  for (let i = -pad; i < pad; i += spacing) {
    ctx.beginPath();
    ctx.moveTo(i, -pad * 0.55);
    ctx.lineTo(i, pad * 0.55);
    ctx.stroke();
  }
  ctx.restore();
  ctx.globalAlpha = 1;
}

/** Race-pad asphalt: tire arcs, edge ink, sparse hatch. */
export function asphaltPadTexture(): Texture {
  return canvasTex("garage-asphalt-pad", 512, 640, (ctx) => {
    const w = 512;
    const h = 640;
    ctx.clearRect(0, 0, w, h);

    // Soft cel shade pools (transparent fill via alpha)
    ctx.fillStyle = "rgba(27, 27, 31, 0.18)";
    ctx.beginPath();
    ctx.ellipse(w * 0.5, h * 0.55, 180, 90, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(w * 0.35, h * 0.35, 70, 40, 0.3, 0, Math.PI * 2);
    ctx.fill();

    hatch(ctx, 20, 40, w - 40, h - 80, 14, -0.45, 0.22);

    // Tire skid arcs (comic ink, not photo rubber)
    ctx.strokeStyle = outlineCss();
    ctx.lineCap = "round";
    ctx.globalAlpha = 0.55;
    for (const [cx, cy, r, a0, a1, lw] of [
      [210, 420, 95, 0.2, 1.4, 5],
      [320, 400, 110, -0.3, 1.1, 4],
      [250, 280, 70, 0.5, 2.2, 3.5],
      [180, 500, 55, -0.8, 0.6, 3],
    ] as const) {
      ctx.lineWidth = lw;
      ctx.beginPath();
      ctx.arc(cx, cy, r, a0, a1);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // Speed ticks along center
    ctx.strokeStyle = ComicPaletteCss.asphaltLine;
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = 3;
    for (let y = 80; y < h - 80; y += 48) {
      ctx.beginPath();
      ctx.moveTo(w * 0.5 - 6, y);
      ctx.lineTo(w * 0.5 + 6, y + 18);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // Thick pad outline
    ctx.strokeStyle = outlineCss();
    ctx.lineWidth = 10;
    ctx.strokeRect(8, 8, w - 16, h - 16);
    ctx.lineWidth = 4;
    ctx.globalAlpha = 0.35;
    ctx.strokeRect(22, 22, w - 44, h - 44);
    ctx.globalAlpha = 1;
  });
}

/** Concrete wall panel: seams, cracks, corner hatch. */
export function wallPanelTexture(seed: number): Texture {
  return canvasTex(`garage-wall-${seed}`, 512, 384, (ctx) => {
    const w = 512;
    const h = 384;
    ctx.clearRect(0, 0, w, h);

    hatch(ctx, 0, 0, w, h * 0.35, 12, -0.5, 0.28);
    hatch(ctx, 0, h * 0.65, w, h * 0.35, 11, 0.35, 0.22);

    // Panel seams
    ctx.strokeStyle = outlineCss();
    ctx.lineWidth = 5;
    ctx.globalAlpha = 0.7;
    for (const x of [128, 256, 384]) {
      ctx.beginPath();
      ctx.moveTo(x, 16);
      ctx.lineTo(x, h - 16);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(16, h * 0.5);
    ctx.lineTo(w - 16, h * 0.5);
    ctx.stroke();
    ctx.globalAlpha = 1;

    // Comic cracks
    ctx.lineWidth = 2.5;
    ctx.globalAlpha = 0.65;
    const cracks: [number, number, number, number][] = [
      [40 + (seed % 30), 60, 90, 110],
      [300, 40 + seed * 3, 340, 95],
      [180, 220, 240, 280],
      [400, 200, 470, 250],
      [70, 300, 130, 340],
    ];
    for (const [x0, y0, x1, y1] of cracks) {
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo((x0 + x1) / 2 + 8, (y0 + y1) / 2 - 6);
      ctx.lineTo(x1, y1);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // Outer stroke
    ctx.lineWidth = 8;
    ctx.strokeRect(6, 6, w - 12, h - 12);

    // Rivet dots along seams
    ctx.fillStyle = outlineCss();
    ctx.globalAlpha = 0.55;
    for (const x of [128, 256, 384]) {
      for (let y = 40; y < h - 30; y += 36) {
        ctx.beginPath();
        ctx.arc(x, y, 3.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  });
}

/** Black/yellow hazard chevrons (reference track barriers). */
export function hazardChevronTexture(): Texture {
  return canvasTex("garage-hazard-chevron", 512, 96, (ctx) => {
    const w = 512;
    const h = 96;
    ctx.fillStyle = ComicPaletteCss.repairSpark;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = outlineCss();
    const step = 48;
    for (let x = -h; x < w + h; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + h * 0.55, 0);
      ctx.lineTo(x + h * 0.55 + h, h);
      ctx.lineTo(x + h, h);
      ctx.closePath();
      ctx.fill();
    }
    ctx.strokeStyle = outlineCss();
    ctx.lineWidth = 6;
    ctx.strokeRect(3, 3, w - 6, h - 6);
  });
}

/** Red locker door: panel crease + handle plate. */
export function cabinetDoorTexture(): Texture {
  return canvasTex("garage-cabinet-door", 256, 384, (ctx) => {
    const w = 256;
    const h = 384;
    ctx.clearRect(0, 0, w, h);
    hatch(ctx, 12, 12, w - 24, h - 24, 9, -0.55, 0.3);

    ctx.strokeStyle = outlineCss();
    ctx.lineWidth = 7;
    ctx.strokeRect(10, 10, w - 20, h - 20);
    ctx.lineWidth = 4;
    ctx.strokeRect(28, 28, w - 56, h - 56);

    // Horizontal panel split
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(28, h * 0.48);
    ctx.lineTo(w - 28, h * 0.48);
    ctx.stroke();

    // Handle plate
    ctx.fillStyle = ComicPaletteCss.repairSpark;
    ctx.fillRect(w - 58, h * 0.42, 22, 55);
    ctx.strokeStyle = outlineCss();
    ctx.lineWidth = 3;
    ctx.strokeRect(w - 58, h * 0.42, 22, 55);
  });
}

/** Crate stencil: thick border + X / barcode bars. */
export function crateStencilTexture(color: string): Texture {
  return canvasTex(`garage-crate-${color}`, 256, 256, (ctx) => {
    const w = 256;
    const h = 256;
    ctx.clearRect(0, 0, w, h);
    ctx.strokeStyle = outlineCss();
    ctx.lineWidth = 10;
    ctx.strokeRect(12, 12, w - 24, h - 24);
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(40, 40);
    ctx.lineTo(w - 40, h - 40);
    ctx.moveTo(w - 40, 40);
    ctx.lineTo(40, h - 40);
    ctx.stroke();

    ctx.fillStyle = outlineCss();
    ctx.globalAlpha = 0.7;
    for (let i = 0; i < 5; i++) {
      ctx.fillRect(48 + i * 14, h - 52, 8, 28);
    }
    ctx.globalAlpha = 1;

    // Color chip corner
    ctx.fillStyle = color;
    ctx.fillRect(18, 18, 36, 36);
    ctx.strokeStyle = outlineCss();
    ctx.lineWidth = 3;
    ctx.strokeRect(18, 18, 36, 36);
  });
}

/** Banner face: comic stripes + hard title block. */
export function bannerTexture(): Texture {
  return canvasTex("garage-banner", 640, 128, (ctx) => {
    const w = 640;
    const h = 128;
    ctx.clearRect(0, 0, w, h);
    hatch(ctx, 0, 0, w, h, 8, -0.6, 0.35);

    ctx.fillStyle = ComicPaletteCss.repairSpark;
    ctx.fillRect(24, h * 0.62, w - 48, 14);
    ctx.fillStyle = outlineCss();
    ctx.fillRect(24, 18, w - 48, 10);

    ctx.strokeStyle = outlineCss();
    ctx.lineWidth = 8;
    ctx.strokeRect(10, 10, w - 20, h - 20);

    // Fake bold word marks (geometric, no font dependency)
    ctx.fillStyle = ComicPaletteCss.curbLight;
    ctx.globalAlpha = 0.95;
    const blocks = [
      [80, 40, 70, 28],
      [165, 40, 50, 28],
      [230, 40, 90, 28],
      [340, 40, 40, 28],
      [400, 40, 100, 28],
      [520, 40, 55, 28],
    ] as const;
    for (const [x, y, bw, bh] of blocks) {
      ctx.fillRect(x, y, bw, bh);
      ctx.strokeStyle = outlineCss();
      ctx.lineWidth = 3;
      ctx.strokeRect(x, y, bw, bh);
    }
    ctx.globalAlpha = 1;
  });
}

/** Outer floor grit strip beyond the race pad. */
export function floorGritTexture(): Texture {
  return canvasTex("garage-floor-grit", 512, 512, (ctx) => {
    const w = 512;
    const h = 512;
    ctx.clearRect(0, 0, w, h);
    hatch(ctx, 0, 0, w, h, 16, 0.25, 0.2);
    ctx.strokeStyle = outlineCss();
    ctx.globalAlpha = 0.4;
    ctx.lineWidth = 2;
    for (let i = 0; i < 18; i++) {
      const x = 30 + ((i * 97) % 450);
      const y = 40 + ((i * 53) % 430);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + 8 + (i % 5), y + 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  });
}

/** Poster frame with bold comic panel. */
export function posterOverlayTexture(accent: string): Texture {
  return canvasTex(`garage-poster-${accent}`, 256, 192, (ctx) => {
    const w = 256;
    const h = 192;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = accent;
    ctx.globalAlpha = 0.35;
    ctx.fillRect(20, 20, w - 40, h - 40);
    ctx.globalAlpha = 1;
    hatch(ctx, 20, 20, w - 40, h - 40, 8, -0.4, 0.4);
    ctx.strokeStyle = outlineCss();
    ctx.lineWidth = 10;
    ctx.strokeRect(8, 8, w - 16, h - 16);
    ctx.lineWidth = 4;
    ctx.strokeRect(22, 22, w - 44, h - 44);
    // Star burst mark
    ctx.fillStyle = ComicPaletteCss.repairSpark;
    ctx.beginPath();
    ctx.moveTo(w * 0.5, 48);
    ctx.lineTo(w * 0.55, 78);
    ctx.lineTo(w * 0.72, 78);
    ctx.lineTo(w * 0.58, 98);
    ctx.lineTo(w * 0.64, 128);
    ctx.lineTo(w * 0.5, 110);
    ctx.lineTo(w * 0.36, 128);
    ctx.lineTo(w * 0.42, 98);
    ctx.lineTo(w * 0.28, 78);
    ctx.lineTo(w * 0.45, 78);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = outlineCss();
    ctx.lineWidth = 3;
    ctx.stroke();
  });
}

function decal(tex: Texture, w: number, h: number, opacity = 1): Mesh {
  const mat = new MeshBasicMaterial({
    map: tex,
    transparent: true,
    opacity,
    side: DoubleSide,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  const mesh = new Mesh(new PlaneGeometry(w, h), mat);
  mesh.renderOrder = 4;
  return mesh;
}

/** Attach Asphalt-Comic ink overlays onto the existing garage block volumes. */
export function buildGarageOverlays(): Group {
  const g = new Group();
  g.name = "garageOverlays";

  // Race pad top
  const pad = decal(asphaltPadTexture(), 10.6, 15.4, 0.85);
  pad.rotation.x = -Math.PI / 2;
  pad.position.set(1.5, 0.12, 0);
  g.add(pad);

  // Outer floor grit (behind pad, still visible around edges)
  const grit = decal(floorGritTexture(), 26, 28, 0.35);
  grit.rotation.x = -Math.PI / 2;
  grit.position.set(1, 0.09, 0);
  g.add(grit);

  // Back wall
  const back = decal(wallPanelTexture(1), 24, 9.5, 0.55);
  back.position.set(1, 5.2, -10.72);
  g.add(back);

  // Side walls (inward faces)
  const left = decal(wallPanelTexture(2), 22, 9.5, 0.5);
  left.position.set(-11.22, 5.2, 0);
  left.rotation.y = Math.PI / 2;
  g.add(left);

  const right = decal(wallPanelTexture(3), 22, 9.5, 0.5);
  right.position.set(12.22, 5.2, 0);
  right.rotation.y = -Math.PI / 2;
  g.add(right);

  // Hazard chevron bar (replaces flat stripe read with reference language)
  const hazard = decal(hazardChevronTexture(), 12.5, 0.75, 0.95);
  hazard.position.set(1.5, 1.15, -10.68);
  g.add(hazard);

  // Banner face
  const banner = decal(bannerTexture(), 11.6, 1.35, 0.9);
  banner.position.set(1.5, 7.55, -10.55);
  g.add(banner);

  // Cabinets
  for (const z of [-7, -3.5] as const) {
    const door = decal(cabinetDoorTexture(), 1.65, 2.2, 0.75);
    door.position.set(-7.25, 1.2, z);
    door.rotation.y = Math.PI / 2;
    g.add(door);
  }

  // Crates on shelf
  const crateColors = ["#E03131", "#339AF0", "#F08C00", "#37B24D"] as const;
  for (let i = 0; i < 4; i++) {
    const face = decal(crateStencilTexture(crateColors[i]!), 0.78, 0.62, 0.85);
    face.position.set(7 + i * 1.05, 3.05, -8.78);
    g.add(face);
  }

  // Wall posters
  const posterAccents = ["#339AF0", "#F08C00", "#E03131"] as const;
  for (let i = 0; i < 3; i++) {
    const p = decal(posterOverlayTexture(posterAccents[i]!), 1.45, 1.05, 0.8);
    p.position.set(-10.72, 4 + (i % 2) * 0.3, -4 + i * 3.2);
    p.rotation.y = Math.PI / 2;
    g.add(p);
  }

  return g;
}
