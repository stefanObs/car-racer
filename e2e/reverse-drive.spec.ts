import { expect, test } from "@playwright/test";

test.describe("Brake → reverse (CONCEPT §4.2)", () => {
  test("Hilfe mentions reverse; touch brake labeled; hold S after GO keeps race alive", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "maxTouchPoints", { get: () => 5 });
    });
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.goto("/");

    await page.getByRole("button", { name: "Hilfe" }).click();
    await expect(page.locator("p.help")).toContainText(/Rückwärts/);

    await page.getByRole("button", { name: "Zur Garage" }).click();
    await page.getByRole("button", { name: "Cup" }).click();
    await page.getByRole("button", { name: /1\.\s*Hafenstart/ }).click();

    await expect(page.locator("#race-hud")).toBeVisible();
    await expect(page.getByRole("button", { name: "Bremse / R" })).toBeVisible();

    const label = page.locator("[data-dev-name='hud.countdown'] .race-countdown__label");
    await expect(label).toHaveText("GO", { timeout: 90_000 });
    await expect(page.locator("[data-dev-name='hud.countdown']")).toHaveCount(0, { timeout: 25_000 });

    await page.keyboard.down("KeyW");
    await page.waitForTimeout(1000);
    await page.keyboard.up("KeyW");
    await page.keyboard.down("KeyS");
    await page.waitForTimeout(3000);
    await page.keyboard.up("KeyS");

    await page.screenshot({ path: "tmp/reverse-drive-smoke.png" });
    await expect(page.locator("#race-hud")).toBeVisible();
    await expect(page.locator("#game-canvas")).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("data-screen", "race");
  });
});
