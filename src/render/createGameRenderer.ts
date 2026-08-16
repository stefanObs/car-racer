import type { MeshInspectHit } from "../core/meshInspect";
import type { RaceSession } from "../sim/race";
import type { FinishCelebrate } from "../core/finishCelebrate";
import { RaceRenderer } from "./RaceRenderer";
import type { GarageLook } from "./garageLook";

export type { GarageLook } from "./garageLook";

export type GameRenderer = {
  buildTrack: (session: RaceSession) => void;
  sync: (session: RaceSession, celebrate?: FinishCelebrate | null) => void;
  renderIdle: () => void;
  setGarageLook: (look: GarageLook) => void;
  setGarageDragging: (dragging: boolean) => void;
  setGaragePitchInspect: (active: boolean) => void;
  addGarageOrbitFromDrag: (
    deltaXPx: number,
    deltaYPx: number,
    axes?: { yaw: boolean; pitch: boolean },
  ) => void;
  isMeshInspect: () => boolean;
  setMeshInspect: (on: boolean) => void;
  pickMeshInspect: (clientX: number, clientY: number, canvas: HTMLCanvasElement) => MeshInspectHit[];
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
export function createGameRenderer(canvas: HTMLCanvasElement): GameRenderer {
  if (!supportsWebGL()) {
    throw new Error(
      "WebGL wird benötigt für Crash Circuit (Asphalt-Comic).\n\nBitte einen aktuellen Browser mit aktivierter Hardware-Beschleunigung nutzen (Chrome, Firefox oder Edge).",
    );
  }
  try {
    return new RaceRenderer(canvas);
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    throw new Error(
      `WebGL-Start fehlgeschlagen.\n\n${detail}\n\nTipp: Hardware-Beschleunigung in den Browser-Einstellungen einschalten.`,
    );
  }
}
