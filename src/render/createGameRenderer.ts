import type {
  MeshInspectBox,
  MeshInspectBoxCorner,
  MeshInspectCatalogEntry,
  MeshInspectComponent,
  MeshInspectDragMode,
  MeshInspectHit,
  MeshInspectOrbitMode,
  MeshInspectSelection,
  MeshInspectTool,
} from "../core/meshInspect";
import type { FlyCamera, TrackEditorDoc } from "../core/trackEditor";
import type { TrackEditorPick } from "./trackEditorPresenter";
import type { FinishCelebrate } from "../core/finishCelebrate";
import type { RaceSession } from "../sim/race";
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
    axes?: { yaw: boolean; pitch: boolean; roll?: boolean },
  ) => void;
  isMeshInspect: () => boolean;
  setMeshInspect: (on: boolean) => void;
  isMeshInspectEdit: () => boolean;
  setMeshInspectEdit: (on: boolean) => void;
  meshInspectSelection: () => MeshInspectSelection | null;
  meshInspectCatalog: () => MeshInspectCatalogEntry[];
  meshInspectPatchText: () => string | null;
  meshInspectDirtyCount: () => number;
  selectMeshInspectById: (id: string) => boolean;
  meshInspectHitIsSelection: (hitId: string | null | undefined) => boolean;
  pickMeshInspect: (clientX: number, clientY: number, canvas: HTMLCanvasElement) => MeshInspectHit[];
  selectMeshInspectAt: (
    clientX: number,
    clientY: number,
    canvas: HTMLCanvasElement,
    wantParent: boolean,
    wantEdge?: boolean,
  ) => MeshInspectHit[];
  clearMeshInspectSelection: () => boolean;
  dragMeshInspect: (
    fromClientX: number,
    fromClientY: number,
    toClientX: number,
    toClientY: number,
    canvas: HTMLCanvasElement,
    mode: MeshInspectDragMode,
  ) => void;
  nudgeMeshInspect: (dx: number, dy: number, dz: number) => void;
  yawMeshInspect: (radians: number) => void;
  rotateMeshInspect: (dxPx: number, dyPx: number, mode: MeshInspectDragMode) => void;
  scaleMeshInspect: (dxPx: number, dyPx: number, mode: MeshInspectDragMode, uniform: boolean) => void;
  scaleMeshInspectUniform: (factor: number) => void;
  dragMeshInspectEdge: (
    fromClientX: number,
    fromClientY: number,
    toClientX: number,
    toClientY: number,
    canvas: HTMLCanvasElement,
    mode: MeshInspectDragMode,
  ) => void;
  meshInspectPlaceTool: () => MeshInspectTool;
  setMeshInspectPlaceTool: (tool: MeshInspectTool) => void;
  meshInspectPlaceComponent: () => MeshInspectComponent;
  setMeshInspectPlaceComponent: (component: MeshInspectComponent) => void;
  meshInspectHasEdge: () => boolean;
  clearMeshInspectEdge: () => boolean;
  isMeshInspectBoxPaint: () => boolean;
  setMeshInspectBoxPaint: (on: boolean) => void;
  meshInspectOrbitMode: () => MeshInspectOrbitMode;
  setMeshInspectOrbitMode: (mode: MeshInspectOrbitMode) => void;
  meshInspectBox: () => MeshInspectBox | null;
  meshInspectBoxes: () => MeshInspectBox[];
  meshInspectBoxText: () => string | null;
  commitMeshInspectBox: (
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    canvas: HTMLCanvasElement,
  ) => MeshInspectBox | null;
  pickMeshInspectBoxHandle: (
    clientX: number,
    clientY: number,
    canvas: HTMLCanvasElement,
  ) => MeshInspectBoxCorner | null;
  resizeMeshInspectBox: (
    corner: MeshInspectBoxCorner,
    fromClientX: number,
    fromClientY: number,
    toClientX: number,
    toClientY: number,
    canvas: HTMLCanvasElement,
  ) => void;
  clearMeshInspectBox: () => boolean;
  meshInspectBoxCanReset: () => boolean;
  resetMeshInspectBox: () => boolean;
  isMeshInspectEngineHidden: () => boolean;
  toggleMeshInspectEngineHidden: () => boolean;
  resetMeshInspectSelection: () => boolean;
  isTrackEditor: () => boolean;
  enterTrackEditor: (doc: TrackEditorDoc, fly: FlyCamera) => void;
  exitTrackEditor: () => void;
  syncTrackEditor: (doc: TrackEditorDoc, fly: FlyCamera) => void;
  pickTrackEditor: (clientX: number, clientY: number, canvas: HTMLCanvasElement) => TrackEditorPick;
  trackEditorGroundAt: (
    clientX: number,
    clientY: number,
    canvas: HTMLCanvasElement,
  ) => { x: number; z: number } | null;
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
