/** Dev F5 mesh studio — hits in car mesh space (cheat-sheet meters). */

export type MeshInspectHit = {
  name: string;
  x: number;
  y: number;
  z: number;
  id?: string;
  parentId?: string;
};

export type MeshInspectSelection = {
  name: string;
  id: string;
  x: number;
  y: number;
  z: number;
  kind?: "object" | "edge";
  yaw?: number;
  pitch?: number;
  roll?: number;
  sx?: number;
  sy?: number;
  sz?: number;
};

export type MeshInspectPointerKind = "orbit" | "copy" | "selectOrMove" | "ignore";

export type MeshInspectDragMode = "free" | "keepY" | "onlyY";

export type MeshInspectTool = "move" | "rotate" | "scaleUniform" | "scaleFree";

export type MeshInspectComponent = "object" | "edge";

export const MESH_INSPECT_DECIMALS = 3;
export const MESH_INSPECT_DRAG_PX = 4;
export const MESH_INSPECT_NUDGE = 0.05;
export const MESH_INSPECT_NUDGE_FINE = 0.01;
export const MESH_INSPECT_NUDGE_COARSE = 0.25;
export const MESH_INSPECT_ROTATE = (5 * Math.PI) / 180;
export const MESH_INSPECT_ROTATE_FINE = Math.PI / 180;
export const MESH_INSPECT_ROTATE_COARSE = (15 * Math.PI) / 180;
export const MESH_INSPECT_ROTATE_PX = 0.008;
export const MESH_INSPECT_SCALE_PX = 0.008;
export const MESH_INSPECT_SCALE_MIN = 0.05;
export const MESH_INSPECT_SCALE_MAX = 20;
export const MESH_INSPECT_SCALE = 1.05;
export const MESH_INSPECT_SCALE_FINE = 1.01;
export const MESH_INSPECT_SCALE_COARSE = 1.15;

export function formatMeshInspectCoord(n: number, digits = MESH_INSPECT_DECIMALS): string {
  const v = Number.isFinite(n) ? n : 0;
  return v.toFixed(digits);
}

export function formatMeshInspectLine(
  hit: {
    name: string;
    x: number;
    y: number;
    z: number;
    kind?: "object" | "edge";
    yaw?: number;
    sx?: number;
    sy?: number;
    sz?: number;
  },
  digits = MESH_INSPECT_DECIMALS,
): string {
  const xyz = `${hit.name}  ${formatMeshInspectCoord(hit.x, digits)}, ${formatMeshInspectCoord(hit.y, digits)}, ${formatMeshInspectCoord(hit.z, digits)}`;
  const labeled = hit.kind === "edge" ? `Kante ${xyz}` : xyz;
  const withYaw =
    typeof hit.yaw === "number" ? `${labeled}  yaw ${formatMeshInspectCoord(hit.yaw, 1)}°` : labeled;
  if (typeof hit.sx !== "number") return withYaw;
  const sx = hit.sx;
  const sy = hit.sy ?? sx;
  const sz = hit.sz ?? sx;
  const uniform = Math.abs(sx - sy) < 0.005 && Math.abs(sx - sz) < 0.005;
  const scale = uniform
    ? `×${formatMeshInspectCoord(sx, 2)}`
    : `×${formatMeshInspectCoord(sx, 2)}, ${formatMeshInspectCoord(sy, 2)}, ${formatMeshInspectCoord(sz, 2)}`;
  return `${withYaw}  ${scale}`;
}

/** Panel / clipboard body: one named element per line, nearest first. */
export function formatMeshInspectLines(hits: readonly MeshInspectHit[]): string {
  if (hits.length === 0) return "(nichts)";
  return hits.map((hit) => formatMeshInspectLine(hit)).join("\n");
}

export function formatMeshInspectClipboard(
  hits: readonly MeshInspectHit[],
  selection?: MeshInspectSelection | null,
): string {
  if (selection) return `Mesh-Raum (m)\n${formatMeshInspectLine(selection)}`;
  return `Mesh-Raum (m)\n${formatMeshInspectLines(hits)}`;
}

export function meshInspectPointerAction(
  button: number,
  opts?: { edit?: boolean; altKey?: boolean },
): MeshInspectPointerKind {
  if (button === 2) return "copy";
  if (button === 1) return "orbit";
  if (button !== 0) return "ignore";
  if (opts?.edit && !opts.altKey) return "selectOrMove";
  return "orbit";
}

export function meshInspectDragExceeded(
  dx: number,
  dy: number,
  threshold = MESH_INSPECT_DRAG_PX,
): boolean {
  return dx * dx + dy * dy >= threshold * threshold;
}

