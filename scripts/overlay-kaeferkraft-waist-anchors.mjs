#!/usr/bin/env node
/**
 * Composite labeled Waist-anchor picker from unlabeled 3/4 panels.
 *   node scripts/overlay-kaeferkraft-waist-anchors.mjs
 */
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const srcDir = join(root, "assets/tripo-concepts");
const outPath = join(root, "assets/tripo-concepts/kaeferkraft-waist-anchors.png");

const PW = 960;
const PH = 640;
const HEADER = 48;
const FOOTER = 118;
const GAP = 8;

/** Pixel positions on 960×640 after resize from 1536×1024 (scale 0.625). */
const leftDots = [
  { id: "LF1", x: 368, y: 282, now: false, group: "front" },
  { id: "LF2", x: 418, y: 298, now: true, group: "front" },
  { id: "LF3", x: 428, y: 385, now: false, group: "front" },
  { id: "LF4", x: 408, y: 218, now: false, group: "front" },
  { id: "LR1", x: 585, y: 348, now: false, group: "rear" },
  { id: "LR2", x: 642, y: 288, now: true, group: "rear" },
  { id: "LR3", x: 658, y: 168, now: false, group: "rear" },
  { id: "LR4", x: 748, y: 312, now: false, group: "rear" },
];

function mirrorX(dots) {
  return dots.map((d) => ({
    ...d,
    id: d.id.replace(/^L/, "R"),
    x: PW - d.x,
  }));
}

function xml(s) {
  return String(s).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function panelSvg(title, dots) {
  const marks = dots.map((d) => {
    const fill = d.now ? "#e03131" : "#f08c00";
    const r = d.now ? 11 : 8;
    const ring = d.now
      ? `<circle cx="${d.x}" cy="${d.y}" r="16" fill="none" stroke="#1b1b1f" stroke-width="4"/>
         <circle cx="${d.x}" cy="${d.y}" r="16" fill="none" stroke="#ffe066" stroke-width="2"/>`
      : "";
    const lx = d.x + (d.group === "front" ? -52 : 18);
    const ly = d.y + (d.id.endsWith("4") && d.group === "front" ? -18 : d.id.endsWith("3") && d.group === "rear" ? -18 : -14);
    const anchor = d.group === "front" ? "end" : "start";
    return `${ring}
      <circle cx="${d.x}" cy="${d.y}" r="${r}" fill="${fill}" stroke="#1b1b1f" stroke-width="3"/>
      <text x="${lx}" y="${ly}" text-anchor="${anchor}" font-family="ui-sans-serif,sans-serif" font-size="22" font-weight="800" fill="#1b1b1f" stroke="#f4efe6" stroke-width="6" paint-order="stroke">${xml(d.id)}</text>
      <text x="${lx}" y="${ly}" text-anchor="${anchor}" font-family="ui-sans-serif,sans-serif" font-size="22" font-weight="800" fill="#1b1b1f">${xml(d.id)}</text>`;
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${PW}" height="${PH}">
    <rect x="8" y="8" width="220" height="36" rx="6" fill="#1b1b1f"/>
    <text x="118" y="33" text-anchor="middle" font-family="ui-sans-serif,sans-serif" font-size="18" font-weight="800" fill="#f4efe6">${xml(title)}</text>
    ${marks.join("\n")}
  </svg>`;
}

async function labeledPanel(srcPath, title, dots) {
  const base = await sharp(srcPath).resize(PW, PH, { fit: "cover" }).png().toBuffer();
  return sharp(base)
    .composite([{ input: Buffer.from(panelSvg(title, dots)), blend: "over" }])
    .png()
    .toBuffer();
}

const W = PW * 2 + GAP;
const H = HEADER + PH + FOOTER;

const headerSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${HEADER}">
  <rect width="${W}" height="${HEADER}" fill="#f4efe6"/>
  <text x="${W / 2}" y="32" text-anchor="middle" font-family="ui-sans-serif,sans-serif" font-size="22" font-weight="800" fill="#1b1b1f">Käferkraft Waist anchors — pick IDs (mesh m, nose −X)</text>
</svg>`;

const footerSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${FOOTER}">
  <rect width="${W}" height="${FOOTER}" fill="#f4efe6"/>
  <text x="24" y="28" font-family="ui-sans-serif,sans-serif" font-size="16" font-weight="700" fill="#1b1b1f">Front: F1 cowl  F2 NOW  F3 sill/hip  F4 belt/A-pillar</text>
  <text x="24" y="54" font-family="ui-sans-serif,sans-serif" font-size="16" font-weight="700" fill="#1b1b1f">Rear: R1 seat-back foot  R2 NOW (joint)  R3 hoop mid  R4 rear deck</text>
  <text x="24" y="82" font-family="ui-sans-serif,sans-serif" font-size="15" fill="#5c564c">L = left −Z · R = right +Z · red ring = current Waist ends · say e.g. LF3 + LR2</text>
  <circle cx="${W - 220}" cy="36" r="11" fill="#e03131" stroke="#1b1b1f" stroke-width="3"/>
  <text x="${W - 200}" y="42" font-family="ui-sans-serif,sans-serif" font-size="15" font-weight="700" fill="#1b1b1f">NOW</text>
  <circle cx="${W - 140}" cy="36" r="8" fill="#f08c00" stroke="#1b1b1f" stroke-width="3"/>
  <text x="${W - 120}" y="42" font-family="ui-sans-serif,sans-serif" font-size="15" font-weight="700" fill="#1b1b1f">candidate</text>
</svg>`;

const left = await labeledPanel(join(srcDir, "kaeferkraft-waist-panel-L.png"), "LEFT  (−Z)", leftDots);
const right = await labeledPanel(join(srcDir, "kaeferkraft-waist-panel-R.png"), "RIGHT  (+Z)", mirrorX(leftDots));

const sheet = await sharp({
  create: { width: W, height: H, channels: 3, background: { r: 244, g: 239, b: 230 } },
})
  .composite([
    { input: Buffer.from(headerSvg), top: 0, left: 0 },
    { input: left, top: HEADER, left: 0 },
    { input: right, top: HEADER, left: PW + GAP },
    { input: Buffer.from(footerSvg), top: HEADER + PH, left: 0 },
  ])
  .png()
  .toBuffer();

writeFileSync(outPath, sheet);
console.log("wrote", outPath, sheet.length, "bytes");
