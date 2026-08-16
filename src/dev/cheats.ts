/** Dev-only helpers for F1–F7 cheats (not player-facing). */

/** Hides garage/HUD chrome so agents can screenshot the 3D canvas alone. */
export const PHOTO_MODE_CLASS = "dev-photo-mode";

export function applyPhotoMode(target: Element, on: boolean): void {
  target.classList.toggle(PHOTO_MODE_CLASS, on);
}

export function isPhotoMode(target: Element): boolean {
  return target.classList.contains(PHOTO_MODE_CLASS);
}

export async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through to execCommand */
  }
  const el = document.createElement("textarea");
  el.value = text;
  el.setAttribute("readonly", "");
  el.style.position = "fixed";
  el.style.left = "-9999px";
  document.body.appendChild(el);
  el.select();
  let ok = false;
  try {
    ok = document.execCommand("copy");
  } catch {
    ok = false;
  }
  el.remove();
  return ok;
}

export function parseChfAmount(raw: string): number | null {
  const cleaned = raw.replace(/[^\d]/g, "");
  if (cleaned.length === 0) return null;
  const value = Number.parseInt(cleaned, 10);
  if (!Number.isFinite(value) || value < 0) return null;
  return Math.min(value, 9_999_999);
}

export function clampFinishPlace(place: number, fieldSize: number): number {
  const size = Math.max(1, fieldSize);
  return Math.max(1, Math.min(size, Math.round(place)));
}

/** Assign stable data-dev-name labels for F1 name overlay. */
export function assignDevNames(root: ParentNode): void {
  const nodes = root.querySelectorAll<HTMLElement>(
    "button, a, input, label, h1, h2, h3, .panel, .race-hud, .brand, .tag, .meta, .help, .stack, .garage-parts, .touch-controls, [data-act], [data-touch], [id]",
  );
  nodes.forEach((el) => {
    if (el.dataset.devName) return;
    el.dataset.devName = describeElement(el);
  });
}

function describeElement(el: HTMLElement): string {
  if (el.dataset.act) {
    const extras = [
      el.dataset.level,
      el.dataset.car,
      el.dataset.part,
      el.dataset.sticker,
      el.dataset.color,
      el.dataset.length,
    ]
      .filter(Boolean)
      .join(":");
    return extras ? `act:${el.dataset.act}:${extras}` : `act:${el.dataset.act}`;
  }
  if (el.dataset.touch) return `touch:${el.dataset.touch}`;
  if (el.id) return `#${el.id}`;
  const cls = el.className
    .toString()
    .split(/\s+/)
    .find((c) => c && c !== "nav-focused");
  if (cls) return `.${cls}`;
  const text = (el.textContent ?? "").trim().slice(0, 18).replace(/\s+/g, "_");
  if (text) return `${el.tagName.toLowerCase()}:${text}`;
  return el.tagName.toLowerCase();
}
