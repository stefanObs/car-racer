import type { CarId } from "./cars";
import { TRACK_PROP_IDS, type TrackPropId } from "./trackModels";

/**
 * Mesh-space lateral width (m) with the car sitting nose +Z.
 * Käferkraft bake is nose −X — runtime yaw π/2, so width is the mesh Z span.
 * Source: `.cursor/cheatsheets/car-*.md` Root AABB.
 */
export const CAR_LATERAL_WIDTH_M: Record<CarId, number> = {
  blitz: 1.774,
  bison: 1.702,
  kaeferkraft: 1.908,
  donnerbuechse: 2.388,
  bunker: 1.966,
};

export const GAUGE_WIDTH_RATIO = 0.8;
export const GAUGE_HEIGHT_M = 1.05;
export const GAUGE_DEPTH_M = 1.4;

export const TRACK_EDITOR_GAUGE_KIND = "gauge" as const;

export type TrackEditorPanoramaKind = "harbor" | "beach" | "city" | "factory" | "canyon";

export const TRACK_EDITOR_PANORAMA_KINDS: { id: TrackEditorPanoramaKind; label: string }[] = [
  { id: "harbor", label: "Hafen" },
  { id: "beach", label: "Strand" },
  { id: "city", label: "Stadt" },
  { id: "factory", label: "Fabrik" },
  { id: "canyon", label: "Schlucht" },
];

/** Map level theme id → editable panorama dome kind. */
export function themeToEditorPanoramaKind(theme: string): TrackEditorPanoramaKind {
  const t = theme.toLowerCase();
  if (t === "beach" || t === "city" || t === "factory" || t === "canyon") return t;
  if (t === "scrapyard") return "factory";
  if (t === "mountain") return "canyon";
  if (t === "overpass") return "harbor";
  return "harbor";
}

export function isTrackEditorPanoramaKind(raw: string): raw is TrackEditorPanoramaKind {
  return TRACK_EDITOR_PANORAMA_KINDS.some((k) => k.id === raw);
}

export type TrackEditorPlaceKind = TrackPropId | typeof TRACK_EDITOR_GAUGE_KIND;

export type TrackEditorPaletteItem = {
  id: TrackEditorPlaceKind;
  label: string;
};

const PROP_LABELS: Record<TrackPropId, string> = {
  "tire-wall": "Reifenwand",
  "concrete-wall": "Betonmauer",
  fence: "Zaun",
  crane: "Kran",
  container: "Container",
  tank: "Tank",
  grandstand: "Tribüne",
  palm: "Palme",
  hut: "Hütte",
  tower: "Turm",
  building: "Gebäude",
  cliff: "Felsen",
  spire: "Spitze",
  tree: "Baum",
  warehouse: "Halle",
  scrub: "Busch",
  ramp: "Schanze",
  rumble: "Rüttelstreifen",
  oil: "Öl",
  "tire-stack": "Reifenstapel",
  barrier: "Betonsperre",
  bridge: "Brücke",
};

export const TRACK_EDITOR_PALETTE: TrackEditorPaletteItem[] = [
  { id: TRACK_EDITOR_GAUGE_KIND, label: "Durchfahrt" },
  ...TRACK_PROP_IDS.map((id) => ({ id, label: PROP_LABELS[id] })),
];

export function isTrackEditorPlaceKind(raw: string): raw is TrackEditorPlaceKind {
  return raw === TRACK_EDITOR_GAUGE_KIND || (TRACK_PROP_IDS as readonly string[]).includes(raw);
}

export function smallestCarLateralWidth(): number {
  return Math.min(...Object.values(CAR_LATERAL_WIDTH_M));
}

export function smallestCarIdForGauge(): CarId {
  let best: CarId = "blitz";
  let min = Infinity;
  for (const [id, w] of Object.entries(CAR_LATERAL_WIDTH_M) as [CarId, number][]) {
    if (w < min) {
      min = w;
      best = id;
    }
  }
  return best;
}

export type GaugeBoxSize = { width: number; height: number; depth: number };

/** 80% of the narrowest car mesh width — Durchfahrt-Kasten. */
export function gaugeBoxSize(): GaugeBoxSize {
  const width = Math.round(smallestCarLateralWidth() * GAUGE_WIDTH_RATIO * 1000) / 1000;
  return { width, height: GAUGE_HEIGHT_M, depth: GAUGE_DEPTH_M };
}

export function trackEditorLabel(kind: string): string {
  if (kind === TRACK_EDITOR_GAUGE_KIND) return "Durchfahrt";
  if (kind in PROP_LABELS) return PROP_LABELS[kind as TrackPropId];
  return kind;
}
