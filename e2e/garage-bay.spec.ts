import { expect, test } from "@playwright/test";

test.describe("garage bay workshop stock", () => {
  test("opens the hub with inventory grid and a WebGL bay", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Garage" })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Ausrüsten/ })).toBeVisible();
    await expect(page.getByText(/Bestand — nur/)).toBeVisible();
    await expect(page.locator(".garage-parts--grid").first()).toBeVisible();
    await expect(page.locator("#game-canvas")).toBeVisible();
    await expect(page.locator(".boot-error")).toHaveCount(0);

    await page.screenshot({ path: "/tmp/garage-hub-ui.png", fullPage: true });
    await page.locator(".panel.garage").evaluate((el) => {
      (el as HTMLElement).style.opacity = "0";
      (el as HTMLElement).style.pointerEvents = "none";
    });
    const stats = page.locator(".car-stats-popup");
    if ((await stats.count()) > 0) {
      await stats.evaluate((el) => {
        (el as HTMLElement).style.display = "none";
      });
    }
    await page.waitForTimeout(600);
    await page.screenshot({ path: "/tmp/garage-bay-stock.png", fullPage: true });
  });
});
