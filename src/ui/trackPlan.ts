/**
 * Asphalt-Comic top-down track plans for cup / free / ad-hoc select screens.
 */
import type { LevelDefinition } from "../track/types";
import { buildTrackFromLevel } from "../track/buildTrack";
import { ComicPaletteCss } from "../render/palette";
import { themeLook } from "../render/themeLook";

function hexCss(n: number): string {
  return `#${n.toString(16).padStart(6, "0")}`;
}

export type TrackPlanThemeTint = {
  bg: string;
  trim: string;
  accent: string;
};

/** Theme-matched plan colors (backgrounds only — asphalt/grass stay concept palette). */
export function trackPlanTint(theme: string): TrackPlanThemeTint {
  const look = themeLook(theme);
  switch (theme) {
    case "harbor":
      return { bg: hexCss(look.skyLow), trim: "#2f6f9a", accent: "#ff922b" };
    case "beach":
      return { bg: "#6ec6f0", trim: "#c2a66a", accent: "#ffe066" };
    case "city":
      return { bg: "#5a7088", trim: "#3a4550", accent: "#ff6b6b" };
    case "factory":
      return { bg: "#6a7a88", trim: "#4a4038", accent: "#fcc419" };
    case "canyon":
      return { bg: "#4a8cbc", trim: "#a0785a", accent: "#ff8787" };
    default:
      return { bg: hexCss(look.sky), trim: hexCss(look.ground), accent: ComicPaletteCss.repairSpark };
  }
}

/** Static SVG track plan (no live cars) — unique silhouette + theme look. */
export function renderTrackPlanSvg(level: LevelDefinition, size = 160): string {
  const track = buildTrackFromLevel(level);
  const tint = trackPlanTint(level.theme);

  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const p of track.centerline) {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minZ = Math.min(minZ, p.z);
    maxZ = Math.max(maxZ, p.z);
  }
  const pad = 8;
  minX -= pad;
  maxX += pad;
  minZ -= pad;
  maxZ += pad;
  const w = Math.max(1, maxX - minX);
  const h = Math.max(1, maxZ - minZ);
  const scale = (size - 16) / Math.max(w, h);
  const ox = (size - w * scale) / 2;
  const oz = (size - h * scale) / 2;
  const to = (x: number, z: number) => ({
    x: ox + (x - minX) * scale,
    y: oz + (z - minZ) * scale,
  });

  const pts = track.centerline.map((p) => to(p.x, p.z));
  const path = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
  const grassW = Math.max(6, (track.asphaltHalfWidth + track.grassWidth) * scale * 2);
  const asphaltW = Math.max(4, track.asphaltHalfWidth * scale * 2);

  const start = to(track.centerline[0]!.x, track.centerline[0]!.z);
  const hazards = level.obstacles
    .filter((o) => o.type === "ramp" || o.type === "uneven" || o.type === "oil")
    .map((o) => {
      const p = to(o.position[0], o.position[1]);
      if (o.type === "ramp") {
        return `<polygon points="${(p.x - 5).toFixed(1)},${(p.y + 4).toFixed(1)} ${(p.x + 5).toFixed(1)},${(p.y + 4).toFixed(1)} ${p.x.toFixed(1)},${(p.y - 5).toFixed(1)}" fill="${tint.accent}" stroke="${ComicPaletteCss.outline}" stroke-width="1.5"/>`;
      }
      if (o.type === "oil") {
        return `<ellipse cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" rx="4" ry="3" fill="#1b1b1f" opacity="0.75" stroke="${ComicPaletteCss.outline}" stroke-width="1"/>`;
      }
      return `<rect x="${(p.x - 4).toFixed(1)}" y="${(p.y - 2).toFixed(1)}" width="8" height="4" fill="${ComicPaletteCss.asphaltLine}" stroke="${ComicPaletteCss.outline}" stroke-width="1"/>`;
    })
    .join("");

  const name = level.displayName.replace(/</g, "&lt;");

  return `<svg class="track-plan-svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" role="img" aria-label="Streckenplan ${name}">
  <rect width="${size}" height="${size}" rx="10" fill="${tint.bg}" stroke="${ComicPaletteCss.outline}" stroke-width="3"/>
  <rect x="6" y="6" width="${size - 12}" height="${size - 12}" rx="6" fill="none" stroke="${tint.trim}" stroke-width="2" opacity="0.55"/>
  <path d="${path}" fill="none" stroke="${ComicPaletteCss.grass}" stroke-width="${grassW.toFixed(1)}" stroke-linejoin="round" stroke-linecap="round"/>
  <path d="${path}" fill="none" stroke="${ComicPaletteCss.asphalt}" stroke-width="${asphaltW.toFixed(1)}" stroke-linejoin="round" stroke-linecap="round"/>
  <path d="${path}" fill="none" stroke="${ComicPaletteCss.asphaltLine}" stroke-width="1.4" stroke-dasharray="5 7" opacity="0.9"/>
  ${hazards}
  <rect x="${(start.x - 3).toFixed(1)}" y="${(start.y - 6).toFixed(1)}" width="6" height="12" fill="#f8f9fa" stroke="${ComicPaletteCss.outline}" stroke-width="1.5"/>
  <text x="${size / 2}" y="${size - 10}" text-anchor="middle" font-family="Impact, Haettenschweiler, sans-serif" font-size="11" fill="${ComicPaletteCss.outline}" letter-spacing="0.5">${name}</text>
</svg>`;
}
