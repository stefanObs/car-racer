import { Group } from "three";
import { describe, expect, it } from "vitest";
import {
  applyCarFx,
  nitroBoosting,
  smokeVisibleCount,
  sparksVisible,
} from "../src/render/carFx";
import { makeFxGroups, upgradeCarFx } from "../src/render/attachCarFx";
import type { ComicCarParts } from "../src/render/comicCarMesh";
import type { FxChunkId } from "../src/render/loadFxGltf";

function stubChunk(_id: FxChunkId): Group {
  return new Group();
}

describe("shared comic car FX", () => {
  it("exposes smoke, sparks, nitro, and lap-shield groups on every car visual", () => {
    const fx = makeFxGroups(-1.6, stubChunk);
    expect(fx.smoke.children).toHaveLength(4);
    expect(fx.sparks.children).toHaveLength(8);
    expect(fx.nitro.children).toHaveLength(5);
    expect(fx.shield.children).toHaveLength(1);
    expect(fx.smoke.children.every((c) => !c.visible)).toBe(true);
    expect(fx.sparks.children.every((c) => !c.visible)).toBe(true);
    expect(fx.nitro.children.every((c) => !c.visible)).toBe(true);
    expect(fx.shield.children.every((c) => !c.visible)).toBe(true);
  });

  it("places nitro chunks behind the rear, not a Blitz-only offset", () => {
    const bison = makeFxGroups(-2.05, stubChunk);
    const blitz = makeFxGroups(-1.55, stubChunk);
    expect(bison.nitro.children[0]!.position.z).toBeLessThan(-2.05);
    expect(blitz.nitro.children[0]!.position.z).toBeLessThan(-1.55);
    expect(bison.nitro.children[0]!.position.z).toBeLessThan(blitz.nitro.children[0]!.position.z);
    expect(bison.nitro.children[4]!.position.z).toBeLessThan(bison.nitro.children[0]!.position.z);
  });

  it("hides nitro when not boosting and shows smoke when damaged", () => {
    expect(smokeVisibleCount(0)).toBe(0);
    expect(smokeVisibleCount(1)).toBe(2);
    expect(smokeVisibleCount(2)).toBe(3);
    expect(smokeVisibleCount(3)).toBe(4);
    expect(smokeVisibleCount(4)).toBe(0);
    expect(sparksVisible(0)).toBe(false);
    expect(sparksVisible(0.4)).toBe(true);
    expect(nitroBoosting(1, 1)).toBe(false);
    expect(nitroBoosting(0.8, 0.7)).toBe(true);

    const fx = makeFxGroups(-1.7, stubChunk);
    const visual = { ...fx, fxRearZ: -1.7 };

    applyCarFx(visual, { stage: 2, healFx: 0, boosting: false, lapShield: 0 }, 1);
    expect(fx.smoke.children.filter((c) => c.visible)).toHaveLength(3);
    expect(fx.nitro.children.every((c) => !c.visible)).toBe(true);
    expect(fx.sparks.children.every((c) => !c.visible)).toBe(true);
    expect(fx.shield.children.every((c) => !c.visible)).toBe(true);
    expect(fx.smoke.children[0]!.position.z).toBeCloseTo(-1.7, 5);

    applyCarFx(visual, { stage: 0, healFx: 0, boosting: true, lapShield: 0 }, 1);
    expect(fx.smoke.children.every((c) => !c.visible)).toBe(true);
    expect(fx.nitro.children.every((c) => c.visible)).toBe(true);

    applyCarFx(visual, { stage: 0, healFx: 0, boosting: false, lapShield: 1.5 }, 1);
    expect(fx.shield.visible).toBe(true);
    expect(fx.shield.children.every((c) => c.visible)).toBe(true);
  });

  it("upgradeCarFx is a no-op when FX GLBs are not preloaded", () => {
    const smoke = new Group();
    smoke.add(new Group());
    const visual = {
      root: new Group(),
      smoke,
      sparks: new Group(),
      nitro: new Group(),
      shield: new Group(),
    } as ComicCarParts;
    expect(() => upgradeCarFx(visual)).not.toThrow();
    expect(visual.smoke.userData.tripoFx).toBeFalsy();
    expect(visual.smoke.children).toHaveLength(1);
  });
});
