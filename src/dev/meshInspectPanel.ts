import {
  formatMeshInspectBox,
  formatMeshInspectClipboard,
  formatMeshInspectLine,
  formatMeshInspectLines,
  type MeshInspectBox,
  type MeshInspectCatalogEntry,
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
  catalog?: readonly MeshInspectCatalogEntry[];
  dirtyCount?: number;
  boxPaint?: boolean;
  box?: MeshInspectBox | null;
  boxCanReset?: boolean;
};

export function applyMeshInspectMode(target: Element, on: boolean): void {
  target.classList.toggle(MESH_INSPECT_CLASS, on);
}

export function isMeshInspectMode(target: Element): boolean {
  return target.classList.contains(MESH_INSPECT_CLASS);
}

export function meshInspectHint(opts: MeshInspectPanelOpts): string {
  if (opts.copied) return "Kopiert";
  if (opts.boxPaint && opts.box) {
    return opts.boxCanReset
      ? "Kantenpunkte ziehen · LMB dreht Auto · Zurück / Pos1 · Kasten kopieren"
      : "Kantenpunkte ziehen · LMB dreht Auto · Shift neu · Kasten kopieren";
  }
  if (opts.boxPaint) return "Ziehen malt Kasten · danach LMB drehen · B aus · F6 zu";
  if (!opts.edit) return "LMB drehen · B Kasten · RMB/C kopieren · Liste wählt Teil · E Platzieren · F6 zu";
  if ((opts.dirtyCount ?? 0) > 0) {
    return "Änderung kopieren / C / RMB → Patch an den Agenten · Pos1 zurück";
  }
  if (opts.component === "edge") {
    return "Klick Kante · Ziehen versetzen · R dreht Mesh · S 1:1 · Pos1 zurück · Esc weg";
  }
  if (opts.selection && opts.tool === "rotate") {
    return "Ziehen drehen · Shift nur yaw · S 1:1 · X strecken · G versetzen · Pos1 zurück";
  }
  if (opts.selection && opts.tool === "scaleUniform") {
    return "Ziehen 1:1 · +/− Größe · X strecken · G versetzen · Pos1 zurück";
  }
  if (opts.selection && opts.tool === "scaleFree") {
    return "Ziehen strecken · Shift XZ · Ctrl nur Y · S 1:1 · +/− · Pos1 zurück";
  }
  if (opts.selection) {
    return "Ziehen versetzen · R drehen · S 1:1 · X strecken · K Kante · Pos1 zurück";
  }
  return "Klick Mesh · Liste innen · K Kante · R drehen · S 1:1 · E aus";
}

