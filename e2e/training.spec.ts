import { expect, test } from "@playwright/test";

test.describe("Training mode", () => {
  test("lists every cup track, starts solo, and hides place HUD", async ({ page }) => {
    test.setTimeout(90_000);
    await page.goto("/");
    await page.getByRole("button", { name: "Training" }).click();
    await expect(page.getByRole("heading", { name: "Training" })).toBeVisible();
    await expect(page.getByText("ohne Platzierung")).toBeVisible();
    await expect(page.locator("button.track-pick")).toHaveCount(5);
    await expect(page.getByRole("button", { name: /Gesperrt/ })).toHaveCount(0);

    await page.getByRole("button", { name: /Hafenstart/ }).click();
    await expect(page.locator("#race-hud")).toBeVisible({ timeout: 30_000 });
    await expect(page.locator("[data-dev-name='hud.training']")).toHaveText("Training");
    await expect(page.locator("[data-dev-name='hud.place']")).toHaveCount(0);
    await expect(page.locator("[data-dev-name='hud.field-wrap']")).toHaveCount(0);
    await expect(page.locator("[data-dev-name='hud.minimap-wrap']")).toBeVisible();
    await expect(page.locator("[data-dev-name='hud.countdown']")).toBeVisible();
    await page.screenshot({ path: "tmp/training-hafenstart.png" });
  });
});
