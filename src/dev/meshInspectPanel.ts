import {
  formatMeshInspectClipboard,
  formatMeshInspectLine,
  formatMeshInspectLines,
  type MeshInspectHit,
  type MeshInspectSelection,
} from "../core/meshInspect";

export const MESH_INSPECT_CLASS = "dev-mesh-inspect-mode";

export type MeshInspectPanelOpts = {
  copied?: boolean;
  edit?: boolean;
  selection?: MeshInspectSelection | null;
};

export function applyMeshInspectMode(target: Element, on: boolean): void {
  target.classList.toggle(MESH_INSPECT_CLASS, on);
}

export function isMeshInspectMode(target: Element): boolean {
  return target.classList.contains(MESH_INSPECT_CLASS);
}

export function meshInspectHint(opts: MeshInspectPanelOpts): string {
  if (opts.copied) return "Kopiert";
  if (!opts.edit) return "LMB drehen · RMB kopieren · E Platzieren · F5 zu";
  if (opts.selection) {
    return "Ziehen versetzen · Alt drehen · Pfeile XZ · Bild↑↓ Y · Shift+Klick Teil · R zurück · Esc weg";
  }
  return "Klick Mesh · Shift+Klick Teil · LMB drehen · E aus";
}

export function renderMeshInspectPanelHtml(
  hits: readonly MeshInspectHit[],
  copiedOrOpts: boolean | MeshInspectPanelOpts = false,
): string {
  const opts: MeshInspectPanelOpts =
    typeof copiedOrOpts === "boolean" ? { copied: copiedOrOpts } : copiedOrOpts;
  const edit = Boolean(opts.edit);
  const selection = opts.selection ?? null;
  const status = meshInspectHint({ copied: opts.copied, edit, selection });
  const selectedBlock = selection
    ? `<p class="dev-mesh-inspect-selected" data-dev-name="dev.mesh-inspect.selected">${escapePre(formatMeshInspectLine(selection))}</p>`
    : "";
  return `<aside class="dev-mesh-inspect" data-dev-name="dev.mesh-inspect" aria-label="Mesh-Koordinaten">
  <h3 data-dev-name="dev.mesh-inspect.title">Mesh-Raum (m)</h3>
  ${selectedBlock}
  <pre data-dev-name="dev.mesh-inspect.hits">${escapePre(formatMeshInspectLines(hits))}</pre>
  <p class="dim" data-dev-name="dev.mesh-inspect.hint">${status}</p>
  <button type="button" class="dev-mesh-inspect-edit" data-mesh-inspect-edit data-dev-name="dev.mesh-inspect.edit">${edit ? "Platzieren AN" : "Platzieren AUS"}</button>
</aside>`;
}

export function meshInspectClipboardText(
  hits: readonly MeshInspectHit[],
  selection?: MeshInspectSelection | null,
): string {
  return formatMeshInspectClipboard(hits, selection);
}

function escapePre(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
