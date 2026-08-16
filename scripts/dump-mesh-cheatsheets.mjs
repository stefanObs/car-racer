#!/usr/bin/env node
/**
 * Generate mesh/node cheat sheets with coordinate grids.
 *
 *   node scripts/dump-mesh-cheatsheets.mjs
 *   node scripts/dump-mesh-cheatsheets.mjs --out=/tmp/sheets
 *   npm run docs:cheatsheets
 *
 * New car / track / garage prop / mount: update the catalogs in this file, then dump.
 */
import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  aabbCenter,
  fmt,
  fmtVec,
  gridSvg,
  inspectGlb,
  nodesToGridItems,
} from "./lib/inspect-glb.mjs";
import { previewMd, stemForPublicRel } from "./lib/cheatsheet-preview-jobs.mjs";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_OUT = join(rootDir, ".cursor/cheatsheets");

const CARS = [
  {
    id: "blitz",
    name: "Blitz",
    classLabel: "Sportwagen",
    yaw: 0,
    yawNote: "bake nose +Z (runtime yaw 0)",
    collisionRadius: 1.05,
    defaultPaint: "#e03131",
    shopSkip: ["better_brakes"],
    shopStatsOnly: ["lightweight_body"],
    scaledWheels: true,
    wideWheels: true,
    stickers: true,
    noses: false,
    sideU: 2,
    sideV: 1,
    sideULabel: "+Z length (nose +Z)",
    sideVLabel: "+Y up",
  },
  {
    id: "bison",
    name: "Bison",
    classLabel: "Pick-up",
    yaw: 0,
    yawNote: "bake nose +Z (runtime yaw 0)",
    collisionRadius: 1.25,
    defaultPaint: "#2f9e44",
    shopSkip: ["better_brakes"],
    shopStatsOnly: ["lightweight_body"],
    scaledWheels: true,
    stickers: true,
    noses: false,
    sideU: 2,
    sideV: 1,
    sideULabel: "+Z length (nose +Z)",
    sideVLabel: "+Y up",
  },
  {
    id: "kaeferkraft",
    name: "Käferkraft",
    classLabel: "Buggy",
    yaw: Math.PI / 2,
    yawNote: "bake nose −X; runtime yaw π/2 maps nose to +Z",
    collisionRadius: 1.1,
    defaultPaint: "#12b886",
    shopSkip: ["better_brakes"],
    shopStatsOnly: ["offroad_suspension"],
    scaledWheels: true,
    stickers: false,
    noses: true,
    sideU: 0,
    sideV: 1,
    sideULabel: "+X (bake length; nose −X)",
    sideVLabel: "+Y up",
  },
  {
    id: "donnerbuechse",
    name: "Donnerbüchse",
    classLabel: "Hot Rod",
    yaw: 0,
    yawNote: "bake nose +Z (runtime yaw 0)",
    collisionRadius: 1.15,
    defaultPaint: "#339af0",
    shopSkip: [],
    shopStatsOnly: [],
    scaledWheels: true,
    stickers: true,
    noses: false,
    sideU: 2,
    sideV: 1,
    sideULabel: "+Z length (nose +Z)",
    sideVLabel: "+Y up",
  },
  {
    id: "bunker",
    name: "Bunker",
    classLabel: "Panzerwagen",
    yaw: 0,
    yawNote: "bake nose +Z (runtime yaw 0)",
    collisionRadius: 1.25,
    defaultPaint: "#868e96",
    shopSkip: ["better_brakes", "offroad_suspension"],
    shopStatsOnly: [],
    scaledWheels: false,
    stickers: true,
    noses: false,
    sideU: 2,
    sideV: 1,
    sideULabel: "+Z length (nose +Z)",
    sideVLabel: "+Y up",
  },
];

const PART_IDS = [
  "big_engine",
  "big_wheels",
  "spike_bumper",
  "better_brakes",
  "reinforced_frame",
  "lightweight_body",
  "nitro_kit",
  "offroad_suspension",
  "rear_spoiler",
];

const PART_NAMES = {
  big_engine: "Großer Motor",
  big_wheels: "Große Räder",
  spike_bumper: "Spike-Stoßstange",
  better_brakes: "Bessere Bremsen",
  reinforced_frame: "Verstärkter Rahmen",
  lightweight_body: "Leichtbau-Karosserie",
  nitro_kit: "Nitro-Kit",
  offroad_suspension: "Gelände-Federung",
  rear_spoiler: "Heckspoiler",
};

