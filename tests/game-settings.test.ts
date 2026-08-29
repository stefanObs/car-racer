/** @vitest-environment happy-dom */
import { describe, expect, it, beforeEach } from "vitest";
import { applyEasyModeThrottle, loadGameSettings, writeGameSettings } from "../src/meta/gameSettings";

describe("game settings easy mode + low damage", () => {
  beforeEach(() => {
    localStorage.clear();
  });
  it("defaults easy mode and low damage off", () => {
    expect(loadGameSettings().easyMode).toBe(false);
    expect(loadGameSettings().lowDamageMode).toBe(false);
  });

  it("persists easy mode round-trip", () => {
    writeGameSettings({ easyMode: true, lowDamageMode: false });
    expect(loadGameSettings().easyMode).toBe(true);
    writeGameSettings({ easyMode: false, lowDamageMode: false });
    expect(loadGameSettings().easyMode).toBe(false);
  });

  it("persists low damage round-trip", () => {
    writeGameSettings({ easyMode: false, lowDamageMode: true });
    expect(loadGameSettings().lowDamageMode).toBe(true);
    writeGameSettings({ easyMode: false, lowDamageMode: false });
    expect(loadGameSettings().lowDamageMode).toBe(false);
  });

  it("forces full throttle when easy and not braking", () => {
    expect(applyEasyModeThrottle(0, 0, true)).toBe(1);
    expect(applyEasyModeThrottle(0.2, 0, true)).toBe(1);
  });

  it("does not override throttle while braking or when easy is off", () => {
    expect(applyEasyModeThrottle(0, 1, true)).toBe(0);
    expect(applyEasyModeThrottle(0.4, 0.2, true)).toBe(0.4);
    expect(applyEasyModeThrottle(0, 0, false)).toBe(0);
  });
});