export function meshInspectDragMode(mods: { shift?: boolean; ctrl?: boolean }): MeshInspectDragMode {
  if (mods.ctrl) return "onlyY";
  if (mods.shift) return "keepY";
  return "free";
}

export function meshInspectNudgeStep(mods: { shift?: boolean; ctrl?: boolean }): number {
  if (mods.ctrl) return MESH_INSPECT_NUDGE_COARSE;
  if (mods.shift) return MESH_INSPECT_NUDGE_FINE;
  return MESH_INSPECT_NUDGE;
}

/** Mesh-space nudge: arrows XZ (up = +Z), PageUp/Down = Y. */
export function meshInspectNudgeDelta(
  code: string,
  mods: { shift?: boolean; ctrl?: boolean },
): { x: number; y: number; z: number } | null {
  const step = meshInspectNudgeStep(mods);
  switch (code) {
    case "ArrowLeft":
      return { x: -step, y: 0, z: 0 };
    case "ArrowRight":
      return { x: step, y: 0, z: 0 };
    case "ArrowUp":
      return { x: 0, y: 0, z: step };
    case "ArrowDown":
      return { x: 0, y: 0, z: -step };
    case "PageUp":
      return { x: 0, y: step, z: 0 };
    case "PageDown":
      return { x: 0, y: -step, z: 0 };
    default:
      return null;
  }
}

export function meshInspectWantParent(mods: { shift?: boolean; ctrl?: boolean; meta?: boolean }): boolean {
  return Boolean(mods.shift);
}

export function meshInspectRotateStep(mods: { shift?: boolean; ctrl?: boolean }): number {
  if (mods.ctrl) return MESH_INSPECT_ROTATE_COARSE;
  if (mods.shift) return MESH_INSPECT_ROTATE_FINE;
  return MESH_INSPECT_ROTATE;
}

/** [ ] or , . yaw the whole mesh in mesh space. */
export function meshInspectYawDelta(
  code: string,
  mods: { shift?: boolean; ctrl?: boolean },
): number | null {
  const step = meshInspectRotateStep(mods);
  switch (code) {
    case "BracketLeft":
    case "Comma":
      return step;
    case "BracketRight":
    case "Period":
      return -step;
    default:
      return null;
  }
}

export function meshInspectToolFromKey(code: string): MeshInspectTool | null {
  if (code === "KeyG") return "move";
  if (code === "KeyR") return "rotate";
  if (code === "KeyS") return "scaleUniform";
  if (code === "KeyX") return "scaleFree";
  return null;
}

export function meshInspectComponentFromKey(code: string): MeshInspectComponent | null {
  if (code === "Digit1" || code === "KeyO") return "object";
  if (code === "Digit2" || code === "KeyK") return "edge";
  return null;
}

/** Esc: drop edge, then object, then place mode, then F5. */
export function meshInspectEscapeStep(opts: {
  hasEdge?: boolean;
  hasSelection: boolean;
  edit: boolean;
}): "clearEdge" | "clearSelection" | "leaveEdit" | "leaveStudio" {
  if (opts.hasEdge) return "clearEdge";
  if (opts.hasSelection) return "clearSelection";
  if (opts.edit) return "leaveEdit";
  return "leaveStudio";
}

export function meshInspectGestureAfterDrag(opts: {
  edit: boolean;
  hasSelection: boolean;
  hitIsSelection: boolean;
  hitEmpty: boolean;
  tool?: MeshInspectTool;
  hasEdge?: boolean;
}): "move" | "rotate" | "moveEdge" | "scaleUniform" | "scaleFree" | "orbit" {
  if (!(opts.edit && opts.hasSelection && opts.hitIsSelection)) return "orbit";
  if (opts.tool === "scaleUniform") return "scaleUniform";
  if (opts.tool === "scaleFree") return "scaleFree";
  if (opts.hasEdge && opts.tool !== "rotate") return "moveEdge";
  if (opts.tool === "rotate") return "rotate";
  return "move";
}

export function meshInspectScaleStep(mods: { shift?: boolean; ctrl?: boolean }): number {
  if (mods.ctrl) return MESH_INSPECT_SCALE_COARSE;
  if (mods.shift) return MESH_INSPECT_SCALE_FINE;
  return MESH_INSPECT_SCALE;
}

/** + / − grow or shrink while keeping the current ratio. */
export function meshInspectScaleFactor(code: string, mods: { shift?: boolean; ctrl?: boolean }): number | null {
  const step = meshInspectScaleStep(mods);
  switch (code) {
    case "Equal":
    case "NumpadAdd":
      return step;
    case "Minus":
    case "NumpadSubtract":
      return 1 / step;
    default:
      return null;
  }
}
