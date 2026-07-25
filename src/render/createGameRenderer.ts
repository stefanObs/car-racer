import type { RaceSession } from "../sim/race";
import { Canvas2DRenderer } from "./Canvas2DRenderer";
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

export function createGameRenderer(canvas: HTMLCanvasElement): {
  renderer: GameRenderer;
  mode: "webgl" | "canvas2d";
} {
  if (supportsWebGL()) {
    try {
      return { renderer: new RaceRenderer(canvas), mode: "webgl" };
    } catch (err) {
      console.warn("WebGL init failed, using Canvas2D fallback.", err);
    }
  } else {
    console.warn("WebGL not supported, using Canvas2D fallback.");
  }
  return { renderer: new Canvas2DRenderer(canvas), mode: "canvas2d" };
}
