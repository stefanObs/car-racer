import type { LevelDefinition } from "../track/types";

/** Half-extent of the debug driving square (world meters). */
export const DEBUG_PAD_EXTENT_M = 500;

/** Minor grid spacing (world meters). */
export const DEBUG_PAD_GRID_M = 5;

export const DEBUG_PAD_ID = "dev_raster_pad";

/** Open asphalt square for handling tests — not a cup/free race. */
export function debugPadLevel(): LevelDefinition {
  const span = DEBUG_PAD_EXTENT_M * 2;
  return {
    id: DEBUG_PAD_ID,
    kind: "adhoc",
    displayName: "Debug-Raster",
    description: "Dev: große Plane + weißes Raster — Lenken/Driften prüfen.",
    theme: "harbor",
    laps: 99,
    recommendedClass: "blitz",
    gripMultiplier: 1,
    track: {
      closedLoop: false,
      asphaltWidth: span,
      grassWidth: 0,
      debugPad: true,
      segments: [{ type: "straight", length: span, width: span }],
      walls: { rule: "none" },
    },
    obstacles: [],
    spawn: { grid: [[0, 0]], headingDeg: 0 },
    rewards: { currency: "CHF", placePurse: [0, 0, 0, 0, 0, 0], starsOnTop3: false },
  };
}

export function isDebugPadLevel(level: { track: { debugPad?: boolean } }): boolean {
  return Boolean(level.track.debugPad);
}
