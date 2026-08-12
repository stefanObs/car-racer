/**
 * Bright Asphalt-Comic garage textures.
 * Prefer Tripo-pipeline albedo sheets under `public/models/garage/*-albedo.png`
 * (authored with Tripo shell meshes); canvas fallbacks keep unit tests / offline boot green.
 */
import {
  CanvasTexture,
  DataTexture,
  NearestFilter,
  RepeatWrapping,
  RGBAFormat,
  SRGBColorSpace,
  TextureLoader,
  type Texture,
} from "three";
import { ComicPaletteCss } from "./palette";

const texCache = new Map<string, Texture>();
const shippedMaps = new Map<string, Texture>();
let shellPreload: Promise<void> | null = null;

export const GARAGE_SHELL_ALBEDO = {
  floor: "/models/garage/floor-albedo.png",
  wall: "/models/garage/wall-albedo.png",
  turntable: "/models/garage/turntable-albedo.png",
} as const;

export function clearGarageTextureCache(): void {
  for (const t of texCache.values()) t.dispose();
  texCache.clear();
}

export function garageTextureCacheSize(): number {
  return texCache.size + shippedMaps.size;
}

export function hasShippedGarageShellTexture(kind: keyof typeof GARAGE_SHELL_ALBEDO): boolean {
  return shippedMaps.has(kind);
}

/** Load Tripo-pipeline albedo sheets before building the bay (see main boot). */
export function preloadGarageShellTextures(): Promise<void> {
  if (shellPreload) return shellPreload;
  shellPreload = (async () => {
    if (typeof document === "undefined") return;
    const loader = new TextureLoader();
    await Promise.all(
      (Object.entries(GARAGE_SHELL_ALBEDO) as Array<[keyof typeof GARAGE_SHELL_ALBEDO, string]>).map(
        async ([kind, url]) => {
          try {
            const tex = await loader.loadAsync(url);
            tex.colorSpace = SRGBColorSpace;
            tex.minFilter = NearestFilter;
            tex.magFilter = NearestFilter;
            tex.generateMipmaps = false;
            if (kind === "floor") {
              tex.wrapS = RepeatWrapping;
              tex.wrapT = RepeatWrapping;
              tex.repeat.set(2.4, 2.4);
            } else if (kind === "wall") {
              tex.wrapS = RepeatWrapping;
              tex.wrapT = RepeatWrapping;
              tex.repeat.set(1.8, 1.2);
            } else {
              tex.wrapS = RepeatWrapping;
              tex.wrapT = RepeatWrapping;
              tex.repeat.set(1, 1);
            }
            tex.needsUpdate = true;
            shippedMaps.set(kind, tex);
          } catch (err) {
            console.warn(`[garage] shell albedo skipped (${kind})`, err);
          }
        },
      ),
    );
    clearGarageTextureCache();
  })();
  return shellPreload;
}

function shippedOrCanvas(kind: keyof typeof GARAGE_SHELL_ALBEDO, canvasKey: string, build: () => Texture): Texture {
  const shipped = shippedMaps.get(kind);
  if (shipped) return shipped;
  const hit = texCache.get(canvasKey);
  if (hit) return hit;
  const tex = build();
  texCache.set(canvasKey, tex);
  return tex;
}

function ink(): string {
  return ComicPaletteCss.outline;
}

function fallbackTex(r = 200, g = 205, b = 210): DataTexture {
  const data = new Uint8Array([r, g, b, 255]);
  const tex = new DataTexture(data, 1, 1, RGBAFormat);
  tex.needsUpdate = true;
  tex.minFilter = NearestFilter;
  tex.magFilter = NearestFilter;
  return tex;
}

type CanvasTexOpts = { repeatX?: number; repeatY?: number; fallbackRgb?: [number, number, number] };