/** Mounts copied from `CAR_PART_LAYOUTS` / `BLITZ_PART_PLACEMENT` (mesh space). */
const MOUNTS = {
  blitz: {
    big_engine: [{ x: 0.004, y: 0.467, z: 1.199, yaw: 0, scale: 0.92 }],
    nitro_kit: [{ x: 0, y: 0.22, z: -1.72, yaw: 0, scale: 0.82 }],
    spike_bumper: [{ x: 0, y: 0.1, z: 1.88, yaw: 0, scale: 0.98 }],
    offroad_suspension: [
      { x: 0.7, y: 0.06, z: 1.05, yaw: 0, scale: 0.7 },
      { x: -0.7, y: 0.06, z: 1.05, yaw: Math.PI, scale: 0.7 },
      { x: 0.7, y: 0.06, z: -1.08, yaw: 0, scale: 0.7 },
      { x: -0.7, y: 0.06, z: -1.08, yaw: Math.PI, scale: 0.7 },
    ],
    reinforced_frame: [{ x: 0, y: 0.12, z: 0, yaw: 0, scale: 1.1 }],
    rear_spoiler: [{ x: 0, y: 0.71, z: -1.62, yaw: 0, scale: 1, note: "StockSpoiler on car GLB is the live wing" }],
    lightweight_body: [],
  },
  bison: {
    big_engine: [{ x: 0, y: 0.9, z: 1.17, yaw: Math.PI, scale: 0.9 }],
    spike_bumper: [{ x: 0, y: 0.28, z: 1.72, yaw: 0, scale: 0.82 }],
    reinforced_frame: [{ x: 0, y: 0.64, z: -0.82, yaw: 0, scale: 0.88 }],
    lightweight_body: [{ x: 0, y: 1.03, z: 1.0, yaw: 0, scale: 1.05, note: "preferGlb false — stats only" }],
    nitro_kit: [{ x: 0, y: 0.62, z: -0.85, yaw: 0, scale: 1 }],
    rear_spoiler: [{ x: 0, y: 0.92, z: -1.68, yaw: Math.PI, scale: 1.05 }],
    offroad_suspension: [
      { x: -0.449, y: 0.32, z: 1.13, yaw: 0, scale: 0.8, note: "Blitz shock GLB" },
      { x: 0.449, y: 0.32, z: 1.13, yaw: Math.PI, scale: 0.8 },
      { x: -0.449, y: 0.32, z: -1.052, yaw: 0, scale: 0.8 },
      { x: 0.449, y: 0.32, z: -1.052, yaw: Math.PI, scale: 0.8 },
    ],
  },
  kaeferkraft: {
    big_engine: [{ x: -0.88, y: 0.5, z: 0, yaw: -Math.PI / 2, scale: 0.72, note: "reuses blitz-big_engine.glb" }],
    spike_bumper: [{ x: -1.55, y: 0.45, z: 0, yaw: -Math.PI / 2, scale: 0.85 }],
    reinforced_frame: [{ x: 0, y: 0, z: 0, yaw: 0, scale: 1, note: "authored in mesh space; poles WaistL / WaistR" }],
    lightweight_body: [{ x: 0.2, y: 0.5, z: 0, yaw: Math.PI / 2, scale: 1.12, note: "panels LightweightL (−Z) / LightweightR (+Z) after yaw" }],
    nitro_kit: [{ x: 0.95, y: 0.78, z: 0, yaw: Math.PI, scale: 1 }],
    rear_spoiler: [{ x: 1.55, y: 1.0, z: 0, yaw: -Math.PI / 2, scale: 1.08 }],
    offroad_suspension: [],
  },
  donnerbuechse: {
    big_engine: [{ x: 0, y: 0.16, z: 1.42, yaw: 0, scale: 3.15 }],
    spike_bumper: [{ x: 0, y: 0.06, z: 1.82, yaw: 0, scale: 0.98 }],
    reinforced_frame: [{ x: 0, y: 0.15, z: -1.3, yaw: -Math.PI / 2, scale: 1.1 }],
    lightweight_body: [{ x: 0, y: 0, z: -0.2, yaw: Math.PI / 2, scale: 1.5 }],
    nitro_kit: [{ x: -1.0, y: 0.88, z: -0.68, yaw: -Math.PI / 2, scale: 0.95 }],
    rear_spoiler: [{ x: -0.006, y: 1.0, z: -1.64, yaw: Math.PI, scale: 1.15 }],
    better_brakes: [
      { x: 0.88, y: 0.38, z: 1.52, yaw: 0, scale: 0.95 },
      { x: -0.88, y: 0.38, z: 1.52, yaw: Math.PI, scale: 0.95 },
      { x: 0.95, y: 0.5, z: -1.22, yaw: 0, scale: 1.1 },
      { x: -0.95, y: 0.5, z: -1.22, yaw: Math.PI, scale: 1.1 },
    ],
  },
  bunker: {
    big_engine: [{ x: 0, y: 1.1, z: 1.15, yaw: 0, scale: 1.05 }],
    spike_bumper: [{ x: 0, y: 0.38, z: 1.92, yaw: 0, scale: 1.25 }],
    reinforced_frame: [{ x: 0, y: 0.28, z: 0.0, yaw: Math.PI / 2, scale: 1.02 }],
    lightweight_body: [
      { x: -1.02, y: 0.55, z: 0.1, yaw: Math.PI / 2, scale: 1.08 },
      { x: 1.02, y: 0.55, z: 0.1, yaw: -Math.PI / 2, scale: 1.08 },
    ],
    nitro_kit: [{ x: -0.98, y: 1.05, z: -1.15, yaw: -Math.PI / 2, scale: 1.15 }],
    rear_spoiler: [{ x: 0, y: 1.72, z: -1.5, yaw: 0, scale: 1.12 }],
  },
};

const GARAGE_SHELL = [
  { id: "floor", file: "floor.glb", runtime: "garageFloor / garageTurntableMesh sibling plane" },
  { id: "wall", file: "wall.glb", runtime: "optional Tripo wall overlay" },
  { id: "turntable", file: "turntable.glb", runtime: "garageTurntableMesh under garagePad" },
];

const GARAGE_PROPS = [
  { id: "cabinet", file: "cabinet.glb" },
  { id: "workbench", file: "workbench.glb" },
  { id: "tireStack", file: "tire-stack.glb" },
  { id: "shelf", file: "shelf.glb" },
  { id: "drums", file: "drums.glb" },
  { id: "toolchest", file: "toolchest.glb" },
  { id: "gas", file: "gas.glb" },
  { id: "hoist", file: "hoist.glb" },
];

