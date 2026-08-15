#!/usr/bin/env node
/**
 * Static architecture guard — one-way layers, type ownership, one WebGL, rAF homes.
 * Keep the banned matrix in sync with `.cursor/skills/architecture/layers.md`.
 *
 *   node scripts/check-architecture.mjs
 *   npm run test:arch
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(REPO, "src");

/** fromLayer → layers it must not import (exceptions handled in bannedTarget). */
export const BANNED = {
  data: ["ui", "render", "audio", "meta", "app", "sim", "input", "dev"],
  track: ["ui", "render", "audio", "meta", "app", "sim", "input", "dev"],
  sim: ["ui", "render", "meta", "app", "input", "dev"],
  meta: ["ui", "render", "audio", "app", "input", "dev"],
  ui: ["render", "audio"],
  render: ["ui", "meta", "audio", "app", "input"],
  audio: ["ui", "render", "meta", "app", "sim", "input", "dev"],
  input: ["ui", "render", "meta", "app", "sim", "audio", "dev"],
  core: ["ui", "render", "audio", "meta", "app", "sim", "input", "dev"],
};

const LAYERS = new Set([
  "data",
  "track",
  "sim",
  "meta",
  "app",
  "ui",
  "render",
  "audio",
  "input",
  "core",
  "dev",
]);

export function layerOfRel(relPosix) {
  const top = relPosix.split("/")[0];
  if (top.endsWith(".ts")) return "main";
  return LAYERS.has(top) ? top : "main";
}

export function bannedTarget(fromLayer, toLayer, spec, typeOnly) {
  if (!toLayer || fromLayer === toLayer || fromLayer === "main" || fromLayer === "app" || fromLayer === "dev") {
    return null;
  }
  if (fromLayer === "sim" && toLayer === "audio") {
    if (typeOnly && spec.includes("raceEvents") && !spec.includes("GameAudio")) return null;
    return "sim may only type-import audio/raceEvents (never GameAudio)";
  }
  const banned = BANNED[fromLayer];
  if (banned?.includes(toLayer)) {
    return `${fromLayer} must not import ${toLayer}`;
  }
  return null;
}

function listTs(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...listTs(full));
    else if (name.endsWith(".ts")) out.push(full);
  }
  return out;
}

function importedLayer(fromFile, spec) {
  if (!spec.startsWith(".")) return null;
  const abs = join(dirname(fromFile), spec).replace(/\\/g, "/");
  const marker = "/src/";
  const i = abs.lastIndexOf(marker);
  if (i < 0) return null;
  const rel = abs.slice(i + marker.length);
  return layerOfRel(rel);
}

/** Each `from "…"` / `import("…")` with a cheap type-only guess from this statement only. */
export function eachImport(text, onHit) {
  const re = /(?:from\s+|import\s*\(\s*)["']([^"']+)["']/g;
  let m;
  while ((m = re.exec(text))) {
    const spec = m[1];
    const before = text.slice(0, m.index);
    const stmtStart = Math.max(0, before.lastIndexOf(";") + 1);
    const prefix = text.slice(stmtStart, m.index);
    const typeOnly = /\bimport\s+type\b/.test(prefix) || /\bexport\s+type\s*\{/.test(prefix);
    onHit(spec, typeOnly);
  }
}

function countMatches(text, re) {
  return [...text.matchAll(re)].length;
}

export function collectViolations(srcRoot = SRC) {
  const violations = [];
  const garageLookDefs = [];
  const stickerDefs = [];
  const webgl = [];
  const raf = [];
  const gameApp = [];

  for (const file of listTs(srcRoot)) {
    const rel = relative(srcRoot, file).replace(/\\/g, "/");
    const fromLayer = layerOfRel(rel);
    const text = readFileSync(file, "utf8");

    eachImport(text, (spec, typeOnly) => {
      const toLayer = importedLayer(file, spec);
      const reason = bannedTarget(fromLayer, toLayer, spec, typeOnly);
      if (reason) violations.push(`${rel} → ${spec} (${reason})`);
    });

    if (fromLayer === "render" && /\bcar\.(x|z|vx|vz|heading|hp|nitro)\s*=/.test(text)) {
      violations.push(`${rel} writes CarState kinematics (render must only read)`);
    }

    if (/export\s+type\s+GarageLook\s*=/.test(text)) garageLookDefs.push(rel);
    if (/export\s+type\s+StickerId\s*=/.test(text)) stickerDefs.push(rel);
    if (/new\s+WebGLRenderer\s*\(/.test(text)) webgl.push(rel);
    const rafHits = countMatches(text, /requestAnimationFrame\s*\(/g);
    if (rafHits) raf.push(rel);
    if (/export\s+class\s+GameApp\b/.test(text)) gameApp.push(rel);
  }

  if (garageLookDefs.length !== 1 || garageLookDefs[0] !== "render/garageLook.ts") {
    violations.push(`GarageLook must be defined only in render/garageLook.ts (found: ${garageLookDefs.join(", ") || "none"})`);
  }
  if (stickerDefs.length !== 1 || stickerDefs[0] !== "data/stickers.ts") {
    violations.push(`StickerId must be defined only in data/stickers.ts (found: ${stickerDefs.join(", ") || "none"})`);
  }
  if (webgl.length !== 1 || webgl[0] !== "render/RaceRenderer.ts") {
    violations.push(`exactly one new WebGLRenderer in render/RaceRenderer.ts (found: ${webgl.join(", ") || "none"})`);
  }
  const rafAllowed = new Set(["main.ts", "app/GameApp.ts"]);
  for (const f of raf) {
    if (!rafAllowed.has(f)) violations.push(`${f} calls requestAnimationFrame (only main.ts and app/GameApp.ts)`);
  }
  if (gameApp.length !== 1 || gameApp[0] !== "app/GameApp.ts") {
    violations.push(`class GameApp must live in app/GameApp.ts (found: ${gameApp.join(", ") || "none"})`);
  }
  if (existsSync(join(srcRoot, "ui/GameApp.ts"))) {
    violations.push("ui/GameApp.ts must not exist");
  }

  const parts = readFileSync(join(srcRoot, "data/parts.ts"), "utf8");
  const start = parts.indexOf("export function mergeStats");
  const next = parts.indexOf("\nexport ", start + 1);
  const body = parts.slice(start, next === -1 ? undefined : next);
  if (/paint|sticker|cosmetic/i.test(body)) {
    violations.push("data/parts.ts mergeStats must not mention paint/sticker/cosmetic");
  }

  return violations;
}

function main() {
  const violations = collectViolations();
  if (violations.length === 0) {
    console.log("architecture guard: ok");
    return;
  }
  console.error("architecture guard: failed\n");
  for (const v of violations) console.error(`  - ${v}`);
  process.exitCode = 1;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main();
}
