import { expect, test } from "@playwright/test";

test.describe("F6 Foto mode", () => {
  test("hides the garage menu for canvas photos and restores it", async ({ page }) => {
    test.setTimeout(90_000);
    await page.goto("/");
    await expect(page.getByRole("button", { name: "Cup" })).toBeVisible({ timeout: 45_000 });
    await expect(page.locator("[data-dev-name='dev.badge']")).toContainText("F6 Foto");
    await expect(page.locator(".panel.garage")).toBeVisible();
    await expect(page.locator(".car-stats-popup")).toBeVisible();

    await page.keyboard.press("F6");
    await expect(page.locator("html")).toHaveClass(/dev-photo-mode/);
    await expect(page.locator(".panel.garage")).toBeHidden();
    await expect(page.locator(".car-stats-popup")).toBeHidden();
    await expect(page.locator("[data-dev-name='dev.badge']")).toBeHidden();
    await expect(page.locator("#game-canvas")).toBeVisible();
    await page.screenshot({ path: "tmp/f6-photo-mode.png" });

    await page.evaluate(() => {
      (window as unknown as { __ccSetPhotoMode?: (on: boolean) => void }).__ccSetPhotoMode?.(false);
    });
    await expect(page.locator("html")).not.toHaveClass(/dev-photo-mode/);
    await expect(page.locator(".panel.garage")).toBeVisible();
    await expect(page.locator(".car-stats-popup")).toBeVisible();
  });
});
