import { expect, test } from "@playwright/test";

test.describe("K.O. come-back HUD (CONCEPT §4.5)", () => {
  test("shows Comeback countdown while the player is K.O.", async ({ page }) => {
    test.setTimeout(90_000);
    await page.goto("/");
    await expect(page.getByRole("button", { name: "Cup" })).toBeVisible();
    await page.keyboard.press("F4");

    await expect(page.locator("[data-dev-name='hud.debug-pad']")).toHaveText("Debug-Raster", {
      timeout: 20_000,
    });

    await page.evaluate(() => {
      const cars = (window as unknown as { __ccCars?: { isPlayer: boolean; hp: number; koTimer: number }[] })
        .__ccCars;
      const player = cars?.find((c) => c.isPlayer);
      if (player) {
        player.hp = 0;
        player.koTimer = 3;
      }
    });

    const damage = page.locator("[data-dev-name='hud.damage']");
    await expect(damage).toContainText(/K\.O\. · Comeback/);
    await page.screenshot({ path: "tmp/ko-comeback-hud.png" });
  });
});
