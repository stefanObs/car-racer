import type { RaceSession } from "../sim/race";
import { ComicPaletteCss } from "../render/palette";

/** Bounds of track centerline in world XZ. */
export function trackBounds(session: RaceSession): {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
} {
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const p of session.track.centerline) {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minZ = Math.min(minZ, p.z);
    maxZ = Math.max(maxZ, p.z);
  }
  const pad = 6;
  return { minX: minX - pad, maxX: maxX + pad, minZ: minZ - pad, maxZ: maxZ + pad };
}

/** SVG mini-map for race HUD (CONCEPT §9) — asphalt/grass comic colors, player triangle. */
export function renderMiniMapSvg(session: RaceSession, size = 128): string {
  const b = trackBounds(session);
  const w = Math.max(1, b.maxX - b.minX);
  const h = Math.max(1, b.maxZ - b.minZ);
  const scale = (size - 8) / Math.max(w, h);
  const ox = (size - w * scale) / 2;
  const oz = (size - h * scale) / 2;
  const to = (x: number, z: number) => ({
    x: ox + (x - b.minX) * scale,
    y: oz + (z - b.minZ) * scale,
  });

  const pts = session.track.centerline.map((p) => to(p.x, p.z));
  const path = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
  const strokeW = Math.max(4, session.track.asphaltHalfWidth * scale * 1.6);

  const cars = session.cars
    .filter((c) => !(c.koTimer > 0 && c.hp <= 0))
    .map((c) => {
      const p = to(c.x, c.z);
      if (c.isPlayer) {
        const ang = c.heading + Math.PI / 2;
        const len = 7;
        const tipX = p.x + Math.cos(ang) * len;
        const tipY = p.y + Math.sin(ang) * len;
        const lx = p.x + Math.cos(ang + 2.4) * 5;
        const ly = p.y + Math.sin(ang + 2.4) * 5;
        const rx = p.x + Math.cos(ang - 2.4) * 5;
        const ry = p.y + Math.sin(ang - 2.4) * 5;
        return `<polygon points="${tipX.toFixed(1)},${tipY.toFixed(1)} ${lx.toFixed(1)},${ly.toFixed(1)} ${rx.toFixed(1)},${ry.toFixed(1)}" fill="${c.paint}" stroke="${ComicPaletteCss.outline}" stroke-width="2"/>`;
      }
      return `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="3.5" fill="${c.paint}" stroke="${ComicPaletteCss.outline}" stroke-width="1.5"/>`;
    })
    .join("");

  return `<svg class="mini-map-svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" aria-label="Mini-Map" data-dev-name="hud.minimap">
  <rect width="${size}" height="${size}" fill="${ComicPaletteCss.grass}" stroke="${ComicPaletteCss.outline}" stroke-width="3"/>
  <path d="${path}" fill="none" stroke="${ComicPaletteCss.asphalt}" stroke-width="${strokeW.toFixed(1)}" stroke-linejoin="round" stroke-linecap="round"/>
  <path d="${path}" fill="none" stroke="${ComicPaletteCss.asphaltLine}" stroke-width="1.5" stroke-dasharray="4 6" opacity="0.85"/>
  ${cars}
</svg>`;
}
