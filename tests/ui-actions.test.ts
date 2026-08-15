import { describe, expect, it } from "vitest";
import { applyAdhocSeed, applyMenuAction, type MenuActionState } from "../src/app/uiActions";
import { emptyGaragePreview } from "../src/app/garagePreview";
import { CUP_LEVELS } from "../src/data/levels";
import { defaultSave } from "../src/meta/save";
import { createRaceSession } from "../src/app/raceFlow";

function state(over: Partial<MenuActionState> = {}): MenuActionState {
  return {
    screen: "garage",
    save: defaultSave(),
    preview: emptyGaragePreview(),
    adhocSeed: "AAAAAA",
    adhocLength: "medium",
    lastAdhoc: null,
    ...over,
  };
}

describe("applyMenuAction", () => {
  it("switches menu screens", () => {
    const s = state();
    expect(applyMenuAction(s, "cup", {}).handled).toBe(true);
    expect(s.screen).toBe("cup");
    applyMenuAction(s, "training", {});
    expect(s.screen).toBe("training");
  });

  it("starts a cup level from the cup screen", () => {
    const s = state({ screen: "cup" });
    const out = applyMenuAction(s, "race", { level: CUP_LEVELS[0]!.id });
    expect(out.startLevel?.id).toBe(CUP_LEVELS[0]!.id);
    expect(out.startLevel?.kind).toBe("cup");
  });

  it("wraps training starts as unranked", () => {
    const s = state({ screen: "training" });
    const out = applyMenuAction(s, "race", { level: CUP_LEVELS[0]!.id });
    expect(out.startLevel?.kind).toBe("training");
  });

  it("rolls a new adhoc seed", () => {
    const s = state({ adhocSeed: "AAAAAA" });
    applyMenuAction(s, "adhoc-roll", {});
    expect(s.screen).toBe("adhoc");
    expect(s.adhocSeed).not.toBe("AAAAAA");
  });

  it("previews then buys a car", () => {
    const s = state();
    s.save.chf = 5000;
    applyMenuAction(s, "car", { car: "bison" });
    expect(s.preview.car).toBe("bison");
    expect(s.save.activeCar).toBe("blitz");
    const out = applyMenuAction(s, "buy-car", { car: "bison" });
    expect(out.bought).toBe(true);
    expect(s.save.ownedCars).toContain("bison");
    expect(s.preview.car).toBeNull();
  });

  it("normalizes adhoc seeds", () => {
    const s = state();
    applyAdhocSeed(s, "ab");
    expect(s.adhocSeed.length).toBeGreaterThan(0);
  });

  it("builds a race session from the active kit", () => {
    const save = defaultSave();
    const session = createRaceSession(save, CUP_LEVELS[0]!);
    expect(session.player().isPlayer).toBe(true);
    expect(session.level.id).toBe(CUP_LEVELS[0]!.id);
  });
});
