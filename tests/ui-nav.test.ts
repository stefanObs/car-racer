import { describe, expect, it } from "vitest";
import { defaultFocusIndex, nextFocusIndex, risingEdge } from "../src/input/uiNav";

describe("uiNav", () => {
  const items = [{}, {}, { disabled: true }, {}];

  it("moves down and wraps among enabled buttons", () => {
    expect(nextFocusIndex(items, 0, "down")).toBe(1);
    expect(nextFocusIndex(items, 1, "down")).toBe(3);
    expect(nextFocusIndex(items, 3, "down")).toBe(0);
  });

  it("moves up and skips disabled", () => {
    expect(nextFocusIndex(items, 3, "up")).toBe(1);
    expect(nextFocusIndex(items, 0, "up")).toBe(3);
  });

  it("detects rising edges for held gamepad buttons", () => {
    expect(risingEdge(true, false)).toBe(true);
    expect(risingEdge(true, true)).toBe(false);
    expect(risingEdge(false, true)).toBe(false);
  });

  it("prefers Cup over an earlier Settings button on the garage hub", () => {
    const items = [
      { act: "open-settings" },
      { act: "cup" },
      { act: "free" },
    ];
    expect(defaultFocusIndex(items, "cup")).toBe(1);
    expect(defaultFocusIndex(items)).toBe(0);
  });
});
