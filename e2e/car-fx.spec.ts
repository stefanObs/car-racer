import { expect, test } from "@playwright/test";

test.describe("shared comic race FX", () => {
  test("smoke and nitro trails on player and AI cars", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Garage" })).toBeVisible();
    await page.getByRole("button", { name: "Cup" }).click();
    await page.getByRole("button", { name: /1\.\s*Hafenstart/ }).click();
    await expect(page.locator("#race-hud")).toBeVisible();

    await page.waitForFunction(() => {
      const w = window as unknown as { __ccCars?: { hp: number }[] };
      return Array.isArray(w.__ccCars) && w.__ccCars.length >= 2;
    });

    const tripo = await page.evaluate(() => (window as unknown as { __ccFxTripo?: boolean }).__ccFxTripo);
    expect(tripo, "Tripo FX GLBs should be attached to every car").toBe(true);

    await page.evaluate(() => {
      const cars = (window as unknown as { __ccCars: { hp: number; nitro: number }[] }).__ccCars;
      for (const car of cars) {
        car.hp = 0.32;
        car.nitro = 1;
      }
    });
    await page.keyboard.down("Space");
    await page.keyboard.down("ArrowUp");
    await page.waitForTimeout(600);
    await page.locator("#game-canvas").screenshot({ path: "test-results/fx-player-ai-smoke-nitro.png" });
    await page.keyboard.up("Space");
    await page.keyboard.up("ArrowUp");
  });
});