const GARAGE_PLACES = [
  { id: "cabinet", name: "garageCabinet", x: 0.7, y: 0, z: -9.55, yaw: -Math.PI / 2, scale: 1.15, wall: "back" },
  { id: "workbench", name: "garageWorkbench", x: 3.0, y: 0, z: -9.65, yaw: -Math.PI / 2, scale: 1.45, wall: "back" },
  { id: "shelf", name: "garageShelf", x: 5.3, y: 0, z: -9.45, yaw: -Math.PI / 2, scale: 1.05, wall: "back" },
  { id: "tireStack", name: "garageTiresL", x: -3.5, y: 0, z: -3.6, yaw: 0.08, scale: 1.2, wall: "left" },
  { id: "drums", name: "garageDrumsL", x: -3.55, y: 0, z: -0.4, yaw: -0.06, scale: 1.0, wall: "left" },
  { id: "tireStack", name: "garageTiresR", x: 6.85, y: 0, z: 3.5, yaw: Math.PI - 0.1, scale: 1.08, wall: "right" },
  { id: "drums", name: "garageDrumsR", x: 7.05, y: 0, z: 1.2, yaw: Math.PI + 0.08, scale: 1.1, wall: "right" },
  { id: "toolchest", name: "garageToolChest", x: -3.45, y: 0, z: 2.7, yaw: 0.05, scale: 0.95, wall: "left" },
  { id: "gas", name: "garageGasBottles", x: -3.25, y: 0, z: 5.1, yaw: -0.12, scale: 0.95, wall: "left" },
  { id: "hoist", name: "garageHoist", x: 7.35, y: 0, z: -1.9, yaw: Math.PI, scale: 0.95, wall: "right" },
];

const TRACKS = [
  {
    file: "track-hafenstart.md",
    id: "blitz_cup_01_hafenstart",
    name: "Hafenstart",
    theme: "harbor",
    grass: 3,
    asphaltWidth: 13,
    scenery: ["crane", "container", "warehouse", "tank"],
    verge: [],
    ribbon: [],
    segments: [
      { type: "straight", length: 62, width: 13 },
      { type: "curve_r", radius: 22, angleDeg: 90, width: 13 },
      { type: "straight", length: 28, width: 13 },
      { type: "curve_r", radius: 22, angleDeg: 90, width: 12 },
      { type: "straight", length: 62, width: 13 },
      { type: "curve_r", radius: 22, angleDeg: 90, width: 13 },
      { type: "straight", length: 28, width: 12 },
      { type: "curve_r", radius: 22, angleDeg: 90, width: 12 },
    ],
  },
  {
    file: "track-parabolbogen.md",
    id: "blitz_cup_02_kuestenline",
    name: "Parabolbogen",
    theme: "beach",
    grass: 5,
    asphaltWidth: 12,
    scenery: ["palm", "hut", "grandstand", "scrub"],
    verge: [],
    ribbon: [{ type: "uneven", along: 70, intensity: 0.4, radius: 5 }],
    segments: [
      { type: "straight", length: 92, width: 12 },
      { type: "curve_r", radius: 50, angleDeg: 205, width: 11 },
      { type: "straight", length: 14, width: 11 },
      { type: "s_curve", width: 10 },
      { type: "curve_l", radius: 12, angleDeg: 95, width: 9 },
      { type: "curve_r", radius: 11, angleDeg: 85, width: 9 },
      { type: "straight", length: 18, width: 11 },
      { type: "choke", length: 12, width: 8 },
    ],
  },
  {
    file: "track-schikanenring.md",
    id: "blitz_cup_03_stadtring",
    name: "Schikanenring",
    theme: "city",
    grass: 3,
    asphaltWidth: 13,
    scenery: ["tower", "building", "scrub", "container"],
    verge: [
      { type: "tire_stack", along: 55, side: 1 },
      { type: "tire_stack", along: 62, side: -1 },
      { type: "concrete_barrier", along: 160, side: 1 },
      { type: "tire_stack", along: 170, side: -1 },
    ],
    ribbon: [
      { type: "oil", along: 58, side: -1, radius: 2.2 },
      { type: "uneven", along: 65, side: -1, intensity: 0.55, radius: 4 },
      { type: "oil", along: 165, side: -1, radius: 2.1 },
      { type: "uneven", along: 175, side: -1, intensity: 0.5, radius: 4 },
    ],
    segments: [
      { type: "straight", length: 60, width: 13 },
      { type: "s_curve", width: 11 },
      { type: "straight", length: 42, width: 12 },
      { type: "curve_r", radius: 32, angleDeg: 90, width: 11 },
      { type: "straight", length: 55, width: 12 },
      { type: "s_curve", width: 10 },
      { type: "straight", length: 40, width: 12 },
      { type: "curve_r", radius: 32, angleDeg: 90, width: 11 },
      { type: "straight", length: 45, width: 12 },
      { type: "curve_r", radius: 30, angleDeg: 90, width: 11 },
      { type: "straight", length: 34, width: 12 },
      { type: "curve_r", radius: 30, angleDeg: 90, width: 11 },
    ],
  },
  {
    file: "track-omegatal.md",
    id: "blitz_cup_04_buckelpiste",
    name: "Omegatal",
    theme: "canyon",
    grass: 3.5,
    asphaltWidth: 12,
    scenery: ["cliff", "spire", "scrub"],
    verge: [
      { type: "tire_stack", along: 28, side: 1 },
      { type: "tire_stack", along: 100, side: -1 },
    ],
    ribbon: [
      { type: "uneven", along: 70, intensity: 0.55, radius: 5 },
      { type: "uneven", along: 150, intensity: 0.75, radius: 6 },
      { type: "ramp", along: 165, intensity: 0.95, radius: 5 },
      { type: "uneven", along: 180, intensity: 0.65, radius: 5 },
    ],
    segments: [
      { type: "straight", length: 72, width: 12 },
      { type: "curve_r", radius: 24, angleDeg: 125, width: 9 },
      { type: "straight", length: 50, width: 11 },
      { type: "uneven_field", length: 18, width: 11 },
      { type: "curve_l", radius: 50, angleDeg: 75, width: 11 },
      { type: "straight", length: 40, width: 11 },
      { type: "curve_r", radius: 30, angleDeg: 70, width: 10 },
      { type: "uneven_field", length: 30, width: 11 },
      { type: "curve_r", radius: 26, angleDeg: 90, width: 10 },
    ],
  },
  {
    file: "track-kuppenfinale.md",
    id: "blitz_cup_05_cupfinale",
    name: "Kuppenfinale",
    theme: "factory",
    grass: 3.5,
    asphaltWidth: 12,
    scenery: ["tree", "scrub", "warehouse", "spire"],
    verge: [
      { type: "tire_stack", along: 40, side: 1 },
      { type: "concrete_barrier", along: 160, side: -1 },
      { type: "tire_stack", along: 220, side: 1 },
    ],
    ribbon: [
      { type: "ramp", along: 55, intensity: 1, radius: 5.5 },
      { type: "uneven", along: 100, intensity: 0.7, radius: 6 },
      { type: "ramp", along: 200, intensity: 0.9, radius: 5 },
      { type: "oil", along: 250, radius: 2.3 },
      { type: "uneven", along: 280, intensity: 0.65, radius: 5 },
    ],
    segments: [
      { type: "straight", length: 80, width: 12 },
      { type: "uneven_field", length: 24, width: 12 },
      { type: "curve_r", radius: 30, angleDeg: 90, width: 10 },
      { type: "straight", length: 40, width: 12 },
      { type: "uneven_field", length: 20, width: 11 },
      { type: "choke", length: 14, width: 8 },
      { type: "curve_r", radius: 28, angleDeg: 90, width: 10 },
      { type: "straight", length: 65, width: 12 },
      { type: "uneven_field", length: 18, width: 12 },
      { type: "curve_r", radius: 30, angleDeg: 90, width: 10 },
      { type: "straight", length: 40, width: 12 },
      { type: "curve_r", radius: 28, angleDeg: 90, width: 10 },
    ],
  },
];

