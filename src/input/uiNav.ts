/** Pure helpers for controller / keyboard menu focus. */

export type UiNavDir = "up" | "down" | "left" | "right";

export interface Focusable {
  disabled?: boolean;
}

/**
 * Move focus among enabled items. Vertical wraps; left/right step by 1
 * (works for stacked menus and short rows).
 */
export function nextFocusIndex(
  items: readonly Focusable[],
  current: number,
  dir: UiNavDir,
): number {
  const enabled = items
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => !item.disabled);
  if (enabled.length === 0) return 0;

  let pos = enabled.findIndex(({ index }) => index === current);
  if (pos < 0) pos = 0;

  const delta = dir === "up" || dir === "left" ? -1 : 1;
  const next = (pos + delta + enabled.length) % enabled.length;
  return enabled[next]!.index;
}

export function risingEdge(current: boolean, previous: boolean): boolean {
  return current && !previous;
}
