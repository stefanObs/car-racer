import { describe, expect, it } from "vitest";
import { APP_VERSION } from "../src/core/version";

describe("scaffold", () => {
  it("exposes a semver app version", () => {
    expect(APP_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