const WALL_KIT = ["tire-wall", "concrete-wall", "fence"];
const OBSTACLE_KIT = {
  ramp: "ramp",
  uneven: "rumble",
  oil: "oil",
  tire_stack: "tire-stack",
  concrete_barrier: "barrier",
};

function pub(...parts) {
  return join(rootDir, "public", ...parts);
}

function rel(abs) {
  return abs.slice(rootDir.length + 1);
}

function modelPreview(relPublic, alt) {
  return previewMd(stemForPublicRel(relPublic), alt);
}

function mdTable(headers, rows) {
  const head = `| ${headers.join(" | ")} |`;
  const sep = `| ${headers.map(() => "---").join(" | ")} |`;
  const body = rows.map((r) => `| ${r.map((c) => String(c).replaceAll("|", "\\|")).join(" | ")} |`);
  return [head, sep, ...body].join("\n");
}

function nodeRows(nodes) {
  return nodes.map((n) => [
    `\`${n.name}\``,
    n.mesh ? `\`${n.mesh}\`` : "—",
    n.prims.length,
    n.verts,
    n.aabb ? fmtVec(aabbCenter(n.aabb)) : "—",
    n.aabb ? `${fmtVec(n.aabb.min)} → ${fmtVec(n.aabb.max)}` : "—",
    n.materials.join(", ") || "—",
  ]);
}

function namedMeshNodes(dump) {
  return dump.nodes.filter((n) => n.aabb && n.mesh);
}

function collapseUnnamed(dump) {
  const named = namedMeshNodes(dump).filter((n) => n.name !== "(unnamed)" && !/_\d+$/.test(n.name));
  return named.length ? named : namedMeshNodes(dump);
}

function yawDeg(rad) {
  return `${fmt((rad * 180) / Math.PI, 1)}°`;
}

function partGlbPath(carId, partId) {
  if (carId === "bison" && partId === "offroad_suspension") {
    return pub("models/parts/blitz-offroad_suspension.glb");
  }
  if (carId === "kaeferkraft" && partId === "big_engine") {
    return pub("models/parts/blitz-big_engine.glb");
  }
  return pub("models/parts", `${carId}-${partId}.glb`);
}

function buildCenterline(segments) {
  const points = [{ x: 0, z: 0 }];
  let x = 0;
  let z = 0;
  let heading = 0;
  const push = (px, pz) => {
    const last = points[points.length - 1];
    if (last && Math.hypot(last.x - px, last.z - pz) < 0.05) return;
    points.push({ x: px, z: pz });
  };
  const straight = (len) => {
    const steps = Math.max(2, Math.ceil(len / 4));
    for (let i = 1; i <= steps; i++) {
      x += Math.cos(heading) * (len / steps);
      z += Math.sin(heading) * (len / steps);
      push(x, z);
    }
  };
  const curve = (type, radius, angleDeg) => {
    const turnSign = type === "curve_r" ? 1 : -1;
    const cX = x - Math.sin(heading) * radius * turnSign;
    const cZ = z + Math.cos(heading) * radius * turnSign;
    const startAng = Math.atan2(z - cZ, x - cX);
    const deltaAng = turnSign * ((angleDeg * Math.PI) / 180);
    const steps = Math.max(6, Math.ceil((Math.abs(angleDeg) / 90) * 10));
    for (let i = 1; i <= steps; i++) {
      const a = startAng + deltaAng * (i / steps);
      push(cX + Math.cos(a) * radius, cZ + Math.sin(a) * radius);
    }
    const last = points[points.length - 1];
    x = last.x;
    z = last.z;
    heading += deltaAng;
  };
  const apply = (seg) => {
    if (seg.type === "straight" || seg.type === "choke" || seg.type === "uneven_field") {
      straight(seg.length ?? 20);
      return;
    }
    if (seg.type === "curve_r" || seg.type === "curve_l") {
      curve(seg.type, seg.radius ?? 18, seg.angleDeg ?? 90);
      return;
    }
    if (seg.type === "s_curve") {
      apply({ type: "curve_r", radius: 14, angleDeg: 45 });
      apply({ type: "curve_l", radius: 14, angleDeg: 45 });
    }
  };
  for (const seg of segments) apply(seg);
  const first = points[0];
  const last = points[points.length - 1];
  if (Math.hypot(first.x - last.x, first.z - last.z) > 1) {
    for (let i = 1; i <= 8; i++) {
      const t = i / 8;
      push(last.x + (first.x - last.x) * t, last.z + (first.z - last.z) * t);
    }
  }
  const dists = [0];
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += Math.hypot(points[i].x - points[i - 1].x, points[i].z - points[i - 1].z);
    dists.push(total);
  }
  return { points, dists, total: Math.max(total, 1) };
}

