/** @vitest-environment happy-dom */
import { describe, expect, it } from "vitest";
import {
  panelScreenOf,
  readPanelScrollTop,
  shouldPreservePanelScroll,
  writePanelScrollTop,
} from "../src/ui/panelScroll";

describe("panel scroll preserve", () => {
  it("preserves only when the panel screen stays the same", () => {
    expect(shouldPreservePanelScroll("garage", "garage")).toBe(true);
    expect(shouldPreservePanelScroll("adhoc", "adhoc")).toBe(true);
    expect(shouldPreservePanelScroll("garage", "cup")).toBe(false);
    expect(shouldPreservePanelScroll(null, "garage")).toBe(false);
  });

  it("does not treat the boot placeholder as a garage panel", () => {
    const root = document.createElement("div");
    root.innerHTML = `<div class="panel"><h1>Garage</h1><p>Lädt…</p></div>`;
    expect(panelScreenOf(root)).toBeNull();
    expect(shouldPreservePanelScroll(panelScreenOf(root), "garage")).toBe(false);
  });

  it("reads and writes .panel scrollTop across an innerHTML rebuild", () => {
    const root = document.createElement("div");
    root.innerHTML = `<div class="panel garage" style="height:40px;overflow:auto">
      <div style="height:400px">tall</div>
    </div>`;
    document.body.appendChild(root);
    const panel = root.querySelector(".panel") as HTMLElement;
    expect(panelScreenOf(root)).toBe("garage");
    panel.scrollTop = 120;
    expect(readPanelScrollTop(root)).toBe(120);

    const saved = readPanelScrollTop(root);
    expect(shouldPreservePanelScroll(panelScreenOf(root), "garage")).toBe(true);
    root.innerHTML = `<div class="panel garage" style="height:40px;overflow:auto">
      <div style="height:400px">tall again</div>
    </div>`;
    writePanelScrollTop(root, saved);
    expect(readPanelScrollTop(root)).toBe(120);
    root.remove();
  });
});