function canvasTex(
  key: string,
  w: number,
  h: number,
  draw: (ctx: CanvasRenderingContext2D) => void,
  opts: CanvasTexOpts = {},
): Texture {
  const hit = texCache.get(key);
  if (hit) return hit;
  if (typeof document === "undefined") {
    const [r, g, b] = opts.fallbackRgb ?? [200, 205, 210];
    const tex = fallbackTex(r, g, b);
    texCache.set(key, tex);
    return tex;
  }
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  if (!ctx) {
    const [r, g, b] = opts.fallbackRgb ?? [200, 205, 210];
    const tex = fallbackTex(r, g, b);
    texCache.set(key, tex);
    return tex;
  }
  draw(ctx);
  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  tex.minFilter = NearestFilter;
  tex.magFilter = NearestFilter;
  tex.generateMipmaps = false;
  if (opts.repeatX || opts.repeatY) {
    tex.wrapS = RepeatWrapping;
    tex.wrapT = RepeatWrapping;
    tex.repeat.set(opts.repeatX ?? 1, opts.repeatY ?? 1);
  }
  tex.needsUpdate = true;
  texCache.set(key, tex);
  return tex;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

/**
 * Workshop concrete floor: Tripo-pipeline albedo sheet when preloaded;
 * otherwise canvas cel slabs (readable when tiled on the bay plane).
 */
export function floorTexture(): Texture {
  return shippedOrCanvas("floor", "garage-floor-v8", () =>
    canvasTex(
    "garage-floor-v8",
    1024,
    1024,
    (ctx) => {
      const w = 1024;
      const h = 1024;
      // Base — cooler dark concrete (2–3 value steps)
      ctx.fillStyle = "#6E747C";
      ctx.fillRect(0, 0, w, h);
      const slab = 128;
      for (let y = 0; y < h; y += slab) {
        for (let x = 0; x < w; x += slab) {
          const shade = ((x / slab + y / slab) % 2 === 0 ? "#7A8088" : "#656B73");
          ctx.fillStyle = shade;
          ctx.fillRect(x + 2, y + 2, slab - 4, slab - 4);
          // Hard cel highlight on each slab corner
          ctx.fillStyle = "rgba(232,226,214,0.14)";
          ctx.fillRect(x + 6, y + 6, slab * 0.38, slab * 0.18);
        }
      }
      // Expansion joints — thick comic ink
      ctx.strokeStyle = ink();
      ctx.lineWidth = 5;
      for (let x = slab; x < w; x += slab) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      for (let y = slab; y < h; y += slab) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }
      // Yellow parking bay frame (workshop cue from car-targets)
      ctx.strokeStyle = ComicPaletteCss.repairSpark;
      ctx.lineWidth = 14;
      ctx.strokeRect(72, 72, w - 144, h - 144);
      ctx.strokeStyle = ink();
      ctx.lineWidth = 4;
      ctx.strokeRect(72, 72, w - 144, h - 144);
      // Dashed center guide
      ctx.strokeStyle = ComicPaletteCss.asphaltLine;
      ctx.lineWidth = 8;
      ctx.setLineDash([28, 22]);
      ctx.beginPath();
      ctx.moveTo(w / 2, 100);
      ctx.lineTo(w / 2, h - 100);
      ctx.stroke();
      ctx.setLineDash([]);
      // Oil stains — flat comic blobs + outline
      const stains: Array<[number, number, number, number]> = [
        [220, 780, 90, 50],
        [710, 260, 70, 42],
        [480, 560, 110, 55],
        [160, 340, 55, 35],
      ];
      for (const [sx, sy, sw, sh] of stains) {
        ctx.fillStyle = "#3A3E46";
        ctx.beginPath();
        ctx.ellipse(sx, sy, sw, sh, -0.35, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = ink();
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.fillStyle = "rgba(27,27,31,0.45)";
        ctx.beginPath();
        ctx.ellipse(sx - sw * 0.15, sy - sh * 0.1, sw * 0.45, sh * 0.4, -0.2, 0, Math.PI * 2);
        ctx.fill();
      }
      // Tire scuff arcs
      ctx.strokeStyle = ink();
      ctx.lineWidth = 6;
      ctx.lineCap = "round";
      ctx.globalAlpha = 0.55;
      ctx.beginPath();
      ctx.arc(320, 700, 120, 0.2, 1.4);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(700, 420, 95, 2.2, 3.5);
      ctx.stroke();
      ctx.globalAlpha = 1;
      // Outer ink frame so tile seams stay readable
      ctx.strokeStyle = ink();
      ctx.lineWidth = 10;
      ctx.strokeRect(4, 4, w - 8, h - 8);
    },
    { repeatX: 3, repeatY: 3, fallbackRgb: [110, 116, 124] },
  ),
  );
}

/** Circular asphalt turntable with hazard ring. */
export function turntableTexture(): Texture {
  return shippedOrCanvas("turntable", "garage-turntable-v8", () =>
    canvasTex("garage-turntable-v8", 512, 512, (ctx) => {
    const w = 512;
    const h = 512;
    const cx = 256;
    const cy = 256;
    ctx.fillStyle = "#8A9098";
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = "#7A8088";
    ctx.lineWidth = 3;
    for (let r = 40; r < 230; r += 16) {
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
    }
    for (let i = 0; i < 24; i++) {
      const a0 = (i / 24) * Math.PI * 2;
      const a1 = ((i + 0.5) / 24) * Math.PI * 2;
      ctx.fillStyle = i % 2 === 0 ? ComicPaletteCss.repairSpark : ink();
      ctx.beginPath();
      ctx.arc(cx, cy, 252, a0, a1);
      ctx.arc(cx, cy, 218, a1, a0, true);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = "rgba(255,248,220,0.22)";
    ctx.beginPath();
    ctx.arc(cx, cy, 90, 0, Math.PI * 2);
    ctx.fill();
  }),
  );
}

/** Sunny race-pad asphalt with curb + dashes + ink grain. */
export function asphaltPadTexture(): Texture {
  return canvasTex("garage-asphalt-pad-v5", 640, 768, (ctx) => {
    const w = 640;
    const h = 768;
    ctx.fillStyle = "#8A9098";
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = "#7A8088";
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.65;
    for (let y = 20; y < h; y += 14) {
      ctx.beginPath();
      ctx.moveTo(40, y);
      ctx.lineTo(w - 40, y + (y % 28 === 0 ? 3 : -2));
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    const grad = ctx.createRadialGradient(w * 0.5, h * 0.48, 40, w * 0.5, h * 0.48, 220);
    grad.addColorStop(0, "rgba(255,248,220,0.28)");
    grad.addColorStop(1, "rgba(255,248,220,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = ink();
    ctx.lineCap = "round";
    ctx.globalAlpha = 0.45;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(230, 460, 100, 0.25, 1.35);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = ink();
    ctx.lineWidth = 10;
    ctx.strokeRect(6, 6, w - 12, h - 12);
  });
}

/**
 * Concrete wall panels: Tripo-pipeline albedo sheet when preloaded;
 * otherwise canvas mid-grey slabs + yellow shop stripe.
 */
export function wallPanelTexture(seed: number): Texture {
  if (seed === 1 || seed === 2 || seed === 3) {
    const shipped = shippedMaps.get("wall");
    if (shipped) return shipped;
  }
  return canvasTex(
    `garage-wall-v8-${seed}`,
    768,
    512,
    (ctx) => {
      const w = 768;
      const h = 512;
      const base = seed % 2 === 0 ? "#9AA1AA" : "#8E959E";
      const face = seed % 2 === 0 ? "#B0B6BE" : "#A4ABB4";
      ctx.fillStyle = base;
      ctx.fillRect(0, 0, w, h);

      const panels = 4;
      const gap = 10;
      const pw = (w - gap * (panels + 1)) / panels;
      for (let i = 0; i < panels; i++) {
        const x = gap + i * (pw + gap);
        ctx.fillStyle = face;
        ctx.fillRect(x, 16, pw, h * 0.74);
        ctx.fillStyle = "rgba(248,249,250,0.2)";
        ctx.fillRect(x, 16, pw, h * 0.12);
        ctx.strokeStyle = ink();
        ctx.lineWidth = 5;
        ctx.strokeRect(x, 16, pw, h * 0.74);
        for (const bx of [x + 14, x + pw - 14]) {
          for (let y = 44; y < h * 0.7; y += 56) {
            ctx.fillStyle = ink();
            ctx.beginPath();
            ctx.arc(bx, y, 5, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = "#E8E2D6";
            ctx.beginPath();
            ctx.arc(bx - 1.4, y - 1.4, 1.7, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }

      ctx.fillStyle = "#6E7580";
      ctx.fillRect(0, h * 0.78, w, h * 0.22);
      ctx.strokeStyle = ink();
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(0, h * 0.78);
      ctx.lineTo(w, h * 0.78);
      ctx.stroke();

      const stripeY = h * 0.36;
      ctx.fillStyle = ComicPaletteCss.repairSpark;
      ctx.fillRect(0, stripeY, w, 30);
      ctx.strokeStyle = ink();
      ctx.lineWidth = 5;
      ctx.strokeRect(0, stripeY, w, 30);
      ctx.fillStyle = "#E03131";
      ctx.fillRect(0, stripeY + 30, w, 9);
      ctx.strokeStyle = ink();
      ctx.lineWidth = 3;
      ctx.strokeRect(0, stripeY + 30, w, 9);

      ctx.strokeStyle = ink();
      ctx.lineWidth = 3.5;
      ctx.globalAlpha = 0.7;
      const ox = 70 + (seed % 3) * 40;
      ctx.beginPath();
      ctx.moveTo(ox, 70);
      ctx.lineTo(ox + 36, 115);
      ctx.lineTo(ox + 14, 165);
      ctx.lineTo(ox + 48, 210);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(w - ox, 80);
      ctx.lineTo(w - ox - 40, 140);
      ctx.lineTo(w - ox - 18, 195);
      ctx.stroke();
      ctx.globalAlpha = 1;

      ctx.fillStyle = "rgba(70,78,88,0.32)";
      ctx.beginPath();
      ctx.ellipse(180 + seed * 20, h * 0.62, 52, 24, 0.25, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(w - 200, h * 0.58, 40, 20, -0.35, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = ink();
      ctx.lineWidth = 10;
      ctx.strokeRect(5, 5, w - 10, h - 10);
    },
    { repeatX: seed === 1 ? 2.2 : 1.6, repeatY: 1.15, fallbackRgb: [168, 174, 182] },
  );
}

/** Bold hazard chevrons. */
export function hazardChevronTexture(): Texture {
  return canvasTex("garage-hazard-v4", 640, 128, (ctx) => {
    const w = 640;
    const h = 128;
    ctx.fillStyle = ComicPaletteCss.repairSpark;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = ink();
    const step = 56;
    for (let x = -h; x < w + h; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + h * 0.5, 0);
      ctx.lineTo(x + h * 0.5 + h, h);
      ctx.lineTo(x + h, h);
      ctx.closePath();
      ctx.fill();
    }
    ctx.strokeStyle = ink();
    ctx.lineWidth = 8;
    ctx.strokeRect(4, 4, w - 8, h - 8);
  });
}

/** Shop banner — CRASH CIRCUIT blocks. */
export function bannerTexture(): Texture {
  return canvasTex("garage-banner-v4", 768, 160, (ctx) => {
    const w = 768;
    const h = 160;
    ctx.fillStyle = "#E03131";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = ComicPaletteCss.repairSpark;
    ctx.fillRect(16, h - 28, w - 32, 12);
    ctx.fillStyle = "#F8F9FA";
    const blocks = [
      [48, 48, 78, 36],
      [140, 48, 56, 36],
      [210, 48, 90, 36],
      [320, 48, 48, 36],
      [386, 48, 110, 36],
      [516, 48, 62, 36],
      [600, 48, 100, 36],
    ] as const;
    for (const [x, y, bw, bh] of blocks) {
      roundRect(ctx, x, y, bw, bh, 4);
      ctx.fill();
      ctx.strokeStyle = ink();
      ctx.lineWidth = 3;
      ctx.stroke();
    }
    ctx.strokeStyle = ink();
    ctx.lineWidth = 10;
    ctx.strokeRect(6, 6, w - 12, h - 12);
  });
}

/** Wall slogan from the car-targets garage sheet. */
export function sloganPosterTexture(title: string, chevron: string): Texture {
  return canvasTex(`garage-slogan-v1-${title}`, 384, 220, (ctx) => {
    const w = 384;
    const h = 220;
    ctx.fillStyle = ink();
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = ComicPaletteCss.repairSpark;
    ctx.fillRect(10, 10, w - 20, 8);
    ctx.fillRect(10, h - 18, w - 20, 8);
    ctx.fillStyle = "#F8F9FA";
    ctx.font = "bold 36px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(title, w / 2, h * 0.42);
    ctx.fillStyle = chevron;
    for (let i = 0; i < 3; i++) {
      const x = 118 + i * 52;
      ctx.beginPath();
      ctx.moveTo(x, 148);
      ctx.lineTo(x + 28, 168);
      ctx.lineTo(x, 188);
      ctx.closePath();
      ctx.fill();
    }
    ctx.strokeStyle = ComicPaletteCss.repairSpark;
    ctx.lineWidth = 8;
    ctx.strokeRect(8, 8, w - 16, h - 16);
  });
}

/** Comic race poster. */
export function posterTexture(accent: string): Texture {
  return canvasTex(`garage-poster-v4-${accent}`, 320, 240, (ctx) => {
    const w = 320;
    const h = 240;
    ctx.fillStyle = accent;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = ComicPaletteCss.sky;
    ctx.fillRect(24, 80, w - 48, 70);
    ctx.fillStyle = ComicPaletteCss.asphalt;
    ctx.fillRect(24, 140, w - 48, 50);
    ctx.fillStyle = ComicPaletteCss.repairSpark;
    ctx.beginPath();
    ctx.moveTo(90, 155);
    ctx.lineTo(220, 160);
    ctx.lineTo(210, 175);
    ctx.lineTo(100, 175);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = ink();
    ctx.lineWidth = 12;
    ctx.strokeRect(8, 8, w - 16, h - 16);
  });
}

/** Sky peek through open bay door. */
export function skyPeekTexture(): Texture {
  return canvasTex("garage-sky-v4", 256, 384, (ctx) => {
    const w = 256;
    const h = 384;
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, "#6BB3E8");
    g.addColorStop(0.55, "#5BA3D9");
    g.addColorStop(1, "#A8D4F0");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#F8F9FA";
    for (const [x, y, r] of [
      [60, 90, 28],
      [90, 85, 34],
      [120, 92, 26],
    ] as const) {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}