function sampleAlong(track, distance) {
  const d = ((distance % track.total) + track.total) % track.total;
  let i = 1;
  while (i < track.dists.length && track.dists[i] < d) i++;
  const i1 = Math.min(i, track.points.length - 1);
  const i0 = Math.max(0, i1 - 1);
  const span = Math.max(1e-6, track.dists[i1] - track.dists[i0]);
  const t = (d - track.dists[i0]) / span;
  const a = track.points[i0];
  const b = track.points[i1];
  const tx = b.x - a.x;
  const tz = b.z - a.z;
  const len = Math.hypot(tx, tz) || 1;
  return {
    x: a.x + tx * t,
    z: a.z + tz * t,
    tx: tx / len,
    tz: tz / len,
  };
}

function offsetPoint(s, lateral) {
  return { x: s.x + -s.tz * lateral, z: s.z + s.tx * lateral };
}

function mountPointsForGrid(car, uIdx, vIdx) {
  const mounts = MOUNTS[car.id] ?? {};
  const points = [];
  for (const [partId, anchors] of Object.entries(mounts)) {
    anchors.forEach((a, i) => {
      const xyz = [a.x, a.y, a.z];
      points.push({
        name: anchors.length > 1 ? `${partId}[${i}]` : partId,
        u: xyz[uIdx],
        v: xyz[vIdx],
        color: "#12b886",
      });
    });
  }
  return points;
}

