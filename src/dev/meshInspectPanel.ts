import { formatMeshInspectClipboard, formatMeshInspectLines, type MeshInspectHit } from "../core/meshInspect";

export const MESH_INSPECT_CLASS = "dev-mesh-inspect-mode";

export function applyMeshInspectMode(target: Element, on: boolean): void {
  target.classList.toggle(MESH_INSPECT_CLASS, on);
}

export function isMeshInspectMode(target: Element): boolean {
  return target.classList.contains(MESH_INSPECT_CLASS);
}

export function renderMeshInspectPanelHtml(hits: readonly MeshInspectHit[], copied = false): string {
  const status = copied ? "Kopiert" : "LMB drehen · RMB kopieren · F5 zu";
  return `<aside class="dev-mesh-inspect" data-dev-name="dev.mesh-inspect" aria-label="Mesh-Koordinaten">
  <h3 data-dev-name="dev.mesh-inspect.title">Mesh-Raum (m)</h3>
  <pre data-dev-name="dev.mesh-inspect.hits">${escapePre(formatMeshInspectLines(hits))}</pre>
  <p class="dim" data-dev-name="dev.mesh-inspect.hint">${status}</p>
</aside>`;
}

export function meshInspectClipboardText(hits: readonly MeshInspectHit[]): string {
  return formatMeshInspectClipboard(hits);
}

function escapePre(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
