import { expect, test } from "@playwright/test";

test.describe("Nitro engage mark (CONCEPT §4.2)", () => {
  test("Hilfe mentions the mark; HUD shows ready vs low fill", async ({ page }) => {
    test.setTimeout(90_000);
    await page.goto("/");

    await page.getByRole("button", { name: "Hilfe" }).click();
    await expect(page.locator("p.help")).toContainText(/Marke/);

    await page.getByRole("button", { name: "Zur Garage" }).click();
    await page.keyboard.press("F4");

    const nitro = page.locator("[data-dev-name='hud.nitro']");
    await expect(nitro).toBeVisible({ timeout: 20_000 });
    await expect(nitro.locator(".bar-min")).toBeVisible();
    await expect(nitro).toHaveClass(/is-ready/);
    await page.screenshot({ path: "tmp/nitro-meter-ready.png" });

    await page.evaluate(() => {
      const cars = (window as unknown as { __ccCars?: { isPlayer: boolean; nitro: number; nitroHeld: boolean }[] })
        .__ccCars;
      const player = cars?.find((c) => c.isPlayer);
      if (player) {
        player.nitro = 0.12;
        player.nitroHeld = false;
      }
    });
    await expect(nitro).toHaveClass(/is-low/);
    await page.screenshot({ path: "tmp/nitro-meter-low.png" });
  });
});
