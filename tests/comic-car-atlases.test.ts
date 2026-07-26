import { BufferAttribute, BufferGeometry } from "three";
import { beforeEach, describe, expect, it } from "vitest";
import {
  atlasRoleFromName,
  carUsesAuthoredAtlas,
  clearComicCarAtlasCache,
  comicAtlasForRole,
  comicCarAtlasCacheSize,
} from "../src/render/comicCarAtlases";
import { ensureComicBoxUvs, ensureDogFaceUvs, ensureNoseOrnamentUvs, meshNeedsComicUvs } from "../src/render/comicCarUvs";

describe("comic car UVs", () => {
  it("detects missing and broken UV ranges", () => {
    const geo = new BufferGeometry();
    geo.setAttribute("position", new BufferAttribute(new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]), 3));
    expect(meshNeedsComicUvs(geo)).toBe(true);

    geo.setAttribute("uv", new BufferAttribute(new Float32Array([0, 0, 1, 0, 0, 1]), 2));
    expect(meshNeedsComicUvs(geo)).toBe(false);

    geo.setAttribute("uv", new BufferAttribute(new Float32Array([-50, 0, 50, 0, 0, 40]), 2));
    expect(meshNeedsComicUvs(geo)).toBe(true);
  });

  it("writes box-projected UVs when needed", () => {
    const geo = new BufferGeometry();
    geo.setAttribute(
      "position",
      new BufferAttribute(new Float32Array([-1, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1]), 3),
    );
    ensureComicBoxUvs(geo);
    const uv = geo.getAttribute("uv");
    expect(uv).toBeTruthy();
    expect(uv!.count).toBe(4);
    expect(meshNeedsComicUvs(geo)).toBe(false);
  });

  it("writes front-planar UVs for nose ornaments", () => {
    const geo = new BufferGeometry();
    geo.setAttribute(
      "position",
      new BufferAttribute(new Float32Array([-1, 0, -0.5, -1, 1, -0.5, -1, 0, 0.5, -1, 1, 0.5]), 3),
    );
    ensureNoseOrnamentUvs(geo);
    const uv = geo.getAttribute("uv");
    expect(uv).toBeTruthy();
    expect(uv!.count).toBe(4);
    const us = [0, 1, 2, 3].map((i) => uv!.getX(i));
    const vs = [0, 1, 2, 3].map((i) => uv!.getY(i));
    expect(Math.min(...us)).toBeCloseTo(0, 5);
    expect(Math.max(...us)).toBeCloseTo(1, 5);
    expect(Math.min(...vs)).toBeCloseTo(0, 5);
    expect(Math.max(...vs)).toBeCloseTo(1, 5);
  });

  it("writes snout-facing XY UVs for the dog head", () => {
    const geo = new BufferGeometry();
    geo.setAttribute(
      "position",
      new BufferAttribute(new Float32Array([-0.5, 0, 1, 0.5, 0, 1, -0.5, 1, 1, 0.5, 1, 1]), 3),
    );
    ensureDogFaceUvs(geo);
    const uv = geo.getAttribute("uv");
    expect(uv).toBeTruthy();
    expect(uv!.count).toBe(4);
    const us = [0, 1, 2, 3].map((i) => uv!.getX(i));
    expect(Math.min(...us)).toBeCloseTo(0, 5);
    expect(Math.max(...us)).toBeCloseTo(1, 5);
  });
});

describe("comic car atlases", () => {
  beforeEach(() => clearComicCarAtlasCache());

  it("leaves hotrod as authored-atlas car", () => {
    expect(carUsesAuthoredAtlas("donnerbuechse")).toBe(true);
    expect(carUsesAuthoredAtlas("blitz")).toBe(false);
    expect(carUsesAuthoredAtlas("bison")).toBe(false);
    expect(carUsesAuthoredAtlas("kaeferkraft")).toBe(false);
    expect(carUsesAuthoredAtlas("bunker")).toBe(false);
  });

  it("maps material names to atlas roles", () => {
    expect(atlasRoleFromName("BodyPaint", "blitz")).toBe("body");
    expect(atlasRoleFromName("Tire", "bison")).toBe("tire");
    expect(atlasRoleFromName("Glass", "bison")).toBe("glass");
    expect(atlasRoleFromName("Chrome", "kaeferkraft")).toBe("chrome");
    expect(atlasRoleFromName("TruckDark", "bunker")).toBe("armor");
    expect(atlasRoleFromName("Headlights", "blitz")).toBe("light");
    expect(atlasRoleFromName("EyeRed", "kaeferkraft")).toBe("headlight");
    expect(comicAtlasForRole("kaeferkraft", "headlight")).toBeTruthy();
  });

  it("builds per-car body atlases and shared trim atlases", () => {
    expect(comicAtlasForRole("blitz", "body")).toBeTruthy();
    expect(comicAtlasForRole("bison", "body")).toBeTruthy();
    expect(comicAtlasForRole("kaeferkraft", "body")).toBeTruthy();
    expect(comicAtlasForRole("bunker", "armor")).toBeTruthy();
    expect(comicAtlasForRole("blitz", "tire")).toBeTruthy();
    expect(comicCarAtlasCacheSize()).toBeGreaterThanOrEqual(5);
  });
});