async function dumpCar(car, dest) {
  const glbPath = pub("models/cars", `${car.id}.glb`);
  const dump = await inspectGlb(glbPath);
  const meshNodes = collapseUnnamed(dump);
  const topItems = nodesToGridItems(meshNodes, 0, 2);
  const sideItems = nodesToGridItems(meshNodes, car.sideU, car.sideV);
  const topSvg = gridSvg({
    title: `${car.name} — top (mesh XZ)`,
    uLabel: "+X",
    vLabel: "+Z",
    items: topItems,
    points: mountPointsForGrid(car, 0, 2),
  });
  const sideSvg = gridSvg({
    title: `${car.name} — side`,
    uLabel: car.sideULabel,
    vLabel: car.sideVLabel,
    items: sideItems,
    points: mountPointsForGrid(car, car.sideU, car.sideV),
  });

  const shop = PART_IDS.filter((id) => !car.shopSkip.includes(id));
  const lines = [];
  lines.push(
    `# ${car.name} — mesh cheat sheet`,
    "",
    `Use these **exact names** in commands (node / mesh / part id). Coordinates are **mesh space, meters**.`,
    "",
    "## Identity",
    "",
    mdTable(
      ["Field", "Value"],
      [
        ["Car id", `\`${car.id}\``],
        ["German name", car.name],
        ["Class", car.classLabel],
        ["GLB", `\`${rel(glbPath)}\``],
        ["Runtime yaw", `${fmt(car.yaw, 4)} rad — ${car.yawNote}`],
        ["Collision radius", `${car.collisionRadius} m (silhouette, not mesh)`],
        ["Default paint", `\`${car.defaultPaint}\``],
        ["Root AABB", dump.aabb ? `${fmtVec(dump.aabb.min)} → ${fmtVec(dump.aabb.max)}` : "—"],
      ],
    ),
    "",
    "## Model",
    "",
    modelPreview(rel(glbPath), car.name),
    "",
    "## Command names (runtime)",
    "",
    "- Body / paint: `BodyPaint` (recolor target)",
    "- Wheels in GLB: `StockWheel_FL` `StockWheel_FR` `StockWheel_RL` `StockWheel_RR`",
    "- Wheel wrappers (added at load): `WheelSteer_{FL,FR,RL,RR}` + `WheelSpin_{FL,FR,RL,RR}`",
    "- Stock extras if present: `StockSpoiler` (Blitz Heckspoiler), `StockCage` (Käferkraft, hidden when `reinforced_frame` on), `StockEngine` (Donnerbüchse, hidden when `big_engine` on)",
    "- Equipped Teile group: `carParts` / objects `carPart-{partId}` (copy `carPart-{partId}-1`…)",
    car.wideWheels
      ? "- Große Räder: **width-scale** root `StockWheel_*` ×1.2 along axle (same diameter; replaces stock; no procedural overlay)"
      : car.scaledWheels
        ? "- Große Räder: **scale** root `StockWheel_*` (do not scale `…_1` children); hub drop by radius×(scale−1)"
        : "- Große Räder: hide stock wheels + procedural overlays (not Blitz/Bison/Käferkraft/Donnerbüchse)",
    car.noses
      ? "- Cosmetics: sticker ids `none|flames|bolt|star` → noses `none|skull|bird|dog` (`buggy-skull.glb` / `buggy-bird.glb` / `buggy-dog.glb`)"
      : "- Cosmetics: stickers `none|flames|bolt|star` (flames GLB `public/models/stickers/flames.glb`)",
    "",
    "## Coordinate grids (meters)",
    "",
    "Orange boxes = mesh AABBs. Green dots = Teil **mount anchors** (`CAR_PART_LAYOUTS`). Red = X/u origin, blue = Z/v origin.",
    "",
    topSvg,
    "",
    sideSvg,
    "",
    "## Nodes / meshes",
    "",
    mdTable(
      ["Node", "Mesh", "Prims", "Verts", "Center xyz", "AABB min → max", "Materials"],
      nodeRows(dump.nodes.filter((n) => n.mesh || n.name !== "(unnamed)")),
    ),
    "",
    "## Materials",
    "",
    dump.materials.map((m) => `- \`${m}\``).join("\n") || "- —",
    "",
    "## Shop Teile + mounts",
    "",
    mdTable(
      ["Part id", "German", "Shop", "GLB", "Mount xyz (yaw, scale)"],
      shop.map((id) => {
        const path = partGlbPath(car.id, id);
        const exists = existsSync(path);
        const scaledNote = id === "big_wheels" && car.scaledWheels
          ? (car.wideWheels ? "StockWheel width ×1.2" : "StockWheel scale")
          : null;
        const stats = car.shopStatsOnly.includes(id)
          ? "stats-only / no mesh"
          : scaledNote
            ? scaledNote
            : exists
              ? `\`${rel(path)}\``
              : "procedural / missing";
        const anchors = (MOUNTS[car.id]?.[id] ?? []).map(
          (a) => `${fmtVec([a.x, a.y, a.z])} yaw ${yawDeg(a.yaw ?? 0)} ×${fmt(a.scale ?? 1)}${a.note ? ` — ${a.note}` : ""}`,
        );
        return [
          `\`${id}\``,
          PART_NAMES[id],
          car.shopStatsOnly.includes(id) ? "yes (stats)" : "yes",
          stats,
          anchors.join("<br>") || "—",
        ];
      }),
    ),
  );

  if (car.id === "kaeferkraft") {
    lines.push(
      "",
      "## Waist anchor picker",
      "",
      "Live poles are detached: say `WaistL` (−Z) or `WaistR` (+Z). Stays `WaistToFrontTop_L` / `WaistToFrontTop_R` stop at BodyPaint cage picks. Dark charcoal like the stock cage; waist caps bury 8 cm. Leichtbau panels are detached the same way: `LightweightL` (mesh +X → car −Z) / `LightweightR` (mesh −X → car +Z).",
      "",
      "![Käferkraft Waist anchors](../../assets/tripo-concepts/kaeferkraft-waist-anchors.png)",
      "",
      "Full legend: [kaeferkraft-waist-anchors.md](../../assets/tripo-concepts/kaeferkraft-waist-anchors.md).",
      "",
      mdTable(
        ["ID", "x", "y", "z", "Meaning"],
        [
          ["`LF1` / `RF1`", "-0.55", "0.96", "±0.55", "deeper into teal cowl"],
          ["`LF2` / `RF2`", "-0.32", "0.96", "±0.55", "previous front"],
          ["`LF3` / `RF3`", "-0.32", "0.72", "±0.55", "lower sill / hip"],
          ["`LF4` / `RF4`", "-0.32", "1.15", "±0.55", "higher belt / A-pillar"],
          ["`LR1` / `RR1`", "0.40", "0.85", "±0.55", "seat-back foot"],
          ["`LR2` / `RR2`", "0.58", "0.96", "±0.55", "previous rear joint"],
          ["`LR3` / `RR3`", "0.58", "1.20", "±0.55", "rear hoop mid"],
          ["`LR4` / `RR4`", "0.90", "0.90", "±0.55", "rear deck behind seats"],
        ],
      ),
    );
  }

  const extraGlbs = [];
  for (const id of shop) {
    const p = partGlbPath(car.id, id);
    if (existsSync(p) && !extraGlbs.includes(p)) extraGlbs.push(p);
  }
  if (car.noses) {
    for (const n of ["buggy-skull", "buggy-bird", "buggy-dog"]) {
      extraGlbs.push(pub("models/props", `${n}.glb`));
    }
  } else if (existsSync(pub("models/stickers/flames.glb"))) {
    extraGlbs.push(pub("models/stickers/flames.glb"));
  }

  for (const p of extraGlbs) {
    const d = await inspectGlb(p);
    const items = nodesToGridItems(collapseUnnamed(d), 0, 2);
    lines.push(
      "",
      `## Part / extra \`${rel(p)}\``,
      "",
      modelPreview(rel(p), rel(p)),
      "",
      d.aabb ? `Root AABB ${fmtVec(d.aabb.min)} → ${fmtVec(d.aabb.max)}` : "",
      "",
      gridSvg({
        title: `${rel(p)} — top XZ`,
        uLabel: "+X",
        vLabel: "+Z",
        items,
      }),
      "",
      mdTable(
        ["Node", "Mesh", "Prims", "Verts", "Center xyz", "AABB min → max", "Materials"],
        nodeRows(d.nodes.filter((n) => n.mesh)),
      ),
    );
  }

  writeFileSync(join(dest, `car-${car.id}.md`), `${lines.join("\n")}\n`);
}

