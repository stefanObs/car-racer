import { expect, test } from "@playwright/test";

test.describe("F4 Debug-Raster pad", () => {
  test("opens a solo grid pad with no countdown or cup HUD", async ({ page }) => {
    test.setTimeout(90_000);
    await page.goto("/");
    await expect(page.getByRole("button", { name: "Cup" })).toBeVisible();
    await expect(page.locator("[data-dev-name='dev.badge']")).toContainText("F4 Raster");

    await page.keyboard.press("F4");

    await expect(page.locator("#race-hud")).toBeVisible({ timeout: 20_000 });
    await expect(page.locator("[data-dev-name='hud.debug-pad']")).toHaveText("Debug-Raster");
    await expect(page.locator("[data-dev-name='hud.countdown']")).toHaveCount(0);
    await expect(page.locator("[data-dev-name='hud.minimap-wrap']")).toHaveCount(0);
    await expect(page.locator("[data-dev-name='hud.field-wrap']")).toHaveCount(0);
    await expect(page.locator("html")).toHaveAttribute("data-screen", "race");

    await page.keyboard.down("KeyW");
    await page.keyboard.down("KeyA");
    await page.waitForTimeout(1500);
    await page.keyboard.up("KeyA");
    await page.keyboard.up("KeyW");

    await page.screenshot({ path: "tmp/debug-pad-f4.png" });
    await expect(page.locator("#game-canvas")).toBeVisible();
  });
});