export function renderMeshInspectCatalogHtml(
  catalog: readonly MeshInspectCatalogEntry[],
  selectedId?: string | null,
): string {
  if (catalog.length === 0) {
    return `<p class="dim" data-dev-name="dev.mesh-inspect.catalog.empty">Keine Komponenten</p>`;
  }
  return catalog
    .map((entry) => {
      const on = entry.id === selectedId ? "is-on" : "";
      const pad = 8 + entry.depth * 12;
      return `<button type="button" class="${on}" data-mesh-inspect-select="${escapeAttr(entry.id)}" style="padding-left:${pad}px">${escapePre(entry.name)}</button>`;
    })
    .join("");
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
  const catalog = opts.catalog ?? [];
  const dirtyCount = opts.dirtyCount ?? 0;
  const boxPaint = Boolean(opts.boxPaint);
  const box = opts.box ?? null;
  const boxCanReset = Boolean(opts.boxCanReset);
  const status = meshInspectHint({
    copied: opts.copied,
    edit,
    selection,
    tool,
    component,
    dirtyCount,
    boxPaint,
    box,
    boxCanReset,
  });
  const selectedBlock = selection
    ? `<p class="dev-mesh-inspect-selected" data-dev-name="dev.mesh-inspect.selected">${escapePre(formatMeshInspectLine(selection))}</p>`
    : "";
  const boxBlock = box
    ? `<pre class="dev-mesh-inspect-box" data-dev-name="dev.mesh-inspect.box">${escapePre(formatMeshInspectBox(box))}</pre>`
    : "";
  const placeTools = edit
    ? `<button type="button" data-mesh-inspect-tool="move" class="${tool === "move" && !boxPaint ? "is-on" : ""}" data-dev-name="dev.mesh-inspect.tool.move">Versetzen</button>
  <button type="button" data-mesh-inspect-tool="rotate" class="${tool === "rotate" && !boxPaint ? "is-on" : ""}" data-dev-name="dev.mesh-inspect.tool.rotate">Drehen</button>
  <button type="button" data-mesh-inspect-tool="scaleUniform" class="${tool === "scaleUniform" && !boxPaint ? "is-on" : ""}" data-dev-name="dev.mesh-inspect.tool.scaleUniform">1:1</button>
  <button type="button" data-mesh-inspect-tool="scaleFree" class="${tool === "scaleFree" && !boxPaint ? "is-on" : ""}" data-dev-name="dev.mesh-inspect.tool.scaleFree">Strecken</button>
  <button type="button" data-mesh-inspect-comp="object" class="${component === "object" ? "is-on" : ""}" data-dev-name="dev.mesh-inspect.comp.object">Mesh</button>
  <button type="button" data-mesh-inspect-comp="edge" class="${component === "edge" ? "is-on" : ""}" data-dev-name="dev.mesh-inspect.comp.edge">Kante</button>`
    : "";
  const tools = `<div class="dev-mesh-inspect-tools">
  <button type="button" data-mesh-inspect-box class="${boxPaint ? "is-on" : ""}" data-dev-name="dev.mesh-inspect.tool.box">Kasten</button>
  ${placeTools}
</div>`;
  return `<div class="dev-mesh-inspect-dock" data-dev-name="dev.mesh-inspect.dock">
  <nav class="dev-mesh-inspect-catalog" data-dev-name="dev.mesh-inspect.catalog" aria-label="Komponenten">
    <h3 data-dev-name="dev.mesh-inspect.catalog.title">Komponenten</h3>
    <div class="dev-mesh-inspect-catalog-list" data-dev-name="dev.mesh-inspect.catalog.list">${renderMeshInspectCatalogHtml(catalog, selection?.id)}</div>
  </nav>
  <aside class="dev-mesh-inspect" data-dev-name="dev.mesh-inspect" aria-label="Mesh-Koordinaten">
  <h3 data-dev-name="dev.mesh-inspect.title">Mesh-Raum (m)</h3>
  ${selectedBlock}
  ${boxBlock}
  <pre data-dev-name="dev.mesh-inspect.hits">${escapePre(formatMeshInspectLines(hits))}</pre>
  <p class="dim" data-dev-name="dev.mesh-inspect.hint">${status}</p>
  ${tools}
  ${box ? `<button type="button" class="dev-mesh-inspect-edit" data-mesh-inspect-copy-box data-dev-name="dev.mesh-inspect.copy-box">Kasten kopieren</button>` : ""}
  ${box ? `<button type="button" class="dev-mesh-inspect-edit" data-mesh-inspect-reset-box ${boxCanReset ? "" : "disabled "}data-dev-name="dev.mesh-inspect.reset-box">Zurück</button>` : ""}
  ${dirtyCount > 0 ? `<button type="button" class="dev-mesh-inspect-edit" data-mesh-inspect-copy data-dev-name="dev.mesh-inspect.copy">Änderung kopieren (${dirtyCount})</button>` : ""}
  <button type="button" class="dev-mesh-inspect-edit" data-mesh-inspect-edit data-dev-name="dev.mesh-inspect.edit">${edit ? "Platzieren AN" : "Platzieren AUS"}</button>
</aside>
</div>`;
}

export function meshInspectClipboardText(
  hits: readonly MeshInspectHit[],
  selection?: MeshInspectSelection | null,
  patchText?: string | null,
  boxText?: string | null,
): string {
  if (patchText) return patchText;
  if (boxText) return boxText;
  return formatMeshInspectClipboard(hits, selection);
}

function escapePre(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escapeAttr(text: string): string {
  return escapePre(text).replace(/"/g, "&quot;");
}
