import { describe, expect, it } from "vitest";
import { shouldApplyGaragePaint } from "../src/render/loadCarGltf";
import { existsSync, readFileSync } from "node:fs";

describe("car wheels (authored tires, no fake spin overlays)", () => {
  it("still skips garage paint on Tire and Wheel names", () => {
    expect(shouldApplyGaragePaint("Tire")).toBe(false);
    expect(shouldApplyGaragePaint("Wheel")).toBe(false);
    expect(shouldApplyGaragePaint("BodyPaint")).toBe(true);
  });

  it("does not mount shared comic wheels at boot or clone", () => {
    const main = readFileSync("src/main.ts", "utf8");
    const load = readFileSync("src/render/loadCarGltf.ts", "utf8");
    const mesh = readFileSync("src/render/comicCarMesh.ts", "utf8");
    expect(main).not.toContain("preloadComicWheel");
    expect(load).not.toContain("mountCarWheels");
    expect(mesh).not.toContain("mountCarWheels");
  });

  it("removes the dead comic-wheel module and asset", () => {
    expect(existsSync("src/render/carWheels.ts")).toBe(false);
    expect(existsSync("public/models/props/comic-wheel.glb")).toBe(false);
    expect(existsSync("scripts/bake-wheels-tripo.mjs")).toBe(false);
  });
});
