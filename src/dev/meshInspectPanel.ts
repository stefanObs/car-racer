import {
  formatMeshInspectClipboard,
  formatMeshInspectLine,
  formatMeshInspectLines,
  type MeshInspectComponent,
  type MeshInspectHit,
  type MeshInspectSelection,
  type MeshInspectTool,
} from "../core/meshInspect";

export const MESH_INSPECT_CLASS = "dev-mesh-inspect-mode";

export type MeshInspectPanelOpts = {
  copied?: boolean;
  edit?: boolean;
  selection?: MeshInspectSelection | null;
  tool?: MeshInspectTool;
  component?: MeshInspectComponent;
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
  if (opts.component === "edge") {
    return "Klick Kante · Ziehen versetzen · R dreht Mesh · [ ] yaw · Pos1 zurück · Esc weg";
  }
  if (opts.selection && opts.tool === "rotate") {
    return "Ziehen drehen · Shift nur yaw · G versetzen · [ ] yaw · K Kante · Pos1 zurück";
  }
  if (opts.selection) {
    return "Ziehen versetzen · R drehen · [ ] yaw · K Kante · Shift+Klick Teil · Pos1 zurück";
  }
  return "Klick Mesh · K Kante · R drehen · LMB orbit · E aus";
}

export function renderMeshInspectPanelHtml(
  hits: readonly MeshInspectHit[],
  copiedOrOpts: boolean | MeshInspectPanelOpts = false,
): string {
  const opts: MeshInspectPanelOpts =
    typeof copiedOrOpts === "boolean" ? { copied: copiedOrOpts } : copiedOrOpts;
  const edit = Boolean(opts.edit);
  const selection = opts.selection ?? null;
  const tool = opts.tool ?? "move";
  const component = opts.component ?? "object";
  const status = meshInspectHint({ copied: opts.copied, edit, selection, tool, component });
  const selectedBlock = selection
    ? `<p class="dev-mesh-inspect-selected" data-dev-name="dev.mesh-inspect.selected">${escapePre(formatMeshInspectLine(selection))}</p>`
    : "";
  const tools = edit
    ? `<div class="dev-mesh-inspect-tools">
  <button type="button" data-mesh-inspect-tool="move" class="${tool === "move" ? "is-on" : ""}" data-dev-name="dev.mesh-inspect.tool.move">Versetzen</button>
  <button type="button" data-mesh-inspect-tool="rotate" class="${tool === "rotate" ? "is-on" : ""}" data-dev-name="dev.mesh-inspect.tool.rotate">Drehen</button>
  <button type="button" data-mesh-inspect-comp="object" class="${component === "object" ? "is-on" : ""}" data-dev-name="dev.mesh-inspect.comp.object">Mesh</button>
  <button type="button" data-mesh-inspect-comp="edge" class="${component === "edge" ? "is-on" : ""}" data-dev-name="dev.mesh-inspect.comp.edge">Kante</button>
</div>`
    : "";
  return `<aside class="dev-mesh-inspect" data-dev-name="dev.mesh-inspect" aria-label="Mesh-Koordinaten">
  <h3 data-dev-name="dev.mesh-inspect.title">Mesh-Raum (m)</h3>
  ${selectedBlock}
  <pre data-dev-name="dev.mesh-inspect.hits">${escapePre(formatMeshInspectLines(hits))}</pre>
  <p class="dim" data-dev-name="dev.mesh-inspect.hint">${status}</p>
  ${tools}
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
