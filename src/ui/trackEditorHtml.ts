import { TRACK_EDITOR_PALETTE, TRACK_EDITOR_PANORAMA_KINDS, trackEditorLabel, type TrackEditorPlaceKind } from "../data/trackEditorCatalog";
import type { TrackEditorDoc } from "../core/trackEditor";

export type TrackEditorTrackOption = { id: string; displayName: string };

export function renderTrackEditorHtml(opts: {
  tracks: TrackEditorTrackOption[];
  doc: TrackEditorDoc;
  copied: boolean;
}): string {
  const trackOpts = opts.tracks
    .map(
      (t) =>
        `<option value="${t.id}" ${t.id === opts.doc.levelId ? "selected" : ""}>${escapeHtml(t.displayName)}</option>`,
    )
    .join("");
  const palette = TRACK_EDITOR_PALETTE.map((item) => {
    const on = item.id === opts.doc.paletteKind ? " is-on" : "";
    return `<button type="button" data-nav data-act="editor-palette" data-kind="${item.id}" class="track-editor-chip${on}" data-dev-name="editor.palette.${item.id}">${escapeHtml(item.label)}</button>`;
  }).join("");
  const panoOpts = TRACK_EDITOR_PANORAMA_KINDS.map(
    (k) =>
      `<option value="${k.id}" ${k.id === opts.doc.panoramaKind ? "selected" : ""}>${escapeHtml(k.label)}</option>`,
  ).join("");
  const copied = opts.copied ? " · kopiert" : "";
  const selected = opts.doc.selectedId
    ? opts.doc.placements.find((p) => p.id === opts.doc.selectedId)
    : null;
  const selectionLine = selected
    ? `<p class="tag track-editor-selection" data-dev-name="editor.selection">Auswahl: ${escapeHtml(trackEditorLabel(selected.kind))} · ziehen verschieben · Pfeile fein · R drehen</p>`
    : "";
  const deleteBtn = selected
    ? `<button type="button" data-nav data-act="editor-delete" class="track-editor-chip track-editor-delete" data-dev-name="editor.delete">Löschen</button>`
    : "";
  return `
    <h2 data-dev-name="editor.title">Strecken-Editor</h2>
    <p class="tag" data-dev-name="editor.hint">F8 · Pfeile fliegen · Bild↑/↓ hoch/runter · Klick setzen · Ziehen verschieben · R drehen · Entf löschen</p>
    <label class="track-editor-label" data-dev-name="editor.track-label">Strecke
      <select data-editor-track data-dev-name="editor.track">${trackOpts}</select>
    </label>
    <div class="track-editor-palette" data-dev-name="editor.palette">${palette}</div>
    ${selectionLine}
    ${deleteBtn}
    <label class="track-editor-label" data-dev-name="editor.pano-kind-label">Panorama Kuppel
      <select data-editor-pano-kind data-dev-name="editor.pano-kind">${panoOpts}</select>
    </label>
    <label class="track-editor-label" data-dev-name="editor.pano-y-label">Panorama Höhe
      <input type="range" min="-24" max="24" step="0.5" value="${opts.doc.panoramaOffsetY}" data-editor-pano-y data-dev-name="editor.pano-y" />
      <span data-editor-pano-y-val>${opts.doc.panoramaOffsetY.toFixed(1)}</span>
    </label>
    <label class="track-editor-label" data-dev-name="editor.pano-s-label">Panorama Strecken
      <input type="range" min="0.4" max="2.2" step="0.05" value="${opts.doc.panoramaHeightScale}" data-editor-pano-s data-dev-name="editor.pano-s" />
      <span data-editor-pano-s-val>${opts.doc.panoramaHeightScale.toFixed(2)}</span>
    </label>
    <button type="button" data-nav data-act="editor-kulisse" class="track-editor-chip${opts.doc.hideScenery ? " is-on" : ""}" data-dev-name="editor.kulisse">${opts.doc.hideScenery ? "Kulisse AUS" : "Kulisse AN"}</button>
    <div class="stack row">
      <button type="button" data-nav data-act="editor-copy" data-dev-name="editor.copy">Kopieren${copied}</button>
      <button type="button" data-nav data-act="editor-reset" data-dev-name="editor.reset">Zurücksetzen</button>
    </div>
    <button type="button" data-nav data-act="editor-close" data-dev-name="editor.close">Schließen</button>
  `;
}

export function isTrackEditorPaletteKind(raw: string | undefined): raw is TrackEditorPlaceKind {
  return Boolean(raw && TRACK_EDITOR_PALETTE.some((p) => p.id === raw));
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
}
