import {
  formatMeshInspectBoxes,
  formatMeshInspectClipboard,
  formatMeshInspectLine,
  formatMeshInspectLines,
  type MeshInspectBox,
  type MeshInspectCatalogEntry,
  type MeshInspectComponent,
  type MeshInspectHit,
  type MeshInspectOrbitMode,
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
  boxes?: readonly MeshInspectBox[] | null;
  boxCanReset?: boolean;
  engineHidden?: boolean;
  orbitMode?: MeshInspectOrbitMode;
};

export function applyMeshInspectMode(target: Element, on: boolean): void {
  target.classList.toggle(MESH_INSPECT_CLASS, on);
}

export function isMeshInspectMode(target: Element): boolean {
  return target.classList.contains(MESH_INSPECT_CLASS);
}

export function meshInspectHint(opts: MeshInspectPanelOpts): string {
  if (opts.copied) return "Kopiert";
  const seite = opts.orbitMode === "roll";
  if (opts.boxPaint && opts.box) {
    return opts.boxCanReset
      ? `Eckpunkte · LMB ${seite ? "Seite" : "dreht"} · RMB Menü · Shift neuer Kasten · Zurück / Pos1 · Kasten kopieren`
      : `Eckpunkte · LMB ${seite ? "Seite" : "dreht"} · RMB Menü · Shift neuer Kasten · Kasten kopieren`;
  }
  if (opts.boxPaint) {
    return seite
      ? "LMB Seite am Auto · RMB Menü · Shift malt Kasten · B aus · F6 zu"
      : "Ziehen malt Kasten · LMB dreht Auto · RMB Menü · Shift weiterer Kasten · B aus · F6 zu";
  }
  if (!opts.edit) {
    return seite
      ? "LMB Seite am Auto · RMB Menü · B Kasten · C kopieren · Liste wählt Teil · F6 zu"
      : "LMB dreht Auto · RMB Menü (Seite) · B Kasten · C kopieren · Liste wählt Teil · F6 zu";
  }
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
  const boxes = opts.boxes && opts.boxes.length > 0 ? opts.boxes : box ? [box] : [];
  const boxCanReset = Boolean(opts.boxCanReset);
  const engineHidden = Boolean(opts.engineHidden);
  const orbitMode = opts.orbitMode ?? "turn";
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
    orbitMode,
  });
  const selectedBlock = selection
    ? `<p class="dev-mesh-inspect-selected" data-dev-name="dev.mesh-inspect.selected">${escapePre(formatMeshInspectLine(selection))}</p>`
    : "";
  const boxBlock =
    boxes.length > 0
      ? `<pre class="dev-mesh-inspect-box" data-dev-name="dev.mesh-inspect.box">${escapePre(formatMeshInspectBoxes(boxes))}</pre>`
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
  <button type="button" data-mesh-inspect-orbit="turn" class="${orbitMode === "turn" ? "is-on" : ""}" data-dev-name="dev.mesh-inspect.orbit.turn">Drehen</button>
  <button type="button" data-mesh-inspect-orbit="roll" class="${orbitMode === "roll" ? "is-on" : ""}" data-dev-name="dev.mesh-inspect.orbit.roll">Seite</button>
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
  <button type="button" class="dev-mesh-inspect-edit ${engineHidden ? "is-on" : ""}" data-mesh-inspect-hide-engine data-dev-name="dev.mesh-inspect.hide-engine">${engineHidden ? "Motor AN" : "Motor aus"}</button>
  <button type="button" class="dev-mesh-inspect-edit" data-mesh-inspect-edit data-dev-name="dev.mesh-inspect.edit">${edit ? "Platzieren AN" : "Platzieren AUS"}</button>
</aside>
</div>`;
}

export function renderMeshInspectOrbitMenuHtml(opts: {
  x: number;
  y: number;
  mode: MeshInspectOrbitMode;
  hasBox?: boolean;
}): string {
  const turnOn = opts.mode === "turn" ? "is-on" : "";
  const rollOn = opts.mode === "roll" ? "is-on" : "";
  const boxBtn = opts.hasBox
    ? `<button type="button" data-mesh-inspect-copy-box data-dev-name="dev.mesh-inspect.menu.copy-box">Kasten kopieren</button>`
    : "";
  return `<div class="dev-mesh-inspect-orbit-menu" data-dev-name="dev.mesh-inspect.menu" style="left:${opts.x}px;top:${opts.y}px" role="menu">
  <button type="button" class="${turnOn}" data-mesh-inspect-orbit="turn" data-dev-name="dev.mesh-inspect.menu.turn">Drehen</button>
  <button type="button" class="${rollOn}" data-mesh-inspect-orbit="roll" data-dev-name="dev.mesh-inspect.menu.roll">Seite</button>
  <button type="button" data-mesh-inspect-copy-hits data-dev-name="dev.mesh-inspect.menu.copy">Kopieren</button>
  ${boxBtn}
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
