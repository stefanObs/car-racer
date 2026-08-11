import { expect, test } from "@playwright/test";

test.describe("spinning wheels", () => {
  test("race cars expose four wheels that roll with speed", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("button", { name: "Cup" })).toBeVisible({ timeout: 45_000 });

    await page.getByRole("button", { name: "Cup" }).click();
    await page.getByRole("button", { name: /1\.\s*Hafenstart/ }).click();
    await expect(page.locator("#race-hud")).toBeVisible({ timeout: 30_000 });
    await expect(page.locator("#game-canvas")).toBeVisible();

    await page.keyboard.down("ArrowUp");
    await page.waitForFunction(
      () => {
        const wheels = (
          window as unknown as {
            __spinWheels?: Array<{ spinner: { rotation: { x: number }; parent: unknown } }>;
          }
        ).__spinWheels;
        const live = (wheels ?? []).filter((w) => w.spinner?.parent);
        if (live.length < 4) return false;
        const maxAbs = Math.max(...live.map((w) => Math.abs(w.spinner.rotation.x)));
        return maxAbs > 0.8;
      },
      null,
      { timeout: 20_000 },
    );

    const spun = await page.evaluate(() => {
      const wheels = (
        window as unknown as {
          __spinWheels?: Array<{ spinner: { rotation: { x: number }; parent: unknown } }>;
        }
      ).__spinWheels;
      const live = (wheels ?? []).filter((w) => w.spinner?.parent);
      const maxAbs = live.length ? Math.max(...live.map((w) => Math.abs(w.spinner.rotation.x))) : 0;
      return { count: live.length, maxAbs };
    });
    expect(spun.count).toBeGreaterThanOrEqual(4);
    expect(spun.maxAbs).toBeGreaterThan(0.8);

    await page.screenshot({ path: "test-results/wheels-spin-race.png", fullPage: false });
    await page.keyboard.up("ArrowUp");
  });
});