async function dumpGarage(dest) {
  const lines = [
    "# Garage — mesh cheat sheet",
    "",
    "World space, meters. Car sits on the **turntable** (`garagePad` at `(1.5, 0.04, 0)`, radius 4.5 m). Prop bake front = local **+X**.",
    "",
    "## Command names",
    "",
    "- Group: `garageBay`",
    "- Shell: `garageFloor`, `garageWallBack` `(1, 5.5, -11)`, `garageWallLeft` `(-11.5, 5.5, 0)`, `garageWallRight` `(12.5, 5.5, 0)`",
    "- Pad: `garagePad` → `garagePadDeck`, `garageTurntableMesh`",
    "- Stock group `garageStock`, hero group `garageHero`",
    "- Instance names below (`garageCabinet`, …)",
    "",
    "## Bay layout (world XZ)",
    "",
  ];

  const items = [
    { name: "pad", umin: 1.5 - 4.5, umax: 1.5 + 4.5, vmin: -4.5, vmax: 4.5, fill: "#868e9644", stroke: "#52545e" },
    { name: "back wall", umin: -12, umax: 14, vmin: -11.2, vmax: -10.8, fill: "#339af044", stroke: "#339af0" },
    { name: "left wall", umin: -11.7, umax: -11.3, vmin: -12, vmax: 12, fill: "#339af044", stroke: "#339af0" },
    { name: "right wall", umin: 12.3, umax: 12.7, vmin: -12, vmax: 12, fill: "#339af044", stroke: "#339af0" },
  ];
  const points = GARAGE_PLACES.map((p) => ({ name: p.name, u: p.x, v: p.z, color: "#f08c00" }));
  points.push({ name: "pad center", u: 1.5, v: 0, color: "#e03131" });

  lines.push(
    gridSvg({
      title: "Garage bay — world XZ",
      uLabel: "+X",
      vLabel: "+Z",
      items,
      points,
      width: 820,
      height: 640,
    }),
    "",
    "## Placements",
    "",
    mdTable(
      ["Runtime name", "Prop id", "Wall", "Position xyz", "Yaw", "Scale", "GLB"],
      GARAGE_PLACES.map((p) => {
        const spec = GARAGE_PROPS.find((g) => g.id === p.id);
        return [
          `\`${p.name}\``,
          `\`${p.id}\``,
          p.wall,
          fmtVec([p.x, p.y, p.z]),
          yawDeg(p.yaw),
          fmt(p.scale),
          spec ? `\`public/models/garage/${spec.file}\`` : "—",
        ];
      }),
    ),
    "",
    "## Shell GLBs",
    "",
  );

  for (const s of GARAGE_SHELL) {
    const p = pub("models/garage", s.file);
    if (!existsSync(p)) continue;
    const d = await inspectGlb(p);
    lines.push(
      `### \`${s.id}\` — \`${rel(p)}\``,
      "",
      `Runtime: ${s.runtime}`,
      "",
      modelPreview(rel(p), s.id),
      "",
      d.aabb ? `Root AABB ${fmtVec(d.aabb.min)} → ${fmtVec(d.aabb.max)}` : "",
      "",
      gridSvg({
        title: `${s.file} — local XZ`,
        uLabel: "+X",
        vLabel: "+Z",
        items: nodesToGridItems(collapseUnnamed(d), 0, 2),
      }),
      "",
      mdTable(
        ["Node", "Mesh", "Prims", "Verts", "Center xyz", "AABB min → max", "Materials"],
        nodeRows(d.nodes.filter((n) => n.mesh)),
      ),
      "",
    );
  }

  lines.push("## Prop GLBs (local mesh space)", "");
  for (const s of GARAGE_PROPS) {
    const p = pub("models/garage", s.file);
    const d = await inspectGlb(p);
    lines.push(
      `### \`${s.id}\` — \`${rel(p)}\``,
      "",
      modelPreview(rel(p), s.id),
      "",
      d.aabb ? `Root AABB ${fmtVec(d.aabb.min)} → ${fmtVec(d.aabb.max)}` : "",
      "",
      gridSvg({
        title: `${s.file} — local XZ (front +X)`,
        uLabel: "+X front",
        vLabel: "+Z",
        items: nodesToGridItems(collapseUnnamed(d), 0, 2),
      }),
      "",
      mdTable(
        ["Node", "Mesh", "Prims", "Verts", "Center xyz", "AABB min → max", "Materials"],
        nodeRows(d.nodes.filter((n) => n.mesh)),
      ),
      "",
    );
  }

  writeFileSync(join(dest, "garage.md"), `${lines.join("\n")}\n`);
}

async function dumpTrack(track, dest) {
  const built = buildCenterline(track.segments);
  const half = track.asphaltWidth / 2;
  const poly = built.points.map((p) => [p.x, p.z]);
  const points = [];
  for (const v of track.verge) {
    const s = sampleAlong(built, v.along);
    const p = offsetPoint(s, v.side * (half + Math.min(1.4, track.grass * 0.5)));
    points.push({ name: `${v.type}@${v.along}`, u: p.x, v: p.z, color: "#e03131" });
  }
  for (const h of track.ribbon) {
    const s = sampleAlong(built, h.along);
    const p = offsetPoint(s, (h.side ?? 0) * half * 0.35);
    points.push({ name: `${h.type}@${h.along}`, u: p.x, v: p.z, color: "#f08c00" });
  }
  const kitIds = [...WALL_KIT, ...track.scenery];
  for (const h of [...track.verge, ...track.ribbon]) {
    const id = OBSTACLE_KIT[h.type];
    if (id && !kitIds.includes(id)) kitIds.push(id);
  }

  const lines = [
    `# ${track.name} — track cheat sheet`,
    "",
    `Level id: \`${track.id}\` · theme: \`${track.theme}\` · free/training reuse this layout. Ad-hoc maps theme \`${track.theme}\` onto the same kit.`,
    "",
    "## Identity",
    "",
    mdTable(
      ["Field", "Value"],
      [
        ["Cup id", `\`${track.id}\``],
        ["Display", track.name],
        ["Theme", `\`${track.theme}\``],
        ["Asphalt width", `${track.asphaltWidth} m`],
        ["Grass width", `${track.grass} m`],
        ["Walls", "tires in corners, concrete on straights + fence on jersey"],
        ["Centerline length (approx)", `${fmt(built.total, 1)} m`],
        ["Heading 0", "start at origin, +X forward"],
      ],
    ),
    "",
    "## World grid (XZ, meters)",
    "",
    "Black polyline = centerline. Orange = ribbon hazards (on asphalt). Red = verge solids (grass). Origin = start/S-F.",
    "",
    gridSvg({
      title: `${track.name} — world XZ`,
      uLabel: "+X",
      vLabel: "+Z",
      polylines: [{ pts: poly, color: "#1a1a1a", width: 3 }],
      points,
      width: 820,
      height: 640,
    }),
    "",
    "## Segments",
    "",
    mdTable(
      ["#", "Type", "Length / radius", "Angle", "Width"],
      track.segments.map((s, i) => [
        i,
        `\`${s.type}\``,
        s.length != null ? `${s.length} m` : s.radius != null ? `r ${s.radius} m` : "—",
        s.angleDeg != null ? `${s.angleDeg}°` : "—",
        s.width ?? "—",
      ]),
    ),
    "",
    "## Obstacles (authored)",
    "",
    mdTable(
      ["Kind", "Type", "Along (m)", "Side", "Kit GLB"],
      [
        ...track.verge.map((v) => [
          "verge",
          `\`${v.type}\``,
          v.along,
          v.side,
          `\`public/models/track/${OBSTACLE_KIT[v.type]}.glb\``,
        ]),
        ...track.ribbon.map((h) => [
          "ribbon",
          `\`${h.type}\``,
          h.along,
          h.side ?? 0,
          `\`public/models/track/${OBSTACLE_KIT[h.type]}.glb\``,
        ]),
      ].concat(
        track.verge.length + track.ribbon.length
          ? []
          : [["—", "none authored (median planner may still add stacks)", "—", "—", "—"]],
      ),
    ),
    "",
    "## Kit meshes used here",
    "",
    "Shared walls on every cup: `tire-wall`, `concrete-wall`, `fence`. Theme scenery + obstacles below (local mesh space).",
    "",
  ];

  for (const id of kitIds) {
    const p = pub("models/track", `${id}.glb`);
    if (!existsSync(p)) continue;
    const d = await inspectGlb(p);
    lines.push(
      `### \`${id}\` — \`${rel(p)}\``,
      "",
      modelPreview(rel(p), id),
      "",
      d.aabb ? `Root AABB ${fmtVec(d.aabb.min)} → ${fmtVec(d.aabb.max)}` : "",
      "",
      gridSvg({
        title: `${id} — local XZ`,
        uLabel: "+X",
        vLabel: "+Z",
        items: nodesToGridItems(collapseUnnamed(d), 0, 2),
      }),
      "",
      mdTable(
        ["Node", "Mesh", "Prims", "Verts", "Center xyz", "AABB min → max", "Materials"],
        nodeRows(d.nodes.filter((n) => n.mesh)),
      ),
      "",
    );
  }

  writeFileSync(join(dest, track.file), `${lines.join("\n")}\n`);
}

