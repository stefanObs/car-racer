/** Helpers so garage (and other list panels) keep scroll after a selection re-render. */

export function panelScreenOf(root: ParentNode): string | null {
  const panel = root.querySelector(".panel");
  if (!(panel instanceof HTMLElement)) return null;
  for (const c of panel.classList) {
    if (c !== "panel") return c;
  }
  return null;
}

/** Same screen re-render → keep scrollbar (and focus) where the player left them. */
export function shouldPreservePanelScroll(
  previousPanelScreen: string | null,
  nextScreen: string,
): boolean {
  return previousPanelScreen != null && previousPanelScreen === nextScreen;
}

export function readPanelScrollTop(root: ParentNode): number {
  const panel = root.querySelector(".panel");
  return panel instanceof HTMLElement ? panel.scrollTop : 0;
}

export function writePanelScrollTop(root: ParentNode, top: number): void {
  const panel = root.querySelector(".panel");
  if (panel instanceof HTMLElement) panel.scrollTop = top;
}
