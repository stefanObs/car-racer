/** F8 Strecken-Editor — DTOs, fly camera, snapshot/reset, F8 patch text. */

import type {
  LevelClearanceGauge,
  LevelDefinition,
  LevelSceneryPlacement,
} from "../track/types";
import { gaugeBoxSize, themeToEditorPanoramaKind, type TrackEditorPanoramaKind } from "../data/trackEditorCatalog";
import { nearestOnTrack } from "../track/buildTrack";
import type { BuiltTrack } from "../track/types";

export const TRACK_EDITOR_PATCH_HEADER = "CRASH CIRCUIT F8 TRACK PATCH v1";
export const TRACK_EDITOR_DEFAULT_LEVEL_ID = "blitz_cup_01_hafenstart";
export const TRACK_EDITOR_GAUGE_KIND = "gauge";

export const FLY_SPEED = 14;
export const FLY_SPRINT = 36;
export const EDITOR_NUDGE_SPEED = 12;
export const EDITOR_YAW_STEP = 0.12;
export const FLY_PITCH_MIN = -1.35;
export const FLY_PITCH_MAX = 1.35;

export type FlyCamera = {
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
};

export type FlyMoveInput = {
  /** -1..1 along look (W/S). */
  forward: number;
  /** -1..1 strafe (D/A). */
  right: number;
  /** -1..1 world up (E/Q, Space/Ctrl). */
  up: number;
  /** Yaw delta this step (radians). */
  lookYaw: number;
  /** Pitch delta this step (radians). */
  lookPitch: number;
  sprint: boolean;
};

export type TrackEditorPlacement = {
  id: string;
  kind: string;
  x: number;
  y: number;
  z: number;
  yaw: number;
};

export type TrackEditorDoc = {
  levelId: string;
  panoramaKind: TrackEditorPanoramaKind;
  panoramaOffsetY: number;
  panoramaHeightScale: number;
  hideScenery: boolean;
  selectedId: string | null;
  paletteKind: string;
  placements: TrackEditorPlacement[];
  nextId: number;
};

export function emptyTrackEditorDoc(
  levelId = TRACK_EDITOR_DEFAULT_LEVEL_ID,
  paletteKind = TRACK_EDITOR_GAUGE_KIND,
  panoramaKind: TrackEditorPanoramaKind = "harbor",
): TrackEditorDoc {
  return {
    levelId,
    panoramaKind,
    panoramaOffsetY: 0,
    panoramaHeightScale: 1,
    hideScenery: false,
    selectedId: null,
    paletteKind,
    placements: [],
    nextId: 1,
  };
}

export function emptyTrackEditorDocForLevel(
  levelId: string,
  levelTheme: string,
  paletteKind = TRACK_EDITOR_GAUGE_KIND,
): TrackEditorDoc {
  return emptyTrackEditorDoc(levelId, paletteKind, themeToEditorPanoramaKind(levelTheme));
}

export function cloneTrackEditorDoc(doc: TrackEditorDoc): TrackEditorDoc {
  return {
    ...doc,
    placements: doc.placements.map((p) => ({ ...p })),
  };
}

export function snapshotTrackEditor(doc: TrackEditorDoc): TrackEditorDoc {
  return cloneTrackEditorDoc(doc);
}

export function restoreTrackEditor(snap: TrackEditorDoc): TrackEditorDoc {
  return cloneTrackEditorDoc(snap);
}

function numClose(a: number, b: number, eps = 1e-4): boolean {
  return Math.abs(a - b) <= eps;
}

export function trackEditorDirty(current: TrackEditorDoc, snap: TrackEditorDoc): boolean {
  if (current.levelId !== snap.levelId) return true;
  if (current.panoramaKind !== snap.panoramaKind) return true;
  if (!numClose(current.panoramaOffsetY, snap.panoramaOffsetY)) return true;
  if (!numClose(current.panoramaHeightScale, snap.panoramaHeightScale)) return true;
  if (current.hideScenery !== snap.hideScenery) return true;
  if (current.placements.length !== snap.placements.length) return true;
  for (let i = 0; i < current.placements.length; i++) {
    const a = current.placements[i]!;
    const b = snap.placements[i]!;
    if (a.id !== b.id || a.kind !== b.kind) return true;
    if (!numClose(a.x, b.x) || !numClose(a.y, b.y) || !numClose(a.z, b.z) || !numClose(a.yaw, b.yaw)) {
      return true;
    }
  }
  return false;
}

export function addPlacement(
  doc: TrackEditorDoc,
  kind: string,
  x: number,
  y: number,
  z: number,
  yaw = 0,
): TrackEditorDoc {
  const id = `p-${doc.nextId}`;
  return {
    ...doc,
    nextId: doc.nextId + 1,
    selectedId: id,
    placements: [...doc.placements, { id, kind, x, y, z, yaw }],
  };
}

export function movePlacement(doc: TrackEditorDoc, id: string, x: number, z: number): TrackEditorDoc {
  return {
    ...doc,
    placements: doc.placements.map((p) => (p.id === id ? { ...p, x, z } : p)),
  };
}

