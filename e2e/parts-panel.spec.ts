import { expect, test } from "@playwright/test";

test.describe("F5 Teile panel", () => {
  test("opens on the race screen and toggles a Teil without leaving the race", async ({ page }) => {
    test.setTimeout(90_000);
    await page.goto("/");
    await expect(page.locator("[data-dev-name='dev.badge']")).toContainText("F5 Teile");

    await page.keyboard.press("F4");
    await expect(page.locator("#race-hud")).toBeVisible({ timeout: 20_000 });

    await page.keyboard.press("F5");
    const panel = page.locator("[data-dev-name='dev.dialog.parts']");
    await expect(panel).toBeVisible();
    await expect(panel).toContainText("nur dieses Rennen");

    const engine = page.locator("[data-dev-name='dev.parts.big_engine']");
    await expect(engine).toHaveAttribute("aria-pressed", "false");
    await engine.click();
    await expect(engine).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator("#race-hud")).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("data-screen", "race");

    await page.screenshot({ path: "tmp/f5-parts-panel.png" });
  });
});
