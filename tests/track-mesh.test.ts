import { describe, expect, it } from "vitest";
import { CUP_LEVELS } from "../src/data/levels";
import { buildTrackFromLevel } from "../src/track/buildTrack";
import { inflateGeometry, withOutline, comicToon } from "../src/render/comicMaterials";
import { buildSmoothTrack } from "../src/render/trackMesh";
import { BoxGeometry } from "three";

describe("smooth Asphalt-Comic track mesh", () => {
  it("builds continuous ribbon track geometry for a cup level", () => {
    const track = buildTrackFromLevel(CUP_LEVELS[0]!);
    const group = buildSmoothTrack(track);
    expect(group.children.length).toBeGreaterThan(10);
  });

  it("inflates geometry for comic ink outlines", () => {
    const geo = new BoxGeometry(1, 1, 1);
    const inflated = inflateGeometry(geo, 0.05);
    expect(inflated.attributes.position.count).toBeGreaterThan(0);
    const mesh = withOutline(geo, comicToon(0xe03131), 0.05);
    expect(mesh.children).toHaveLength(1);
  });
});
