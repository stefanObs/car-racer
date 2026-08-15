import type { CarState } from "../sim/vehicle";
import type { RaceSession } from "../sim/race";
import { sampleCenterline } from "../track/buildTrack";
import { ComicPaletteCss } from "../render/palette";
import { themeLook } from "../render/themeLook";

export const MINI_MAP_SIZE = 176;
export const FIELD_STRIP_WIDTH = 320;
export const FIELD_STRIP_HEIGHT = 36;

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

function miniMapFill(theme: string): string {
  const t = theme.toLowerCase();
  if (t === "harbor") return "#2f6f9e";
  if (t === "beach") return "#6ec6f0";
  const look = themeLook(theme);
  return `#${look.ground.toString(16).padStart(6, "0")}`;
}

function liveCars(session: RaceSession): CarState[] {
  return session.cars.filter((c) => !(c.koTimer > 0 && c.hp <= 0));
}

/** 0 = race start, 1 = finished (all laps). */
export function fieldProgress01(car: CarState, session: RaceSession): number {
  const span = Math.max(1, session.level.laps * session.track.totalLength);
  if (car.finished) return 1;
  return Math.max(0, Math.min(1, car.progress / span));
}

function inkOnPaint(paint: string): string {
  const hex = paint.replace("#", "");
  if (hex.length < 6) return "#fff";
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return lum > 140 ? ComicPaletteCss.outline : "#fff";
}

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
}

function rivalMarker(cx: number, cy: number, car: CarState, r: number): string {
  const ink = inkOnPaint(car.paint);
  return `<g data-car="${escapeXml(car.id)}" data-place="${car.place}">
    <circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${r}" fill="${car.paint}" stroke="${ComicPaletteCss.outline}" stroke-width="2"/>
    <text x="${cx.toFixed(1)}" y="${(cy + 0.6).toFixed(1)}" text-anchor="middle" dominant-baseline="middle" font-size="${Math.max(8, r + 1)}" font-weight="800" fill="${ink}">${car.place}</text>
  </g>`;
}

function playerMarker(x: number, y: number, heading: number, paint: string): string {
  const ang = heading + Math.PI / 2;
  const len = 10;
  const tipX = x + Math.cos(ang) * len;
  const tipY = y + Math.sin(ang) * len;
  const lx = x + Math.cos(ang + 2.45) * 7;
  const ly = y + Math.sin(ang + 2.45) * 7;
  const rx = x + Math.cos(ang - 2.45) * 7;
  const ry = y + Math.sin(ang - 2.45) * 7;
  const labelY = y + 14;
  return `<g data-car="player" data-player="1">
    <polygon points="${tipX.toFixed(1)},${tipY.toFixed(1)} ${lx.toFixed(1)},${ly.toFixed(1)} ${rx.toFixed(1)},${ry.toFixed(1)}" fill="${paint}" stroke="${ComicPaletteCss.repairSpark}" stroke-width="2.5"/>
    <text x="${x.toFixed(1)}" y="${labelY.toFixed(1)}" text-anchor="middle" font-size="9" font-weight="800" fill="${ComicPaletteCss.repairSpark}" stroke="${ComicPaletteCss.outline}" stroke-width="0.7" paint-order="stroke">DU</text>
  </g>`;
}

