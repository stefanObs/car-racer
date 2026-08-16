/** Dev F5 mesh studio — hits in car mesh space (cheat-sheet meters). */

export type MeshInspectHit = {
  name: string;
  x: number;
  y: number;
  z: number;
};

export const MESH_INSPECT_DECIMALS = 3;

export function formatMeshInspectCoord(n: number, digits = MESH_INSPECT_DECIMALS): string {
  const v = Number.isFinite(n) ? n : 0;
  return v.toFixed(digits);
}

export function formatMeshInspectLine(hit: MeshInspectHit, digits = MESH_INSPECT_DECIMALS): string {
  return `${hit.name}  ${formatMeshInspectCoord(hit.x, digits)}, ${formatMeshInspectCoord(hit.y, digits)}, ${formatMeshInspectCoord(hit.z, digits)}`;
}

/** Panel / clipboard body: one named element per line, nearest first. */
export function formatMeshInspectLines(hits: readonly MeshInspectHit[]): string {
  if (hits.length === 0) return "(nichts)";
  return hits.map((hit) => formatMeshInspectLine(hit)).join("\n");
}

export function formatMeshInspectClipboard(hits: readonly MeshInspectHit[]): string {
  return `Mesh-Raum (m)\n${formatMeshInspectLines(hits)}`;
}

export function meshInspectPointerAction(button: number): "orbit" | "copy" | "ignore" {
  if (button === 2) return "copy";
  if (button === 0) return "orbit";
  return "ignore";
}
