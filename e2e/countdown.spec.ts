import { expect, test } from "@playwright/test";

test.describe("race start countdown", () => {
  test("shows 3…2…1…GO then clears", async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto("/");
    await page.getByRole("button", { name: "Cup" }).click();
    await page.getByRole("button", { name: /1\.\s*Hafenstart/ }).click();

    const countdown = page.locator("[data-dev-name='hud.countdown']");
    const label = page.locator("[data-dev-name='hud.countdown'] .race-countdown__label");
    await expect(label).toHaveText("3", { timeout: 30_000 });
    await page.screenshot({ path: "tmp/countdown-3.png" });

    // Swiftshader race ticks can be much slower than realtime — allow headroom.
    await expect(label).toHaveText("2", { timeout: 25_000 });
    await expect(label).toHaveText("1", { timeout: 25_000 });
    await expect(label).toHaveText("GO", { timeout: 25_000 });
    await page.screenshot({ path: "tmp/countdown-go.png" });

    await expect(countdown).toHaveCount(0, { timeout: 25_000 });
    await expect(page.locator("#race-hud")).toContainText(/Platz/);
  });
});
