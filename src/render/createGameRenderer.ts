import type { RaceSession } from "../sim/race";
import { RaceRenderer } from "./RaceRenderer";

export type GameRenderer = {
  buildTrack: (session: RaceSession) => void;
  sync: (session: RaceSession) => void;
  renderIdle: () => void;
  clearCars: () => void;
};

function supportsWebGL(): boolean {
  try {
    const c = document.createElement("canvas");
    return Boolean(c.getContext("webgl2") || c.getContext("webgl") || c.getContext("experimental-webgl"));
  } catch {
    return false;
  }
}

/**
 * Asphalt-Comic requires WebGL (toon meshes, outlines, chase 3D).
 * Canvas2D fallback removed — it could not match the concept look.
 */
export function createGameRenderer(canvas: HTMLCanvasElement): {
  renderer: GameRenderer;
  mode: "webgl";
} {
  if (!supportsWebGL()) {
    throw new Error(
      "WebGL wird benötigt für Crash Circuit (Asphalt-Comic).\n\nBitte einen aktuellen Browser mit aktivierter Hardware-Beschleunigung nutzen (Chrome, Firefox oder Edge).",
    );
  }
  try {
    return { renderer: new RaceRenderer(canvas), mode: "webgl" };
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    throw new Error(
      `WebGL-Start fehlgeschlagen.\n\n${detail}\n\nTipp: Hardware-Beschleunigung in den Browser-Einstellungen einschalten.`,
    );
  }
}