/** SVG mini-map — track outline + every live car (CONCEPT §9). */
export function renderMiniMapSvg(session: RaceSession, size = MINI_MAP_SIZE): string {
  const b = trackBounds(session);
  const w = Math.max(1, b.maxX - b.minX);
  const h = Math.max(1, b.maxZ - b.minZ);
  const scale = (size - 10) / Math.max(w, h);
  const ox = (size - w * scale) / 2;
  const oz = (size - h * scale) / 2;
  const to = (x: number, z: number) => ({
    x: ox + (x - b.minX) * scale,
    y: oz + (z - b.minZ) * scale,
  });

  const pts = session.track.centerline.map((p) => to(p.x, p.z));
  const path = `${pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ")} Z`;
  const strokeW = Math.max(5, session.track.asphaltHalfWidth * scale * 1.7);
  const fill = miniMapFill(session.level.theme);

  const start = sampleCenterline(session.track, 0);
  const startP = to(start.position.x, start.position.z);
  const startTick = `<rect x="${(startP.x - 3).toFixed(1)}" y="${(startP.y - 3).toFixed(1)}" width="6" height="6" fill="${ComicPaletteCss.asphaltLine}" stroke="${ComicPaletteCss.outline}" stroke-width="1.5" data-start="1"/>`;

  const cars = liveCars(session);
  const rivals = cars
    .filter((c) => !c.isPlayer)
    .sort((a, b) => b.place - a.place)
    .map((c) => {
      const p = to(c.x, c.z);
      return rivalMarker(p.x, p.y, c, 7);
    })
    .join("");
  const player = cars.find((c) => c.isPlayer);
  const you = player ? playerMarker(to(player.x, player.z).x, to(player.x, player.z).y, player.heading, player.paint) : "";

  return `<svg class="mini-map-svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" aria-label="Mini-Map: du und die anderen" data-dev-name="hud.minimap">
  <rect width="${size}" height="${size}" fill="${fill}" stroke="${ComicPaletteCss.outline}" stroke-width="3"/>
  <path d="${path}" fill="none" stroke="${ComicPaletteCss.asphalt}" stroke-width="${strokeW.toFixed(1)}" stroke-linejoin="round" stroke-linecap="round"/>
  <path d="${path}" fill="none" stroke="${ComicPaletteCss.asphaltLine}" stroke-width="1.6" stroke-dasharray="4 6" opacity="0.85"/>
  ${startTick}
  ${rivals}
  ${you}
</svg>`;
}

/** Horizontal field strip — race progress left (start) to right (Ziel). */
export function renderFieldStripSvg(
  session: RaceSession,
  width = FIELD_STRIP_WIDTH,
  height = FIELD_STRIP_HEIGHT,
): string {
  const padX = 18;
  const midY = height / 2;
  const inner = width - padX * 2;
  const cars = liveCars(session).slice().sort((a, b) => b.place - a.place);
  const pips = cars
    .map((c) => {
      const t = fieldProgress01(c, session);
      const x = padX + t * inner;
      const yOff = c.isPlayer ? 0 : ((c.place % 3) - 1) * 5;
      const y = midY + yOff;
      if (c.isPlayer) {
        return `<g data-car="player" data-player="1" data-progress="${t.toFixed(3)}">
          <polygon points="${x.toFixed(1)},${(y - 9).toFixed(1)} ${(x + 7).toFixed(1)},${(y + 6).toFixed(1)} ${(x - 7).toFixed(1)},${(y + 6).toFixed(1)}" fill="${c.paint}" stroke="${ComicPaletteCss.repairSpark}" stroke-width="2"/>
          <text x="${x.toFixed(1)}" y="${(height - 3).toFixed(1)}" text-anchor="middle" font-size="8" font-weight="800" fill="${ComicPaletteCss.repairSpark}">DU</text>
        </g>`;
      }
      return `<g data-car="${escapeXml(c.id)}" data-place="${c.place}" data-progress="${t.toFixed(3)}">
        ${rivalMarker(x, y, c, 6)}
      </g>`;
    })
    .join("");

  return `<svg class="field-strip-svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" aria-label="Streckenleiste: wer wo im Rennen liegt" data-dev-name="hud.field-strip">
  <rect x="1.5" y="1.5" width="${width - 3}" height="${height - 3}" rx="4" fill="rgba(27,27,31,0.82)" stroke="${ComicPaletteCss.outline}" stroke-width="3"/>
  <line x1="${padX}" y1="${midY}" x2="${width - padX}" y2="${midY}" stroke="${ComicPaletteCss.asphalt}" stroke-width="8" stroke-linecap="round"/>
  <line x1="${padX}" y1="${midY}" x2="${width - padX}" y2="${midY}" stroke="${ComicPaletteCss.asphaltLine}" stroke-width="2" stroke-dasharray="5 6"/>
  <text x="6" y="${midY + 3}" font-size="8" font-weight="800" fill="${ComicPaletteCss.asphaltLine}">S</text>
  <text x="${width - 12}" y="${midY + 3}" font-size="8" font-weight="800" fill="${ComicPaletteCss.repairSpark}">Z</text>
  ${pips}
</svg>`;
}
