/** @vitest-environment happy-dom */

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { applyPhotoMode, isPhotoMode, PHOTO_MODE_CLASS } from "../src/dev/cheats";

describe("F5 Foto mode", () => {
  it("toggles the photo-mode class used to hide garage chrome", () => {
    const el = document.createElement("div");
    expect(isPhotoMode(el)).toBe(false);
    applyPhotoMode(el, true);
    expect(el.classList.contains(PHOTO_MODE_CLASS)).toBe(true);
    expect(isPhotoMode(el)).toBe(true);
    applyPhotoMode(el, false);
    expect(isPhotoMode(el)).toBe(false);
  });

  it("hides ui-root and the dev badge in CSS so screenshots are canvas-only", () => {
    const css = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), "../src/ui/styles.css"), "utf8");
    expect(css).toContain("html.dev-photo-mode .ui-root");
    expect(css).toContain("html.dev-photo-mode .dev-root");
    const block = css.match(/html\.dev-photo-mode[\s\S]*?pointer-events:\s*none\s*!important;/)?.[0] ?? "";
    expect(block).toContain("visibility: hidden");
  });
});
