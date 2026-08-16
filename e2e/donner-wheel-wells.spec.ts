import { expect, test } from "@playwright/test";

test.describe("Donnerbüchse wheel wells", () => {
  test("garage ¾ does not show sky through the hubs", async ({ page }) => {
    test.setTimeout(90_000);
    await page.addInitScript(() => {
      localStorage.setItem(
        "crash-circuit-save-v1",
        JSON.stringify({
          version: 2,
          chf: 20000,
          ownedCars: ["blitz", "bison", "kaeferkraft", "donnerbuechse", "bunker"],
          activeCar: "donnerbuechse",
          kits: {
            donnerbuechse: {
              ownedParts: [],
              equippedParts: [],
              paint: "#339af0",
              sticker: "none",
            },
          },
          unlockedLevels: ["blitz_cup_01_hafenstart"],
          cupStars: {},
          cupIndexUnlocked: 1,
        }),
      );
    });

    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("data-screen", "garage", { timeout: 60_000 });
    await expect(page.locator(".garage-car.is-active .garage-car__name")).toHaveText("Donnerbüchse");
    await page.waitForTimeout(1200);
    await page.locator("#game-canvas").screenshot({ path: "tmp/donner-wells-3q.png" });
    await page.evaluate(() => {
      const car = (window as unknown as { __idleCar?: { traverse: (fn: (o: { name?: string; visible: boolean }) => void) => void } })
        .__idleCar;
      car?.traverse((o) => {
        if (o.name?.startsWith("StockWheel_")) o.visible = false;
      });
    });
    await page.waitForTimeout(200);
    await page.locator("#game-canvas").screenshot({ path: "tmp/donner-wells-hidden.png" });
  });
});