export function setPlacementY(doc: TrackEditorDoc, id: string, y: number): TrackEditorDoc {
  return {
    ...doc,
    placements: doc.placements.map((p) => (p.id === id ? { ...p, y } : p)),
  };
}

export function yawPlacement(doc: TrackEditorDoc, id: string, delta: number): TrackEditorDoc {
  return {
    ...doc,
    placements: doc.placements.map((p) => (p.id === id ? { ...p, yaw: p.yaw + delta } : p)),
  };
}

export function nudgePlacement(
  doc: TrackEditorDoc,
  id: string,
  dx: number,
  dy: number,
  dz: number,
): TrackEditorDoc {
  return {
    ...doc,
    placements: doc.placements.map((p) =>
      p.id === id ? { ...p, x: p.x + dx, y: p.y + dy, z: p.z + dz } : p,
    ),
  };
}

export function deletePlacement(doc: TrackEditorDoc, id: string): TrackEditorDoc {
  return {
    ...doc,
    selectedId: doc.selectedId === id ? null : doc.selectedId,
    placements: doc.placements.filter((p) => p.id !== id),
  };
}

export function selectPlacement(doc: TrackEditorDoc, id: string | null): TrackEditorDoc {
  return { ...doc, selectedId: id };
}

export function selectedPlacement(doc: TrackEditorDoc): TrackEditorPlacement | null {
  if (!doc.selectedId) return null;
  return doc.placements.find((p) => p.id === doc.selectedId) ?? null;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

export function flyForward(cam: FlyCamera): { x: number; y: number; z: number } {
  const cp = Math.cos(cam.pitch);
  return {
    x: Math.sin(cam.yaw) * cp,
    y: Math.sin(cam.pitch),
    z: Math.cos(cam.yaw) * cp,
  };
}

/** Horizontal fly / nudge basis — ignores pitch so arrow keys stay level. */
export function flyFlatForward(yaw: number): { x: number; z: number } {
  return { x: Math.sin(yaw), z: Math.cos(yaw) };
}

export function flyFlatRight(yaw: number): { x: number; z: number } {
  return { x: Math.cos(yaw), z: -Math.sin(yaw) };
}

export function flyLookTarget(cam: FlyCamera): { x: number; y: number; z: number } {
  const f = flyForward(cam);
  return { x: cam.x + f.x, y: cam.y + f.y, z: cam.z + f.z };
}

export function defaultFlyCamera(origin: { x: number; z: number }, heading: number): FlyCamera {
  const back = 18;
  return {
    x: origin.x - Math.cos(heading) * back,
    y: 12,
    z: origin.z - Math.sin(heading) * back,
    yaw: Math.atan2(Math.cos(heading), Math.sin(heading)),
    pitch: -0.32,
  };
}

export function stepFlyCamera(cam: FlyCamera, input: FlyMoveInput, dt: number): FlyCamera {
  const yaw = cam.yaw + input.lookYaw;
  const pitch = clamp(cam.pitch + input.lookPitch, FLY_PITCH_MIN, FLY_PITCH_MAX);
  const next: FlyCamera = { ...cam, yaw, pitch };
  const speed = (input.sprint ? FLY_SPRINT : FLY_SPEED) * Math.max(0, dt);
  const flat = flyFlatForward(next.yaw);
  const right = flyFlatRight(next.yaw);
  return {
    ...next,
    x: next.x + (flat.x * input.forward + right.x * input.right) * speed,
    y: next.y + input.up * speed,
    z: next.z + (flat.z * input.forward + right.z * input.right) * speed,
  };
}

function fmt(n: number, digits = 2): string {
  return String(Number(n.toFixed(digits)));
}

export function formatTrackEditorPatch(doc: TrackEditorDoc): string {
  const lines = [
    TRACK_EDITOR_PATCH_HEADER,
    "instruction: Apply overlay placements and panorama height on this cup track. Do not treat this as a player mode.",
    `level: ${doc.levelId}`,
    `panoramaKind: ${doc.panoramaKind}`,
    `panoramaOffsetY: ${fmt(doc.panoramaOffsetY, 3)}`,
    `panoramaHeightScale: ${fmt(doc.panoramaHeightScale, 3)}`,
    "placements:",
  ];
  if (doc.placements.length === 0) {
    lines.push("- (none)");
  } else {
    for (const p of doc.placements) {
      lines.push(
        `- kind=${p.kind} x=${fmt(p.x)} y=${fmt(p.y)} z=${fmt(p.z)} yaw=${fmt(p.yaw, 3)}`,
      );
    }
  }
  return lines.join("\n");
}

const PLACE_RE = /^- kind=(\S+) x=([-\d.]+) y=([-\d.]+) z=([-\d.]+) yaw=([-\d.]+)\s*$/;

export function parseTrackEditorPatch(text: string): TrackEditorDoc | null {
  const lines = text.trim().split(/\r?\n/);
  if (lines[0]?.trim() !== TRACK_EDITOR_PATCH_HEADER) return null;
  let levelId = TRACK_EDITOR_DEFAULT_LEVEL_ID;
  let panoramaKind: TrackEditorPanoramaKind = "harbor";
  let panoramaOffsetY = 0;
  let panoramaHeightScale = 1;
  const placements: TrackEditorPlacement[] = [];
  let nextId = 1;
  let inPlacements = false;
  for (const raw of lines.slice(1)) {
    const line = raw.trim();
    if (line.startsWith("level:")) {
      levelId = line.slice("level:".length).trim() || levelId;
      continue;
    }
    if (line.startsWith("panoramaKind:")) {
      const raw = line.slice("panoramaKind:".length).trim();
      if (raw === "harbor" || raw === "beach" || raw === "city" || raw === "factory" || raw === "canyon") {
        panoramaKind = raw;
      }
      continue;
    }
    if (line.startsWith("panoramaOffsetY:")) {
      const n = Number(line.slice("panoramaOffsetY:".length).trim());
      if (Number.isFinite(n)) panoramaOffsetY = n;
      continue;
    }
    if (line.startsWith("panoramaHeightScale:")) {
      const n = Number(line.slice("panoramaHeightScale:".length).trim());
      if (Number.isFinite(n)) panoramaHeightScale = n;
      continue;
    }
    if (line === "placements:") {
      inPlacements = true;
      continue;
    }
    if (!inPlacements) continue;
    if (line === "- (none)" || line === "") continue;
    const m = PLACE_RE.exec(line);
    if (!m) continue;
    placements.push({
      id: `p-${nextId}`,
      kind: m[1]!,
      x: Number(m[2]),
      y: Number(m[3]),
      z: Number(m[4]),
      yaw: Number(m[5]),
    });
    nextId += 1;
  }
  return {
    levelId,
    panoramaKind,
    panoramaOffsetY,
    panoramaHeightScale,
    hideScenery: false,
    selectedId: null,
    paletteKind: TRACK_EDITOR_GAUGE_KIND,
    placements,
    nextId,
  };
}

/** Bake an F8 patch onto a cup level (panorama + props; gauge → clearanceGauges). */
export function applyTrackEditorPatchToLevel(
  level: LevelDefinition,
  doc: TrackEditorDoc,
): LevelDefinition {
  if (doc.levelId !== level.id) {
    throw new Error(`F8 patch level ${doc.levelId} does not match ${level.id}`);
  }
  const sceneryPlacements: LevelSceneryPlacement[] = doc.placements
    .filter((p) => p.kind !== TRACK_EDITOR_GAUGE_KIND)
    .map(({ kind, x, y, z, yaw }) => ({ kind, x, y, z, yaw }));
  const clearanceGauges: LevelClearanceGauge[] = doc.placements
    .filter((p) => p.kind === TRACK_EDITOR_GAUGE_KIND)
    .map(({ x, y, z, yaw }) => ({ x, y, z, yaw }));
  return {
    ...level,
    panorama: {
      offsetY: doc.panoramaOffsetY,
      heightScale: doc.panoramaHeightScale,
    },
    sceneryPlacements: sceneryPlacements.length ? sceneryPlacements : undefined,
    clearanceGauges: clearanceGauges.length ? clearanceGauges : undefined,
  };
}

/** Seed the F8 editor from baked level overlay fields. */
export function trackEditorDocFromLevel(
  level: LevelDefinition,
  paletteKind = TRACK_EDITOR_GAUGE_KIND,
): TrackEditorDoc {
  const placements: TrackEditorPlacement[] = [];
  let nextId = 1;
  for (const p of level.sceneryPlacements ?? []) {
    placements.push({ id: `p-${nextId}`, kind: p.kind, x: p.x, y: p.y, z: p.z, yaw: p.yaw });
    nextId += 1;
  }
  for (const g of level.clearanceGauges ?? []) {
    placements.push({
      id: `p-${nextId}`,
      kind: TRACK_EDITOR_GAUGE_KIND,
      x: g.x,
      y: g.y,
      z: g.z,
      yaw: g.yaw,
    });
    nextId += 1;
  }
  return {
    levelId: level.id,
    panoramaKind: themeToEditorPanoramaKind(level.theme),
    panoramaOffsetY: level.panorama?.offsetY ?? 0,
    panoramaHeightScale: level.panorama?.heightScale ?? 1,
    hideScenery: false,
    selectedId: null,
    paletteKind,
    placements,
    nextId,
  };
}

/** True when every corner of the Durchfahrt box sits on asphalt (F8 bake validation). */
export function clearanceGaugeFitsTrack(
  track: BuiltTrack,
  gauge: LevelClearanceGauge,
  margin = 0.12,
): boolean {
  const { width, depth } = gaugeBoxSize();
  const hw = width / 2;
  const hd = depth / 2;
  const cos = Math.cos(gauge.yaw);
  const sin = Math.sin(gauge.yaw);
  const limit = track.asphaltHalfWidth - margin;
  for (const [lx, lz] of [
    [-hw, -hd],
    [hw, -hd],
    [hw, hd],
    [-hw, hd],
  ] as const) {
    const x = gauge.x + lx * cos - lz * sin;
    const z = gauge.z + lx * sin + lz * cos;
    const near = nearestOnTrack(track, { x, z });
    if (Math.abs(near.lateral) > limit) return false;
  }
  return true;
}
