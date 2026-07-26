import { describe, expect, it } from "vitest";
import { Group, Mesh } from "three";
import {
  attachKaeferkraftSteeringWheel,
  buildKaeferkraftSteeringWheel,
} from "../src/render/kaeferkraftProps";

describe("kaeferkraft cockpit props", () => {
  it("builds a black steering wheel group", () => {
    const wheel = buildKaeferkraftSteeringWheel();
    expect(wheel.name).toBe("kaeferkraftSteeringWheel");
    expect(wheel.children.length).toBeGreaterThanOrEqual(4);
    const mat = (wheel.children[0] as Mesh).material as { name?: string };
    expect(mat.name).toBe("Dark");
  });

  it("attaches the wheel onto the car root", () => {
    const root = new Group();
    attachKaeferkraftSteeringWheel(root);
    expect(root.getObjectByName("kaeferkraftSteeringWheel")).toBeTruthy();
    attachKaeferkraftSteeringWheel(root);
    expect(root.children.filter((c) => c.name === "kaeferkraftSteeringWheel")).toHaveLength(1);
  });
});