function writeIndex(dest) {
  const body = [
    "# Mesh cheat sheets",
    "",
    "One sheet per car, the garage, and each cup track. Each sheet lists **nodes, meshes, submeshes, materials, runtime names**, a **3/4 photo of the GLB**, plus **meter coordinates** on an SVG **grid** (origin through the axes).",
    "",
    "**Keep in sync:** after any car/garage/track GLB, named node, mount, or catalog change, run `npm run docs:cheatsheets` in the same step (renders GLB photos, then markdown). New ids go in `scripts/dump-mesh-cheatsheets.mjs` first.",
    "",
    "## How to command",
    "",
    "- Prefer **ids and node names** from these sheets (`blitz`, `StockWheel_FL`, `garageCabinet`, `tire-wall`).",
    "- Car numbers are **mesh space** unless you say world/runtime. Käferkraft bake is **nose −X** (runtime yaw π/2).",
    "- F6 **Kasten** (B): drag a rectangle, drag the 8 corner dots to resize (last Kasten only). **Seite** (panel or RMB menu) then LMB rolls the car in the view. **Shift+drag** paints another Kasten. **Kasten kopieren** / C copies every Kasten; **Zurück** / Pos1 restores the last painted size; Esc drops the last Kasten.",
    "- Garage numbers are **world** (`garagePad` at x=1.5). Track overview is **world XZ**; kit pieces are **local**.",
    "- Green dots on car grids are Teil **mount anchors**, not mesh centroids.",
    "",
    "## F5 PATCH (apply forever)",
    "",
    "When the user pastes a `CRASH CIRCUIT F5 PATCH v1` block (copied from F6 **Änderung kopieren** / C / RMB after moving a part):",
    "",
    "1. Save it to a file (e.g. `tmp/f5-patch.txt`).",
    "2. Run **`npm run mesh:apply-f5-patch -- tmp/f5-patch.txt`** for `apply: glb-node` rows (writes the named GLB).",
    "3. For `apply: mount` / `carPart-*` groups: set that car’s mount xyz in `src/render/carParts.ts` to the patch `to` origin.",
    "4. **`npm run docs:cheatsheets`**, version, commit `master`, push.",
    "",
    "Do not leave the pose as a runtime-only F5 edit.",
    "",
    "## Cars",
    "",
    ...CARS.map((c) => `- [${c.name}](./car-${c.id}.md) — \`${c.id}\``),
    "",
    "Käferkraft detached `WaistL` / `WaistR` and Leichtbau `LightweightL` / `LightweightR`: [kaeferkraft-waist-anchors.md](../../assets/tripo-concepts/kaeferkraft-waist-anchors.md).",
    "",
    "## Garage",
    "",
    "- [Garage bay](./garage.md)",
    "",
    "## Tracks (cup layouts; free + training reuse the same mesh kit)",
    "",
    ...TRACKS.map((t) => `- [${t.name}](./${t.file}) — \`${t.id}\` · theme \`${t.theme}\``),
    "",
  ];
  writeFileSync(join(dest, "README.md"), `${body.join("\n")}\n`);
}

export async function generateCheatsheets(dest = DEFAULT_OUT, { quiet = false } = {}) {
  mkdirSync(dest, { recursive: true });
  writeIndex(dest);
  for (const car of CARS) {
    if (!quiet) process.stdout.write(`car ${car.id}… `);
    await dumpCar(car, dest);
    if (!quiet) console.log("ok");
  }
  if (!quiet) process.stdout.write("garage… ");
  await dumpGarage(dest);
  if (!quiet) console.log("ok");
  for (const track of TRACKS) {
    if (!quiet) process.stdout.write(`track ${track.name}… `);
    await dumpTrack(track, dest);
    if (!quiet) console.log("ok");
  }
  const files = readdirSync(dest).sort();
  if (!quiet) console.log("wrote", files.length, "files in", rel(dest));
  return files;
}

const invoked = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invoked) {
  const outArg = process.argv.find((a) => a.startsWith("--out="))?.slice(6);
  await generateCheatsheets(outArg ? resolve(outArg) : DEFAULT_OUT);
}
