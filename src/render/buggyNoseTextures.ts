/**
 * Asphalt-Comic bone/keratin atlases for Käferkraft skull + horns.
 * Mesh-fitted (box / cylinder UVs) — not flat face/horn illustration sheets.
 */
import {
  CanvasTexture,
  DataTexture,
  NearestFilter,
  RGBAFormat,
  SRGBColorSpace,
  Texture,
  RepeatWrapping,
} from "three";

export type BuggyNoseTexId = "skull" | "skullHorn";

const maps = new Map<BuggyNoseTexId, Texture>();
let preloadPromise: Promise<void> | null = null;

function fallbackTex(r: number, g: number, b: number): DataTexture {
  const data = new Uint8Array([r, g, b, 255]);
  const tex = new DataTexture(data, 1, 1, RGBAFormat);
  tex.needsUpdate = true;
  tex.minFilter = NearestFilter;
  tex.magFilter = NearestFilter;
  tex.colorSpace = SRGBColorSpace;
  tex.userData.comicTintable = false;
  return tex;
}

function canvasAtlas(
  w: number,
  h: number,
  draw: (ctx: CanvasRenderingContext2D) => void,
  opts?: { repeatV?: boolean },
): Texture {
  if (typeof document === "undefined") {
    return fallbackTex(232, 220, 200);
  }
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  if (!ctx) return fallbackTex(232, 220, 200);
  draw(ctx);
  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  tex.minFilter = NearestFilter;
  tex.magFilter = NearestFilter;
  tex.generateMipmaps = false;
  tex.wrapS = RepeatWrapping;
  tex.wrapT = opts?.repeatV ? RepeatWrapping : RepeatWrapping;
  tex.needsUpdate = true;
  tex.userData.comicTintable = false;
  return tex;
}

/** Cream bone plate for box-UV skull meshes (cracks + stipple, no face drawing). */
function drawSkullBone(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  ctx.fillStyle = "#E8DCC8";
  ctx.fillRect(0, 0, w, h);
  // Soft value bands so box faces read volume
  for (let y = 0; y < h; y++) {
    const t = y / h;
    const shade = 0.92 + Math.sin(t * Math.PI) * 0.08;
    const r = Math.round(232 * shade);
    const g = Math.round(220 * shade);
    const b = Math.round(200 * shade);
    ctx.fillStyle = `rgb(${r},${g},${b})`;
    ctx.fillRect(0, y, w, 1);
  }
  ctx.strokeStyle = "#1B1B1F";
  ctx.lineWidth = 3;
  ctx.globalAlpha = 0.55;
  // Suture / crack lines (follow UV, not a skull silhouette)
  for (const [x0, y0, x1, y1] of [
    [w * 0.5, 8, w * 0.5, h - 8],
    [40, 60, w - 40, 90],
    [50, h * 0.55, w - 50, h * 0.62],
    [70, h * 0.78, w - 70, h * 0.72],
  ] as const) {
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
  }
  ctx.globalAlpha = 0.35;
  for (let i = 0; i < 80; i++) {
    const x = (i * 47) % w;
    const y = (i * 91) % h;
    ctx.fillStyle = "#1B1B1F";
    ctx.fillRect(x, y, 2, 2);
  }
  ctx.globalAlpha = 1;
  ctx.lineWidth = 10;
  ctx.strokeStyle = "#1B1B1F";
  ctx.strokeRect(6, 6, w - 12, h - 12);
}

/**
 * Keratin strip for cylinder UVs: U = around horn, V = along length.
 * Growth rings are constant-V bands so they wrap the mesh correctly.
 */
function drawHornKeratin(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  // Base cream → tip tan along V
  for (let y = 0; y < h; y++) {
    const t = y / h;
    const r = Math.round(241 - t * 80);
    const g = Math.round(230 - t * 90);
    const b = Math.round(208 - t * 100);
    ctx.fillStyle = `rgb(${r},${g},${b})`;
    ctx.fillRect(0, y, w, 1);
  }
  // Limb darkening around U (cylinder edges)
  const edge = ctx.createLinearGradient(0, 0, w, 0);
  edge.addColorStop(0, "rgba(27,27,31,0.28)");
  edge.addColorStop(0.2, "rgba(27,27,31,0)");
  edge.addColorStop(0.8, "rgba(27,27,31,0)");
  edge.addColorStop(1, "rgba(27,27,31,0.28)");
  ctx.fillStyle = edge;
  ctx.fillRect(0, 0, w, h);
  // Highlight stripe
  ctx.fillStyle = "rgba(255,255,255,0.22)";
  ctx.fillRect(w * 0.42, 0, w * 0.1, h);
  // Growth rings (Asphalt-Comic ink)
  ctx.strokeStyle = "#1B1B1F";
  ctx.lineWidth = 4;
  ctx.globalAlpha = 0.7;
  for (let i = 1; i <= 7; i++) {
    const y = (i / 8) * h;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y + (i % 2 === 0 ? 3 : -2));
    ctx.stroke();
  }
  ctx.globalAlpha = 0.4;
  ctx.lineWidth = 2;
  for (let i = 0; i < 40; i++) {
    const x = (i * 37) % w;
    const y = (i * 53) % h;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 6, y + 10);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function buildAtlas(id: BuggyNoseTexId): Texture {
  if (id === "skullHorn") {
    return canvasAtlas(256, 512, (ctx) => drawHornKeratin(ctx, 256, 512), { repeatV: true });
  }
  return canvasAtlas(512, 512, (ctx) => drawSkullBone(ctx, 512, 512));
}

/** Warm canvas atlases once (call with car preload). */
export function preloadBuggyNoseTextures(): Promise<void> {
  if (preloadPromise) return preloadPromise;
  preloadPromise = Promise.resolve().then(() => {
    maps.set("skull", buildAtlas("skull"));
    maps.set("skullHorn", buildAtlas("skullHorn"));
  });
  return preloadPromise;
}

export function buggyNoseTexture(id: BuggyNoseTexId): Texture | null {
  let tex = maps.get(id);
  if (!tex) {
    tex = buildAtlas(id);
    maps.set(id, tex);
  }
  return tex;
}

export function hasBuggyNoseTexture(id: BuggyNoseTexId): boolean {
  return maps.has(id);
}
